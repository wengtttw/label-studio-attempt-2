"""
URL routing configuration for workspace endpoints.

This module defines both API and frontend routes for the workspace RBAC extension.
Uses manual path() definitions rather than DRF's DefaultRouter for precise control
over URL patterns, matching Label Studio's existing URL configuration style.

URL patterns defined:
    API endpoints (under /api/workspaces/):
        - GET/POST /api/workspaces/ - List and create workspaces
        - GET/PATCH/DELETE /api/workspaces/:pk/ - Retrieve, update, delete workspace
        - POST /api/workspaces/:pk/add-member/ - Add user to workspace
        - POST /api/workspaces/:pk/remove-member/ - Remove user from workspace
        - POST /api/workspaces/:pk/add-project/ - Add project to workspace
        - POST /api/workspaces/:pk/remove-project/ - Remove project from workspace

    Frontend routes (serve React SPA):
        - /workspaces/ - Workspaces list page
        - /workspaces/:pk/ - Workspace detail page

Upstream dependencies (what this imports):
    - django.urls: Django URL routing utilities
    - core.views.main: Label Studio's main view handler for React SPA
    - api.WorkspaceViewSet: API view class with all endpoint handlers

Downstream consumers (what uses these routes):
    - Frontend: ApiConfig.js defines endpoint mappings that call these URLs
    - Django: Includes these patterns in core/urls.py via re_path(r'^', include(...))

Integration with Label Studio:
    - Frontend routes use core_views.main which loads the React app
    - Client-side routing then handles /workspaces/* navigation
    - API routes are separate from frontend routes (different base paths)
    - Namespace 'workspaces:api' allows URL reversal in code

URL design pattern:
    - RESTful resource-based URLs for standard CRUD operations
    - Custom action endpoints for workspace-specific operations
    - Follows Label Studio's convention of POST for custom actions
"""

from django.urls import path, include
from core import views as core_views
from . import api

app_name = 'workspaces'

# API endpoint definitions (accessible at /api/workspaces/*)
_api_urlpatterns = [
    path(
        '',
        api.WorkspaceViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='workspace-list'
    ),

    path(
        '<int:pk>/',
        api.WorkspaceViewSet.as_view({
            'get': 'retrieve',
            'patch': 'partial_update',
            'delete': 'destroy'
        }),
        name='workspace-detail'
    ),

    path(
        '<int:pk>/add-member/',
        api.WorkspaceViewSet.as_view({'post': 'add_member'}),
        name='workspace-add-member'
    ),

    path(
        '<int:pk>/remove-member/',
        api.WorkspaceViewSet.as_view({'post': 'remove_member'}),
        name='workspace-remove-member'
    ),

    path(
        '<int:pk>/add-project/',
        api.WorkspaceViewSet.as_view({'post': 'add_project'}),
        name='workspace-add-project'
    ),

    path(
        '<int:pk>/remove-project/',
        api.WorkspaceViewSet.as_view({'post': 'remove_project'}),
        name='workspace-remove-project'
    ),
]

# Main URL configuration
urlpatterns = [
    # API routes - handled by WorkspaceViewSet
    path('api/workspaces/', include((_api_urlpatterns, app_name), namespace='api')),

    # Frontend routes - handled by core_views.main (loads React app)
    # React Router takes over client-side navigation from here
    path('workspaces/', core_views.main, name='workspaces-list'),
    path('workspaces/<int:pk>/', core_views.main, name='workspaces-detail'),
]
