"""
Workspace RBAC Extension for Label Studio.

This Django app extends Label Studio with workspace-based access control, allowing
administrators to group multiple projects together and manage user access at the
workspace level instead of individually per project.

Key features:
    - Group multiple projects into logical workspaces
    - Add users to workspaces once to grant access to all contained projects
    - Optional role overrides at the workspace level
    - Automatic cascade when adding members or projects
    - Soft delete pattern for data retention

Module structure:
    - models.py: Workspace, WorkspaceMember, WorkspaceProject data models
    - api.py: DRF ViewSet with REST API endpoints
    - permissions.py: Access control functions using django-rules
    - serializers.py: JSON transformation for API responses
    - admin.py: Django admin interface configuration
    - urls.py: URL routing for API and frontend

Integration points:
    - Registered in INSTALLED_APPS in core/settings/base.py
    - URLs included in core/urls.py
    - Frontend pages registered in web/apps/labelstudio/src/pages/index.js
    - Uses existing Organization and Project models via foreign keys

Upstream dependencies:
    - organizations.Organization: Parent organization for workspaces
    - projects.Project: Projects being grouped in workspaces
    - users.User: User references for memberships

Downstream consumers:
    - Frontend React application (WorkspacesPage component)
    - Django admin interface
    - API clients making HTTP requests to /api/workspaces/*
"""

__version__ = '1.0.0'
__author__ = 'Label Studio Team'

default_app_config = 'label_studio.workplace_RBAC_extension.apps.WorkspaceRBACExtensionConfig'
