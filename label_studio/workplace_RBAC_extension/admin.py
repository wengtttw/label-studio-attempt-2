"""
Django Admin configuration for Workspace models.

Provides admin interface for managing workspaces, memberships, and project associations
through Django's admin panel at /admin/workplace_RBAC_extension/.

Admin classes registered:
    - WorkspaceAdmin: Manage workspaces with soft-delete visibility
    - WorkspaceMemberAdmin: View/edit workspace memberships with effective role display
    - WorkspaceProjectAdmin: Manage project-workspace associations with ordering

Upstream dependencies (what this imports):
    - django.contrib.admin: Django admin framework
    - models: Workspace, WorkspaceMember, WorkspaceProject

Features:
    - List filtering by organization, dates, and enabled status
    - Search across workspace titles, user emails, and project names
    - Computed field display (is_active, effective_role)
    - Date-based hierarchy navigation
    - Fieldsets for organized editing
    - Shows soft-deleted workspaces (overrides default queryset)

Downstream consumers:
    - Django admin site accessible to superusers and staff
    - Useful for manual data inspection and troubleshooting
"""

from django.contrib import admin
from .models import Workspace, WorkspaceMember, WorkspaceProject


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    """Admin interface for Workspaces"""

    list_display = ['title', 'organization', 'created_by', 'created_at', 'is_active']
    list_filter = ['organization', 'created_at', 'deleted_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'organization')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at', 'deleted_at')
        }),
    )

    def is_active(self, obj):
        """Display active status as boolean icon"""
        return obj.is_active()
    is_active.boolean = True
    is_active.short_description = 'Active'

    def get_queryset(self, request):
        """Include deleted workspaces in admin"""
        qs = super().get_queryset(request)
        return qs  # Show all, including soft-deleted


@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    """Admin interface for Workspace Members"""

    list_display = ['user_email', 'workspace', 'get_effective_role', 'enabled', 'created_at']
    list_filter = ['workspace', 'enabled', 'created_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'workspace__title']
    readonly_fields = ['created_at', 'updated_at', 'get_effective_role']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Membership', {
            'fields': ('user', 'workspace', 'enabled')
        }),
        ('Role', {
            'fields': ('role_override', 'get_effective_role')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def user_email(self, obj):
        """Display user email in list"""
        return obj.user.email
    user_email.short_description = 'User Email'
    user_email.admin_order_field = 'user__email'

    def get_effective_role(self, obj):
        """Display effective role"""
        return obj.get_effective_role()
    get_effective_role.short_description = 'Effective Role'


@admin.register(WorkspaceProject)
class WorkspaceProjectAdmin(admin.ModelAdmin):
    """Admin interface for Workspace-Project relationships"""

    list_display = ['workspace', 'project', 'position', 'added_at', 'added_by']
    list_filter = ['workspace', 'added_at']
    search_fields = ['workspace__title', 'project__title']
    readonly_fields = ['added_at']
    date_hierarchy = 'added_at'
    ordering = ['workspace', 'position']

    fieldsets = (
        ('Relationship', {
            'fields': ('workspace', 'project', 'position')
        }),
        ('Metadata', {
            'fields': ('added_by', 'added_at')
        }),
    )
