"""
REST API endpoints for workspace management in Label Studio.

This module provides HTTP API endpoints for managing workspaces, including operations
to create, list, update, and delete workspaces, as well as managing workspace membership
and project associations. The API enforces role-based access control through permission
checks and implements automatic cascading behavior for related entities.

Upstream Dependencies:
    - Django REST Framework (viewsets, decorators, Response, permissions)
    - Django ORM (models, queryset operations, soft deletes)
    - Django authentication (get_user_model, user sessions)
    - Workspace models (Workspace, WorkspaceMember, WorkspaceProject)
    - Organization models (Organization, OrganizationMember)
    - Project models (Project, ProjectMember)
    - Serializers (WorkspaceSerializer, WorkspaceDetailSerializer, etc.)
    - Permission helpers (can_view_workspace, can_manage_workspace)

Downstream Consumers:
    - Frontend React components via HTTP API calls
    - ApiConfig.js defines the endpoint mappings
    - Workspace management UI components consume these endpoints
    - Project provider and workspace provider use these APIs

Auto-Cascade Behavior:
    - When adding a member to a workspace, they are automatically added to all projects
      in that workspace as ProjectMember with enabled=True
    - When adding a project to a workspace, all enabled workspace members are automatically
      granted access to that project as ProjectMember with enabled=True
    - When removing a member from a workspace, cascade options control project membership:
        * 'none': Only removes from workspace, leaves project memberships unchanged
        * 'disable': Sets enabled=False on project memberships
        * 'remove': Soft deletes project memberships by setting deleted_at timestamp

Permission Model:
    - IsAuthenticated: Required for all endpoints
    - can_manage_workspace: Required for create, update, delete, add/remove members/projects
    - Queryset filtering: Admins/owners see all workspaces, regular users see only their own
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Workspace, WorkspaceMember, WorkspaceProject
from .serializers import (
    WorkspaceSerializer,
    WorkspaceDetailSerializer,
    WorkspaceMemberSerializer,
    WorkspaceProjectSerializer,
)
from .permissions import can_view_workspace, can_manage_workspace
from organizations.models import Organization, OrganizationMember
from projects.models import Project, ProjectMember

User = get_user_model()


class WorkspaceViewSet(viewsets.ModelViewSet):
    """API endpoints for workspace CRUD operations"""

    permission_classes = [IsAuthenticated]
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        """
        Filter workspaces based on user role within their active organization.

        Returns different workspace querysets depending on the user's organization role:
        - Organization owners and admins: Can see all workspaces in the organization
        - Regular users: Can only see workspaces where they have an enabled membership

        This implements the visibility model where admins have full visibility for
        management purposes, while regular users only see their assigned workspaces.
        The queryset excludes soft-deleted workspaces (deleted_at is not null) and
        disabled workspace memberships (enabled=False).

        Returns:
            QuerySet: Filtered Workspace queryset based on user role and membership
        """
        user = self.request.user
        org = user.active_organization

        if not org:
            return Workspace.objects.none()

        org_member = OrganizationMember.objects.filter(
            user=user,
            organization=org,
            deleted_at__isnull=True
        ).first()

        if org_member and org_member.role in ['owner', 'admin']:
            return Workspace.objects.filter(
                organization=org,
                deleted_at__isnull=True
            )
        else:
            return Workspace.objects.filter(
                members__user=user,
                members__enabled=True,
                organization=org,
                deleted_at__isnull=True
            ).distinct()

    def get_serializer_class(self):
        """Use detailed serializer on retrieve"""
        if self.action == 'retrieve':
            return WorkspaceDetailSerializer
        return WorkspaceSerializer

    def perform_create(self, serializer):
        """
        Create a new workspace and automatically add the creator as a member.

        When a user creates a workspace, they are automatically added as an enabled
        workspace member. This ensures the creator has immediate access to the workspace
        they just created and can begin adding projects and other members.

        The workspace is associated with the user's active organization and tracks
        who created it via the created_by field for audit purposes.
        """
        workspace = serializer.save(
            created_by=self.request.user,
            organization=self.request.user.active_organization
        )

        WorkspaceMember.objects.create(
            user=self.request.user,
            workspace=workspace,
            enabled=True
        )

    def perform_destroy(self, instance):
        """Soft delete workspace"""
        if not can_manage_workspace(self.request.user, instance):
            raise PermissionDenied('You do not have permission to delete this workspace')
        instance.soft_delete()

    def perform_update(self, serializer):
        """Update workspace"""
        if not can_manage_workspace(self.request.user, serializer.instance):
            raise PermissionDenied('You do not have permission to update this workspace')
        serializer.save()

    @action(detail=True, methods=['post'], url_path='add-member')
    def add_member(self, request, pk=None):
        """
        Add a user to a workspace and automatically grant access to all workspace projects.

        This endpoint creates or updates a WorkspaceMember record and then automatically
        creates ProjectMember records for every project currently in the workspace. This
        ensures workspace members immediately have access to all workspace projects.

        Request Format:
            POST /api/workspaces/{pk}/add-member/
            {
                "user_id": <int>,
                "role_override": <string, optional>
            }

        Response Format:
            {
                "member": {<WorkspaceMember serialized data>},
                "projects_auto_added": <int>
            }

        The auto-cascade behavior ensures consistency where workspace membership implies
        project access. If the user already exists as a ProjectMember, their membership
        is updated to enabled=True and deleted_at=None to restore access if previously
        disabled or soft-deleted.

        Returns:
            HTTP 201 if member was newly created
            HTTP 200 if existing member was updated
            HTTP 403 if user lacks manage permission
            HTTP 404 if user_id not found
            HTTP 400 if validation fails
        """
        workspace = self.get_object()

        if not can_manage_workspace(request.user, workspace):
            return Response(
                {'error': 'You do not have permission to manage this workspace'},
                status=status.HTTP_403_FORBIDDEN
            )

        user_id = request.data.get('user_id')
        role_override = request.data.get('role_override')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(pk=user_id)
            org_member = OrganizationMember.objects.get(
                user=user,
                organization=workspace.organization,
                deleted_at__isnull=True
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except OrganizationMember.DoesNotExist:
            return Response(
                {'error': 'User is not a member of this organization'},
                status=status.HTTP_400_BAD_REQUEST
            )

        member, created = WorkspaceMember.objects.update_or_create(
            user_id=user_id,
            workspace=workspace,
            defaults={
                'enabled': True,
                'role_override': role_override
            }
        )

        projects_added = 0
        workspace_projects = WorkspaceProject.objects.filter(workspace=workspace)

        for workspace_project in workspace_projects:
            ProjectMember.objects.update_or_create(
                user=user,
                project=workspace_project.project,
                defaults={
                    'enabled': True,
                    'deleted_at': None
                }
            )
            projects_added += 1

        serializer = WorkspaceMemberSerializer(member)
        return Response({
            'member': serializer.data,
            'projects_auto_added': projects_added
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        """
        Remove a user from a workspace with configurable cascade behavior for projects.

        This endpoint disables the WorkspaceMember record and optionally cascades the
        removal to the user's ProjectMember records for all projects in the workspace.
        The cascade behavior is controlled by the cascade_to_projects parameter.

        Request Format:
            POST /api/workspaces/{pk}/remove-member/
            {
                "user_id": <int>,
                "cascade_to_projects": <string, default='disable'>
            }

        Response Format:
            {
                "message": "User removed from workspace",
                "cascade": <string>,
                "projects_affected": <int>
            }

        Cascade Options:
            - 'none': Only sets WorkspaceMember.enabled=False, leaves project memberships
              unchanged. Use when the user should retain direct project access despite
              losing workspace membership.
            - 'disable': Sets WorkspaceMember.enabled=False and ProjectMember.enabled=False
              for all workspace projects. This preserves the membership records but revokes
              access, allowing easy re-enabling later.
            - 'remove': Sets WorkspaceMember.enabled=False and ProjectMember.deleted_at
              to current timestamp for all workspace projects. This soft-deletes the project
              memberships, treating them as fully removed while preserving audit history.

        Returns:
            HTTP 200 on success
            HTTP 403 if user lacks manage permission
            HTTP 404 if user_id not a member
            HTTP 400 if validation fails
        """
        workspace = self.get_object()

        if not can_manage_workspace(request.user, workspace):
            return Response(
                {'error': 'You do not have permission to manage this workspace'},
                status=status.HTTP_403_FORBIDDEN
            )

        user_id = request.data.get('user_id')
        cascade = request.data.get('cascade_to_projects', 'disable')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if cascade not in ['none', 'disable', 'remove']:
            return Response(
                {'error': 'cascade_to_projects must be one of: none, disable, remove'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated = WorkspaceMember.objects.filter(
            user_id=user_id,
            workspace=workspace
        ).update(enabled=False)

        if updated == 0:
            return Response(
                {'error': 'User is not a member of this workspace'},
                status=status.HTTP_404_NOT_FOUND
            )

        projects_affected = 0
        if cascade in ['disable', 'remove']:
            project_ids = WorkspaceProject.objects.filter(
                workspace=workspace
            ).values_list('project_id', flat=True)

            if cascade == 'disable':
                projects_affected = ProjectMember.objects.filter(
                    user_id=user_id,
                    project_id__in=project_ids,
                    deleted_at__isnull=True
                ).update(enabled=False)

            elif cascade == 'remove':
                projects_affected = ProjectMember.objects.filter(
                    user_id=user_id,
                    project_id__in=project_ids,
                    deleted_at__isnull=True
                ).update(deleted_at=timezone.now())

        return Response({
            'message': 'User removed from workspace',
            'cascade': cascade,
            'projects_affected': projects_affected
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='add-project')
    def add_project(self, request, pk=None):
        """
        Add a project to a workspace and automatically grant access to all members.

        This endpoint creates a WorkspaceProject association and then automatically
        creates or updates ProjectMember records for every enabled member of the
        workspace. This ensures all workspace members immediately gain access to
        newly added projects.

        Request Format:
            POST /api/workspaces/{pk}/add-project/
            {
                "project_id": <int>
            }

        Response Format:
            {
                "project": {<WorkspaceProject serialized data>},
                "members_auto_added": <int>
            }

        The auto-cascade behavior ensures consistency where project addition to a
        workspace implies access for all workspace members. If a user already exists
        as a ProjectMember, their membership is updated to enabled=True and
        deleted_at=None to restore access if previously disabled or soft-deleted.

        The project must belong to the same organization as the workspace to prevent
        cross-organization access violations.

        Returns:
            HTTP 201 on successful creation
            HTTP 403 if user lacks manage permission
            HTTP 404 if project_id not found or wrong organization
            HTTP 400 if project already in workspace or validation fails
        """
        workspace = self.get_object()

        if not can_manage_workspace(request.user, workspace):
            return Response(
                {'error': 'You do not have permission to manage this workspace'},
                status=status.HTTP_403_FORBIDDEN
            )

        project_id = request.data.get('project_id')

        if not project_id:
            return Response(
                {'error': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            project = Project.objects.get(
                pk=project_id,
                organization=workspace.organization
            )
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found or not in same organization'},
                status=status.HTTP_404_NOT_FOUND
            )

        workspace_project, created = WorkspaceProject.objects.get_or_create(
            workspace=workspace,
            project=project,
            defaults={'added_by': request.user}
        )

        if not created:
            return Response(
                {'error': 'Project already in workspace'},
                status=status.HTTP_400_BAD_REQUEST
            )

        members_added = 0
        workspace_members = WorkspaceMember.objects.filter(
            workspace=workspace,
            enabled=True
        )

        for member in workspace_members:
            ProjectMember.objects.update_or_create(
                user=member.user,
                project=project,
                defaults={
                    'enabled': True,
                    'deleted_at': None
                }
            )
            members_added += 1

        serializer = WorkspaceProjectSerializer(workspace_project)
        return Response({
            'project': serializer.data,
            'members_auto_added': members_added
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='remove-project')
    def remove_project(self, request, pk=None):
        """
        Remove a project from a workspace.

        This endpoint deletes the WorkspaceProject association between the workspace
        and project. Unlike remove_member, this operation does not cascade to project
        memberships. Users who were granted access via workspace membership will retain
        their ProjectMember records, allowing them to continue accessing the project
        even after it's removed from the workspace.

        Request Format:
            POST /api/workspaces/{pk}/remove-project/
            {
                "project_id": <int>
            }

        This design choice allows projects to maintain their access control independently
        after being removed from workspaces. If you need to revoke access, use the
        remove_member endpoint with appropriate cascade options instead.

        Returns:
            HTTP 204 on successful deletion
            HTTP 403 if user lacks manage permission
            HTTP 404 if project not in workspace
            HTTP 400 if validation fails
        """
        workspace = self.get_object()

        if not can_manage_workspace(request.user, workspace):
            return Response(
                {'error': 'You do not have permission to manage this workspace'},
                status=status.HTTP_403_FORBIDDEN
            )

        project_id = request.data.get('project_id')

        if not project_id:
            return Response(
                {'error': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        deleted, _ = WorkspaceProject.objects.filter(
            workspace=workspace,
            project_id=project_id
        ).delete()

        if deleted == 0:
            return Response(
                {'error': 'Project not found in workspace'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
