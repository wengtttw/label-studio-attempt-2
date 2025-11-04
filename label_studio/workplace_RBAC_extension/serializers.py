"""
Serializers for transforming workspace models to/from JSON.

This module provides Django REST Framework serializers for the workspace RBAC system.
Serializers handle the conversion between Django model instances and JSON representations
for API requests and responses.

Serializers defined:
    - WorkspaceSerializer: Basic workspace representation for list views
    - WorkspaceDetailSerializer: Extended representation with members and projects
    - WorkspaceMemberSerializer: User membership in a workspace
    - WorkspaceProjectSerializer: Project association with a workspace

Upstream dependencies (what this imports):
    - rest_framework.serializers: DRF base serializer classes
    - models: Workspace, WorkspaceMember, WorkspaceProject
    - users.serializers.UserSimpleSerializer: For nested user representation

Downstream consumers (what uses these):
    - api.WorkspaceViewSet: Uses these serializers for all API operations
    - Frontend: Receives JSON output from these serializers

Data transformation patterns:
    - Read-only computed fields (member_count, project_count, effective_role)
    - Write-only input fields (user_id, project_id for creation)
    - Nested serializers (UserSimpleSerializer for user details)
    - Field sourcing (workspace.title via source parameter)
    - SerializerMethodField for complex queries (get_members, get_projects)

Performance notes:
    - WorkspaceDetailSerializer uses select_related('project') to avoid N+1 queries
    - Computed counts query the database on each access (could be optimized with annotations)
    - Nested serialization may cause additional queries for large datasets
"""

from rest_framework import serializers
from .models import Workspace, WorkspaceMember, WorkspaceProject
from users.serializers import UserSimpleSerializer


class WorkspaceSerializer(serializers.ModelSerializer):
    """
    Basic workspace serializer for list views and simple operations.

    Provides workspace details with computed member and project counts.
    Used for GET /api/workspaces/ (list view) and POST/PATCH operations.

    Computed fields:
        - member_count: Number of enabled members in workspace
        - project_count: Number of projects in workspace

    Read-only fields:
        - created_at, updated_at: Automatically managed timestamps
        - created_by: Set from request.user in view
        - organization: Set from request.user.active_organization in view
    """
    member_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = [
            'id',
            'title',
            'description',
            'organization',
            'created_by',
            'created_at',
            'updated_at',
            'member_count',
            'project_count',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'organization']

    def get_member_count(self, obj):
        """Count active (enabled) members in this workspace."""
        return obj.members.filter(enabled=True).count()

    def get_project_count(self, obj):
        """Count total projects associated with this workspace."""
        return obj.workspace_projects.count()


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """
    Serializer for workspace membership records.

    Handles both reading existing memberships and creating new ones through the API.
    Includes computed effective_role field that considers both role_override and org role.

    Field patterns:
        - user (read): Nested UserSimpleSerializer with user details
        - user_id (write): Integer ID for creating memberships
        - effective_role (read): Computed from WorkspaceMember.get_effective_role()
        - workspace_title (read): Denormalized for display convenience

    Usage:
        - Reading: Returns full user object with email, name, etc.
        - Writing: Accepts user_id to create/update membership
    """
    user = UserSimpleSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    effective_role = serializers.CharField(source='get_effective_role', read_only=True)
    workspace_title = serializers.CharField(source='workspace.title', read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = [
            'id',
            'user',
            'user_id',
            'workspace',
            'workspace_title',
            'role_override',
            'effective_role',
            'enabled',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class WorkspaceProjectSerializer(serializers.ModelSerializer):
    """
    Serializer for workspace-project associations.

    Handles linking projects to workspaces with optional custom ordering.

    Field patterns:
        - project_title (read): Denormalized project title for display
        - project_id (write): Integer ID for adding projects to workspace

    Usage:
        - Reading: Returns project title and position in workspace
        - Writing: Accepts project_id to create association
    """
    project_title = serializers.CharField(source='project.title', read_only=True)
    project_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = WorkspaceProject
        fields = [
            'id',
            'workspace',
            'project_id',
            'project_title',
            'position',
            'added_at',
            'added_by',
        ]
        read_only_fields = ['added_at', 'added_by']


class WorkspaceDetailSerializer(WorkspaceSerializer):
    """
    Extended workspace serializer with full member and project details.

    Inherits from WorkspaceSerializer and adds nested member and project lists.
    Used for GET /api/workspaces/:pk/ (detail view) to provide complete workspace data.

    Additional fields:
        - members: List of enabled WorkspaceMember objects with user details
        - projects: List of projects with titles, descriptions, positions

    Performance:
        - Uses select_related('project') for efficient project queries
        - May cause N queries for member user details (consider prefetch_related)
        - Suitable for single workspace detail views, not bulk operations
    """
    members = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()

    class Meta(WorkspaceSerializer.Meta):
        fields = WorkspaceSerializer.Meta.fields + ['members', 'projects']

    def get_members(self, obj):
        """
        Get all enabled members in this workspace with full user details.
        Filters out disabled memberships to show only active members.
        """
        enabled_members = obj.members.filter(enabled=True)
        return WorkspaceMemberSerializer(enabled_members, many=True).data

    def get_projects(self, obj):
        """
        Get all projects in this workspace with metadata.
        Uses select_related('project') to fetch projects efficiently in a single query.
        Returns custom dict structure rather than using WorkspaceProjectSerializer.
        """
        workspace_projects = obj.workspace_projects.select_related('project').all()
        return [{
            'id': wp.project.id,
            'title': wp.project.title,
            'description': wp.project.description,
            'position': wp.position,
            'added_at': wp.added_at,
        } for wp in workspace_projects]
