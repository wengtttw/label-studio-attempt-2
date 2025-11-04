"""
Workspace RBAC data models for Label Studio.

This module defines the core database schema for workspace-based access control,
allowing administrators to group multiple projects and manage user access at the
workspace level rather than individually per project.

Models defined:
    - Workspace: Logical grouping of projects within an organization
    - WorkspaceMember: User-to-workspace memberships with optional role overrides
    - WorkspaceProject: Workspace-to-project associations with custom ordering

Upstream dependencies (what this file imports/uses):
    - organizations.Organization: Parent organization for multi-tenancy
    - organizations.OrganizationMember: Used to resolve user roles when no override is set
    - projects.Project: Projects being grouped in workspaces
    - settings.AUTH_USER_MODEL: User references and ownership tracking

Downstream consumers (what uses these models):
    - workplace_RBAC_extension.api.WorkspaceViewSet: API CRUD operations
    - workplace_RBAC_extension.serializers: Transforms models to/from JSON
    - workplace_RBAC_extension.permissions: Access control checks
    - workplace_RBAC_extension.admin: Django admin interface
    - projects.models.ProjectMember: Auto-created when users added to workspaces

Design patterns used:
    - Soft delete pattern (deleted_at timestamp) for data retention and audit
    - Audit fields (created_at, updated_at, created_by) on all models
    - Position-based ordering for WorkspaceProject custom display order
    - Role override pattern allowing workspace-specific permission grants

Integration notes:
    - WorkspaceMember.get_effective_role() bridges workspace and organization roles
    - Adding members to workspaces automatically creates ProjectMember records
    - Adding projects to workspaces automatically grants access to all members
    - Soft delete prevents foreign key violations when removing workspaces
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from organizations.models import OrganizationMember


class Workspace(models.Model):
    """
    Logical grouping of projects within an organization.

    Workspaces allow administrators to manage user access across multiple projects
    simultaneously. Users added to a workspace automatically gain access to all
    projects within that workspace, eliminating the need to add them individually.

    Related models accessed via:
        - workspace.members.all() → WorkspaceMember objects (user-workspace links)
        - workspace.workspace_projects.all() → WorkspaceProject objects (workspace-project links)
    """

    title = models.CharField(
        _('title'),
        max_length=500,
        help_text='Workspace name'
    )

    description = models.TextField(
        _('description'),
        blank=True,
        default='',
        help_text='Workspace description'
    )

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='workspaces',
        help_text='Organization this workspace belongs to'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_workspaces',
        help_text='User who created this workspace'
    )

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    deleted_at = models.DateTimeField(
        _('deleted at'),
        default=None,
        null=True,
        blank=True,
        db_index=True,
        help_text='Timestamp when workspace was deleted (null if active)'
    )

    class Meta:
        db_table = 'workspace'
        ordering = ['title']
        indexes = [
            models.Index(fields=['organization', 'deleted_at']),
            models.Index(fields=['title']),
        ]

    def __str__(self):
        return f"{self.title} ({self.organization.title})"

    def is_active(self):
        """Check if workspace is active (not soft-deleted)."""
        return self.deleted_at is None

    def soft_delete(self):
        """
        Soft delete this workspace by setting deleted_at timestamp.
        Preserves data for audit purposes instead of hard deletion.
        """
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])


class WorkspaceMember(models.Model):
    """
    User membership in a workspace with optional role override.

    Links users to workspaces and grants them access to all projects within the workspace.
    When a user is added to a workspace, ProjectMember records are automatically created
    for each project in the workspace (handled by api.WorkspaceViewSet.add_member).

    Role inheritance:
        - If role_override is set, uses that role for workspace projects
        - Otherwise falls back to the user's organization role
        - See get_effective_role() method for resolution logic

    Related models accessed via:
        - member.user → User object
        - member.workspace → Workspace object
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workspace_memberships',
        help_text='User with workspace access'
    )

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='members',
        help_text='Workspace the user belongs to'
    )

    role_override = models.CharField(
        _('role override'),
        max_length=20,
        null=True,
        blank=True,
        help_text='Optional role override for this workspace (defaults to org role)'
    )

    enabled = models.BooleanField(
        _('enabled'),
        default=True,
        help_text='Whether this membership is active'
    )

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    class Meta:
        db_table = 'workspace_member'
        unique_together = [['user', 'workspace']]
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['workspace', 'enabled']),
            models.Index(fields=['user', 'enabled']),
        ]

    def __str__(self):
        return f"{self.user.email} in {self.workspace.title}"

    def get_effective_role(self):
        """
        Compute the user's effective role for this workspace.

        Role resolution priority:
            1. If role_override is set, use it
            2. Otherwise fall back to user's organization role
            3. Default to 'annotator' if no organization membership found

        Returns:
            str: One of 'owner', 'admin', 'reviewer', 'annotator'

        Used by:
            - serializers.WorkspaceMemberSerializer (API responses)
            - API views for permission checks
            - Admin interface for display
        """
        if self.role_override:
            return self.role_override

        org_member = OrganizationMember.objects.filter(
            user=self.user,
            organization=self.workspace.organization,
            deleted_at__isnull=True
        ).first()

        return org_member.role if org_member else 'annotator'


class WorkspaceProject(models.Model):
    """
    Association between a workspace and a project with ordering.

    Links projects to workspaces to enable group-based access control. When a project
    is added to a workspace, all workspace members automatically gain access to it
    (handled by api.WorkspaceViewSet.add_project).

    A project can belong to multiple workspaces, and each association maintains
    independent ordering via the position field.

    Related models accessed via:
        - workspace_project.workspace → Workspace object
        - workspace_project.project → Project object
    """

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='workspace_projects',
        help_text='Workspace containing this project'
    )

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='workspace_memberships',
        help_text='Project in this workspace'
    )

    position = models.IntegerField(
        _('position'),
        default=0,
        help_text='Display order in workspace UI'
    )

    added_at = models.DateTimeField(_('added at'), auto_now_add=True)

    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text='User who added project to workspace'
    )

    class Meta:
        db_table = 'workspace_project'
        unique_together = [['workspace', 'project']]
        ordering = ['position', 'added_at']
        indexes = [
            models.Index(fields=['workspace']),
            models.Index(fields=['project']),
        ]

    def __str__(self):
        return f"{self.project.title} in {self.workspace.title}"
