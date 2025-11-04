"""
Access control functions for workspace RBAC system.

This module implements permission checking for workspace operations using the
django-rules pattern employed throughout Label Studio. Unlike some Label Studio
components, these functions are plain Python functions (not @rules.predicate decorators)
and are registered via rules.add_perm() at module load time.

Permission functions defined:
    - can_view_workspace: Read access check for workspaces
    - can_manage_workspace: Write/admin access check for workspaces
    - has_workspace_access_to_project: Check project access via workspace membership
    - has_project_access_combined: Combined check for direct + workspace access

Upstream dependencies (what this imports):
    - rules: Django-rules library for permission registration
    - organizations.models.OrganizationMember: For org-level role checks
    - Workspace, WorkspaceMember, WorkspaceProject: From local models

Downstream consumers (what calls these):
    - api.WorkspaceViewSet: Uses can_view_workspace and can_manage_workspace
    - serializers: May use for conditional field display
    - templates: Can use rules.test_rule() in template logic
    - Future: Could integrate with projects.permissions for unified access control

Integration with Label Studio's permission system:
    - Follows same pattern as organizations.permissions and projects.permissions
    - Compatible with django-rules middleware and decorators
    - Respects organization boundaries (users cannot access cross-org workspaces)
    - Can be composed with existing project permissions

Performance notes:
    - Each check performs 1-2 database queries (org membership + workspace membership)
    - Django-rules caches results per request cycle
    - Uses .filter().first() pattern for null safety
"""

import rules
from organizations.models import OrganizationMember
from .models import Workspace, WorkspaceMember, WorkspaceProject


def can_view_workspace(user, workspace):
    """
    Check if user can view a workspace.

    Permission granted if user is either:
        - Organization owner or admin (can view all org workspaces)
        - Workspace member with enabled=True

    Args:
        user: Django User object
        workspace: Workspace instance

    Returns:
        bool: True if user can view workspace, False otherwise

    Database queries: 1-2 (org membership check, optionally workspace membership check)

    Used by:
        - api.WorkspaceViewSet.get_queryset() for list filtering
        - api.WorkspaceViewSet.retrieve() for detail view access
    """
    if workspace is None:
        return False

    if not user or not user.is_authenticated:
        return False

    # Check organization role
    org_member = OrganizationMember.objects.filter(
        user=user,
        organization=workspace.organization,
        deleted_at__isnull=True
    ).first()

    if org_member and org_member.role in ['owner', 'admin']:
        return True

    # Check workspace membership
    return WorkspaceMember.objects.filter(
        user=user,
        workspace=workspace,
        enabled=True
    ).exists()


def can_manage_workspace(user, workspace):
    """
    Check if user can manage a workspace.

    Permission granted only if user is organization owner or admin.
    Regular workspace members cannot manage workspaces, only view them.

    Management operations include:
        - Creating workspaces
        - Updating workspace metadata
        - Deleting (soft-deleting) workspaces
        - Adding/removing members
        - Adding/removing projects

    Args:
        user: Django User object
        workspace: Workspace instance

    Returns:
        bool: True if user is org owner/admin, False otherwise

    Database queries: 1 (org membership check)

    Used by:
        - api.WorkspaceViewSet.perform_create()
        - api.WorkspaceViewSet.perform_update()
        - api.WorkspaceViewSet.perform_destroy()
        - api.WorkspaceViewSet.add_member()
        - api.WorkspaceViewSet.remove_member()
        - api.WorkspaceViewSet.add_project()
        - api.WorkspaceViewSet.remove_project()
    """
    if workspace is None:
        return False

    if not user or not user.is_authenticated:
        return False

    org_member = OrganizationMember.objects.filter(
        user=user,
        organization=workspace.organization,
        deleted_at__isnull=True
    ).first()

    return org_member and org_member.role in ['owner', 'admin']


def has_workspace_access_to_project(user, project):
    """
    Check if user can access project through workspace membership.

    This is a helper function that checks workspace-based access only.
    It does NOT check direct ProjectMember access or organization roles.
    For combined access checking, use has_project_access_combined().

    Logic:
        1. Find all workspaces containing the project
        2. Check if user is an enabled member of any of those workspaces

    Args:
        user: Django User object
        project: Project instance

    Returns:
        bool: True if user is member of any workspace containing the project

    Database queries: 2 (workspace lookup via WorkspaceProject, membership check)

    Integration point:
        This function can be called from project views/serializers to extend
        existing project access control with workspace-based access.

    Used by:
        - has_project_access_combined() for unified access checking
        - Future: Could integrate with projects.api for queryset filtering
    """
    if project is None:
        return False

    if not user or not user.is_authenticated:
        return False

    # Find all workspaces containing this project
    workspace_ids = WorkspaceProject.objects.filter(
        project=project
    ).values_list('workspace_id', flat=True)

    if not workspace_ids:
        return False

    # Check if user is in any of those workspaces
    return WorkspaceMember.objects.filter(
        user=user,
        workspace_id__in=workspace_ids,
        enabled=True
    ).exists()


def has_project_access_combined(user, project):
    """
    Combined check for project access through direct membership OR workspace membership.

    This function provides a unified access check that respects both:
        - Existing direct project access (ProjectMember with enabled=True)
        - New workspace-based access (WorkspaceMember + WorkspaceProject)

    Logic:
        1. Check direct ProjectMember access (existing Label Studio logic)
        2. If no direct access, check workspace-based access
        3. Grant access if either path succeeds

    Args:
        user: Django User object
        project: Project instance

    Returns:
        bool: True if user has access via either direct or workspace membership

    Database queries: 2-3 (project member check, optionally workspace checks)

    Integration point:
        This function can be used in project views to extend existing permission
        checks with workspace support. For example, in project serializers or
        viewsets, replace direct ProjectMember checks with this combined check.

    Example usage in project API:
        # Instead of:
        if not ProjectMember.objects.filter(user=user, project=project).exists():
            raise PermissionDenied()

        # Use:
        if not has_project_access_combined(user, project):
            raise PermissionDenied()
    """
    from projects.models import ProjectMember

    if project is None:
        return False

    if not user or not user.is_authenticated:
        return False

    # Check direct project membership (existing logic)
    has_direct_access = ProjectMember.objects.filter(
        user=user,
        project=project,
        enabled=True,
        deleted_at__isnull=True
    ).exists()

    if has_direct_access:
        return True

    # Check workspace access (new logic)
    return has_workspace_access_to_project(user, project)


# Register workspace-specific permissions with django-rules
# These follow Label Studio's permission naming convention: <app>.<operation>
# Rules are evaluated via rules.test_rule() in views/serializers/templates
rules.add_perm('workspaces.view', can_view_workspace)
rules.add_perm('workspaces.change', can_manage_workspace)
rules.add_perm('workspaces.delete', can_manage_workspace)
rules.add_perm('workspaces.add_member', can_manage_workspace)
rules.add_perm('workspaces.add_project', can_manage_workspace)
