# Workspace RBAC Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Current System Understanding](#current-system-understanding)
3. [Workspace RBAC Design](#workspace-rbac-design)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Integration with Existing Code](#integration-with-existing-code)
6. [Testing Strategy](#testing-strategy)

---

## Overview

### What We're Building
A **Workspace** system that allows Admins and Owners to:
- Group multiple projects together into a "workspace"
- Add a user to a workspace ONCE
- That user automatically gets access to ALL projects in that workspace
- Eliminates the need to add users one-by-one to individual projects

### Key Requirements
✅ **Minimal changes outside `workplace_RBAC_extension/` folder**
✅ **Same permissions and access controls as current system**
✅ **Same UI design principles**
✅ **New page with button linking from existing interface**

---

## Current System Understanding

### 1. Database Models (How Data is Stored)

#### User Model
**Location:** `label_studio/users/models.py:108`

```python
class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=256)
    last_name = models.CharField(max_length=256)
    active_organization = models.ForeignKey('organizations.Organization')
    # ... more fields
```

**What it means:** Each user has an email, name, and belongs to an organization.

---

#### Organization Model
**Location:** `label_studio/organizations/models.py:137`

```python
class Organization(models.Model):
    title = models.CharField(max_length=1000)
    users = models.ManyToManyField(User, through='OrganizationMember')
    created_by = models.OneToOneField(User)
    # ... more fields
```

**What it means:** An organization has many users. The relationship is managed through `OrganizationMember`.

---

#### OrganizationMember Model
**Location:** `label_studio/organizations/models.py:18`

```python
class OrganizationMember(models.Model):
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('reviewer', 'Reviewer'),
        ('annotator', 'Annotator'),
        ('inactive', 'Inactive'),
    ]

    user = models.ForeignKey(User, related_name='om_through')
    organization = models.ForeignKey(Organization)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    deleted_at = models.DateTimeField(null=True)  # Soft delete
```

**What it means:** This is the "bridge" between users and organizations. It stores:
- Which user
- Which organization
- What role they have (owner, admin, etc.)
- Whether they've been removed (deleted_at)

---

#### Project Model
**Location:** `label_studio/projects/models.py:117`

```python
class Project(models.Model):
    title = models.CharField(max_length=settings.PROJECT_TITLE_MAX_LEN)
    description = models.TextField(blank=True)
    organization = models.ForeignKey(Organization, related_name='projects')
    # ... many more fields for labeling configuration
```

**What it means:** Each project belongs to ONE organization and has settings for how tasks should be labeled.

---

#### ProjectMember Model
**Location:** `label_studio/projects/models.py:1288`

```python
class ProjectMember(models.Model):
    user = models.ForeignKey(User, related_name='project_memberships')
    project = models.ForeignKey(Project, related_name='members')
    enabled = models.BooleanField(default=True)
```

**What it means:** This is the "bridge" between users and projects. Currently, users must be added to EACH project individually.

---

### 2. Permission System (How Access is Controlled)

#### Permission Package: django-rules
**Location:** `label_studio/core/permissions.py:8`

Label Studio uses the `rules` package for permissions. This package allows you to define rules like:
- "Is this user an admin?"
- "Can this user edit this project?"

```python
import rules

# Example rule
@rules.predicate
def is_project_admin(user, project):
    return project.organization.members.filter(
        user=user,
        role__in=['owner', 'admin']
    ).exists()

# Register permission
rules.add_perm('projects.change', is_project_admin)
```

**How it works:**
1. You define a function that returns True/False
2. You attach it to a permission name like `'projects.change'`
3. In views/APIs, you check: `user.has_perm('projects.change', project_obj)`

---

#### Current Permission Checking
**Location:** `label_studio/core/permissions.py:13-50`

All permissions are defined in the `AllPermissions` class:
- `organizations_create`, `organizations_view`, `organizations_change`, `organizations_delete`
- `projects_create`, `projects_view`, `projects_change`, `projects_delete`
- `tasks_create`, `annotations_create`, etc.

**Example Permission Check in Code:**
```python
# In a Django REST Framework API view
class ProjectAPI(APIView):
    permission_required = all_permissions.projects_change

    def patch(self, request, pk):
        project = Project.objects.get(pk=pk)
        # Permission is automatically checked here
        # based on permission_required
```

---

### 3. Frontend Architecture (How UI Works)

#### Framework: React
**Location:** `web/apps/labelstudio/`

The frontend is built with **React**, a JavaScript library for building user interfaces.

**Key Concepts:**
- **Components**: Reusable UI pieces (like buttons, forms, lists)
- **Pages**: Full screens made up of components
- **Routing**: URLs that load different pages
- **API Calls**: Frontend talks to backend via REST APIs

#### UI Component Library
**Location:** Based on code imports like `@humansignal/ui`

Label Studio uses a custom component library with pre-built components:
- Buttons
- Forms
- Tables
- Modals (popup windows)
- Navigation menus

---

### 4. Current User Flow for Project Access

**Step 1:** Admin creates a project
**Step 2:** Admin goes to Project Settings → Members
**Step 3:** Admin adds User A to Project 1
**Step 4:** Admin adds User A to Project 2
**Step 5:** Admin adds User A to Project 3
...repeat for every project...

**Problem:** If you have 20 projects and want to add 1 person, you need to add them 20 times! ❌

---

## Workspace RBAC Design

### Our Solution: Workspaces

#### What is a Workspace?
A workspace is a **container for multiple projects**. When you add a user to a workspace, they automatically get access to ALL projects inside it.

```
Organization
├── Workspace: "Medical Imaging"
│   ├── Project: Chest X-Rays
│   ├── Project: Brain MRI
│   └── Project: CT Scans
│
└── Workspace: "NLP Projects"
    ├── Project: Sentiment Analysis
    ├── Project: Named Entity Recognition
    └── Project: Text Classification
```

**New Flow:**
**Step 1:** Admin creates workspace "Medical Imaging"
**Step 2:** Admin adds 3 projects to workspace
**Step 3:** Admin adds User A to workspace (just ONCE!)
**Step 4:** User A can now access all 3 projects ✅

---

### Database Design

#### New Models to Create

##### 1. Workspace Model
**File:** `workplace_RBAC_extension/models.py`

```python
from django.db import models
from django.conf import settings

class Workspace(models.Model):
    """
    A workspace groups multiple projects together.
    Think of it like a folder that contains projects.
    """

    # Basic Info
    title = models.CharField(
        max_length=500,
        help_text='Workspace name (e.g., "Medical Imaging Projects")'
    )
    description = models.TextField(
        blank=True,
        help_text='Optional description of what this workspace is for'
    )

    # Relationships
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='workspaces',
        help_text='Which organization this workspace belongs to'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_workspaces',
        help_text='Who created this workspace'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Soft delete support
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When workspace was deleted (null if active)'
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
        """Check if workspace is not deleted"""
        return self.deleted_at is None
```

**Why these fields:**
- `title`: So users know what the workspace is called
- `description`: Optional explanation (like "All medical imaging projects")
- `organization`: Every workspace belongs to an organization (just like projects do)
- `created_by`: Track who made it (helpful for auditing)
- `deleted_at`: Instead of truly deleting, we set this timestamp (can be restored later)

---

##### 2. WorkspaceMember Model
**File:** `workplace_RBAC_extension/models.py`

```python
class WorkspaceMember(models.Model):
    """
    Links a user to a workspace with a specific role.
    This is similar to ProjectMember but for workspaces.
    """

    # The person being given access
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workspace_memberships',
        help_text='Which user has access'
    )

    # The workspace they're joining
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='members',
        help_text='Which workspace they can access'
    )

    # Role in this workspace (inherits from organization)
    # We don't define new roles - we use organization roles
    # But we can override if needed in future
    role_override = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text='Optional: Override their organization role for this workspace'
    )

    # Status
    enabled = models.BooleanField(
        default=True,
        help_text='Whether this membership is active'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workspace_member'
        unique_together = [['user', 'workspace']]  # One membership per user per workspace
        indexes = [
            models.Index(fields=['workspace', 'enabled']),
            models.Index(fields=['user', 'enabled']),
        ]

    def __str__(self):
        return f"{self.user.email} in {self.workspace.title}"

    def get_effective_role(self):
        """
        Get the role this user has in the workspace.
        If role_override is set, use that. Otherwise use org role.
        """
        if self.role_override:
            return self.role_override

        # Get user's organization role
        org_member = OrganizationMember.objects.filter(
            user=self.user,
            organization=self.workspace.organization,
            deleted_at__isnull=True
        ).first()

        return org_member.role if org_member else 'annotator'
```

**Why these fields:**
- `user` + `workspace`: The core relationship (who has access to what)
- `role_override`: Allows future flexibility (maybe someone is an Admin in org but Reviewer in this workspace)
- `enabled`: Can temporarily disable without deleting
- `unique_together`: Prevents adding same user twice to same workspace

---

##### 3. WorkspaceProject Model
**File:** `workplace_RBAC_extension/models.py`

```python
class WorkspaceProject(models.Model):
    """
    Links projects to workspaces.
    A project can be in multiple workspaces (optional design choice).
    """

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='workspace_projects',
        help_text='The workspace containing this project'
    )

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='workspace_memberships',
        help_text='The project in this workspace'
    )

    # Order for display
    position = models.IntegerField(
        default=0,
        help_text='Order to show projects in workspace (for UI sorting)'
    )

    added_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+'
    )

    class Meta:
        db_table = 'workspace_project'
        unique_together = [['workspace', 'project']]  # Project appears once per workspace
        ordering = ['position', 'added_at']
        indexes = [
            models.Index(fields=['workspace']),
            models.Index(fields=['project']),
        ]

    def __str__(self):
        return f"{self.project.title} in {self.workspace.title}"
```

**Why this model:**
- Links projects to workspaces (many-to-many relationship)
- `position`: Allows dragging/dropping projects to reorder them in UI
- `added_by`: Track who added the project (for audit logs)

---

### Database Relationship Diagram

```
Organization (1) ────┐
                     │
                     ├──> (Many) Projects
                     │             │
                     │             │ (through WorkspaceProject)
                     │             │
                     └──> (Many) Workspaces
                                   │
                                   │ (through WorkspaceMember)
                                   │
                                   └──> (Many) Users
```

**In Plain English:**
- An Organization HAS many Workspaces
- A Workspace CONTAINS many Projects (via WorkspaceProject)
- A Workspace HAS many Users (via WorkspaceMember)
- When a User is in a Workspace, they can access all Projects in that Workspace

---

### Permission Logic

#### New Permission Rules

**File:** `workplace_RBAC_extension/permissions.py`

```python
import rules
from organizations.models import OrganizationMember
from .models import Workspace, WorkspaceMember, WorkspaceProject

# Rule: Can user view this workspace?
@rules.predicate
def can_view_workspace(user, workspace):
    """
    User can view workspace if:
    1. They are owner/admin in the organization, OR
    2. They are a member of the workspace
    """
    if workspace is None:
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


# Rule: Can user manage (edit/delete) this workspace?
@rules.predicate
def can_manage_workspace(user, workspace):
    """
    Only owners and admins can manage workspaces.
    """
    if workspace is None:
        return False

    org_member = OrganizationMember.objects.filter(
        user=user,
        organization=workspace.organization,
        deleted_at__isnull=True
    ).first()

    return org_member and org_member.role in ['owner', 'admin']


# Rule: Can user access project through workspace?
@rules.predicate
def has_workspace_access_to_project(user, project):
    """
    User can access project if they're in ANY workspace containing it.
    This EXTENDS the existing project access - doesn't replace it.
    """
    if project is None:
        return False

    # Find all workspaces containing this project
    workspace_ids = WorkspaceProject.objects.filter(
        project=project
    ).values_list('workspace_id', flat=True)

    # Check if user is in any of those workspaces
    return WorkspaceMember.objects.filter(
        user=user,
        workspace_id__in=workspace_ids,
        enabled=True
    ).exists()


# Register permissions
rules.add_perm('workspaces.view', can_view_workspace)
rules.add_perm('workspaces.change', can_manage_workspace)
rules.add_perm('workspaces.delete', can_manage_workspace)
rules.add_perm('workspaces.add_member', can_manage_workspace)
rules.add_perm('workspaces.add_project', can_manage_workspace)
```

**How These Work:**
1. **View Permission**: Any workspace member or org admin can see the workspace
2. **Manage Permission**: Only org owners/admins can edit workspaces
3. **Project Access**: If user is in workspace, they get access to ALL projects in it

---

#### Integration with Existing Project Permission

**File:** `workplace_RBAC_extension/permissions.py` (continued)

```python
# IMPORTANT: Extend existing project permission
# Don't replace it - ADD workspace access as another way to get in

# Get existing project view permission
existing_project_view_perm = rules.perm_exists('projects.view')

if existing_project_view_perm:
    # Combine: user can view project if EITHER:
    # - They have direct project access (existing), OR
    # - They have workspace access (our new feature)
    combined_rule = rules.peek_perm('projects.view') | has_workspace_access_to_project

    rules.remove_perm('projects.view')
    rules.add_perm('projects.view', combined_rule)
else:
    # Fallback if permission doesn't exist yet
    rules.add_perm('projects.view', has_workspace_access_to_project)
```

**What this means:**
- Users who already have direct project access → Still works ✅
- Users who have workspace access → Now also works ✅
- We're ADDING a new way to access projects, not removing the old way

---

## Step-by-Step Implementation

### Phase 1: Database Models (Backend)

#### Step 1.1: Create Models File

Create file: `workplace_RBAC_extension/models.py`

```python
"""
Workspace RBAC Extension Models

This module adds workspace functionality to Label Studio.
Workspaces allow grouping multiple projects and adding users
once to access all projects in the workspace.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from organizations.models import OrganizationMember

# Copy all three model classes from the "Database Design" section above:
# 1. Workspace
# 2. WorkspaceMember
# 3. WorkspaceProject
```

---

#### Step 1.2: Create Django Migration

**What is a migration?**
A migration is a file that tells Django how to change the database. It creates tables, adds columns, etc.

**Command to run:**
```bash
cd C:\Users\Admin\Desktop\Workitems\label-studio-attempt-2
python manage.py makemigrations workplace_RBAC_extension
```

This will create a file like: `workplace_RBAC_extension/migrations/0001_initial.py`

**Then apply it:**
```bash
python manage.py migrate workplace_RBAC_extension
```

This creates the actual database tables.

---

#### Step 1.3: Register Models in Admin (Optional but Helpful)

Create file: `workplace_RBAC_extension/admin.py`

```python
"""
Django Admin configuration for Workspace models.
This lets you view/edit workspaces in Django admin panel.
"""

from django.contrib import admin
from .models import Workspace, WorkspaceMember, WorkspaceProject


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    """Admin interface for Workspaces"""

    list_display = ['title', 'organization', 'created_by', 'created_at', 'is_active']
    list_filter = ['organization', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']

    def is_active(self, obj):
        return obj.is_active()
    is_active.boolean = True
    is_active.short_description = 'Active'


@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    """Admin interface for Workspace Members"""

    list_display = ['user', 'workspace', 'get_effective_role', 'enabled', 'created_at']
    list_filter = ['workspace', 'enabled', 'created_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'workspace__title']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WorkspaceProject)
class WorkspaceProjectAdmin(admin.ModelAdmin):
    """Admin interface for Workspace-Project relationships"""

    list_display = ['workspace', 'project', 'position', 'added_at', 'added_by']
    list_filter = ['workspace', 'added_at']
    search_fields = ['workspace__title', 'project__title']
    readonly_fields = ['added_at']
    ordering = ['workspace', 'position']
```

**Access admin at:** `http://localhost:8080/admin/` (after running Django)

---

### Phase 2: Permissions (Backend)

#### Step 2.1: Create Permissions File

Create file: `workplace_RBAC_extension/permissions.py`

Copy all the permission code from the "Permission Logic" section above.

---

#### Step 2.2: Register Permissions on Startup

Create file: `workplace_RBAC_extension/apps.py`

```python
"""
Django App Configuration for Workspace RBAC Extension.
This file runs when Django starts up.
"""

from django.apps import AppConfig


class WorkspaceRBACExtensionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'workplace_RBAC_extension'
    verbose_name = 'Workspace RBAC Extension'

    def ready(self):
        """
        Called when Django starts.
        Register our custom permissions here.
        """
        # Import permissions to register them
        from . import permissions  # noqa: F401
```

---

#### Step 2.3: Register App in Django Settings

**IMPORTANT: This is a change OUTSIDE our folder, but minimal!**

**File to edit:** `label_studio/core/settings/base.py`

Find the `INSTALLED_APPS` list (around line 100-200) and add:

```python
INSTALLED_APPS = [
    # ... existing apps ...
    'organizations',
    'projects',
    'tasks',
    # ... more existing apps ...

    # ADD THIS LINE:
    'workplace_RBAC_extension',  # ← Our new app!
]
```

**That's it for settings!** Only 1 line added.

---

### Phase 3: API (Backend)

APIs are how the frontend talks to the backend. We need endpoints for:
- List workspaces
- Create workspace
- Add user to workspace
- Add project to workspace
- etc.

#### Step 3.1: Create Serializers

**What is a serializer?**
It converts database objects to JSON (and vice versa). Example:

```python
Workspace object → {"id": 1, "title": "Medical", ...} → JSON
```

Create file: `workplace_RBAC_extension/serializers.py`

```python
"""
Serializers for Workspace RBAC Extension.
These convert database models to/from JSON for the API.
"""

from rest_framework import serializers
from .models import Workspace, WorkspaceMember, WorkspaceProject
from users.serializers import UserSimpleSerializer
from projects.serializers import ProjectSerializer


class WorkspaceSerializer(serializers.ModelSerializer):
    """
    Serializer for Workspace model.
    Converts workspace to JSON like:
    {
        "id": 1,
        "title": "Medical Imaging",
        "description": "All medical projects",
        ...
    }
    """

    # Add counts for UI
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
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_member_count(self, obj):
        """Count how many users in workspace"""
        return obj.members.filter(enabled=True).count()

    def get_project_count(self, obj):
        """Count how many projects in workspace"""
        return obj.workspace_projects.count()


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """
    Serializer for workspace members.
    """

    user = UserSimpleSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    effective_role = serializers.CharField(source='get_effective_role', read_only=True)
    workspace_name = serializers.CharField(source='workspace.title', read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = [
            'id',
            'user',
            'user_id',
            'workspace',
            'workspace_name',
            'role_override',
            'effective_role',
            'enabled',
            'created_at',
        ]
        read_only_fields = ['created_at']


class WorkspaceProjectSerializer(serializers.ModelSerializer):
    """
    Serializer for workspace-project relationships.
    """

    project = ProjectSerializer(read_only=True)
    project_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = WorkspaceProject
        fields = [
            'id',
            'workspace',
            'project',
            'project_id',
            'position',
            'added_at',
            'added_by',
        ]
        read_only_fields = ['added_at', 'added_by']


class WorkspaceDetailSerializer(WorkspaceSerializer):
    """
    Detailed workspace with members and projects included.
    Used when viewing a single workspace.
    """

    members = WorkspaceMemberSerializer(many=True, read_only=True)
    projects = serializers.SerializerMethodField()

    class Meta(WorkspaceSerializer.Meta):
        fields = WorkspaceSerializer.Meta.fields + ['members', 'projects']

    def get_projects(self, obj):
        """Get all projects in this workspace"""
        workspace_projects = obj.workspace_projects.select_related('project')
        return [{
            'id': wp.project.id,
            'title': wp.project.title,
            'description': wp.project.description,
            'position': wp.position,
        } for wp in workspace_projects]
```

---

#### Step 3.2: Create API Views

Create file: `workplace_RBAC_extension/api.py`

```python
"""
API Views for Workspace RBAC Extension.
These handle HTTP requests from the frontend.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Workspace, WorkspaceMember, WorkspaceProject
from .serializers import (
    WorkspaceSerializer,
    WorkspaceDetailSerializer,
    WorkspaceMemberSerializer,
    WorkspaceProjectSerializer,
)
from .permissions import can_view_workspace, can_manage_workspace
from organizations.models import Organization
from projects.models import Project


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    API endpoints for workspaces.

    List: GET /api/workspaces/
    Create: POST /api/workspaces/
    Retrieve: GET /api/workspaces/{id}/
    Update: PUT/PATCH /api/workspaces/{id}/
    Delete: DELETE /api/workspaces/{id}/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        """
        Return workspaces that user can access.
        """
        user = self.request.user
        org = user.active_organization

        if not org:
            return Workspace.objects.none()

        # Get workspaces where user is owner/admin of org
        # OR workspaces where user is a member
        from organizations.models import OrganizationMember

        org_member = OrganizationMember.objects.filter(
            user=user,
            organization=org,
            deleted_at__isnull=True
        ).first()

        if org_member and org_member.role in ['owner', 'admin']:
            # Admins see all workspaces in their org
            return Workspace.objects.filter(
                organization=org,
                deleted_at__isnull=True
            )
        else:
            # Regular users see only workspaces they're in
            return Workspace.objects.filter(
                members__user=user,
                members__enabled=True,
                organization=org,
                deleted_at__isnull=True
            ).distinct()

    def get_serializer_class(self):
        """
        Use detailed serializer for single workspace retrieval.
        """
        if self.action == 'retrieve':
            return WorkspaceDetailSerializer
        return WorkspaceSerializer

    def perform_create(self, serializer):
        """
        Save workspace with current user as creator.
        """
        serializer.save(
            created_by=self.request.user,
            organization=self.request.user.active_organization
        )

    @action(detail=True, methods=['post'], url_path='add-member')
    def add_member(self, request, pk=None):
        """
        Add a user to workspace.

        POST /api/workspaces/{id}/add-member/
        Body: {"user_id": 123, "role_override": "reviewer"}
        """
        workspace = self.get_object()

        # Check permission
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

        # Create or update membership
        member, created = WorkspaceMember.objects.update_or_create(
            user_id=user_id,
            workspace=workspace,
            defaults={
                'enabled': True,
                'role_override': role_override
            }
        )

        serializer = WorkspaceMemberSerializer(member)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        """
        Remove a user from workspace.

        POST /api/workspaces/{id}/remove-member/
        Body: {"user_id": 123}
        """
        workspace = self.get_object()

        if not can_manage_workspace(request.user, workspace):
            return Response(
                {'error': 'You do not have permission to manage this workspace'},
                status=status.HTTP_403_FORBIDDEN
            )

        user_id = request.data.get('user_id')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Disable membership
        WorkspaceMember.objects.filter(
            user_id=user_id,
            workspace=workspace
        ).update(enabled=False)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='add-project')
    def add_project(self, request, pk=None):
        """
        Add a project to workspace.

        POST /api/workspaces/{id}/add-project/
        Body: {"project_id": 456}
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

        # Verify project exists and is in same organization
        project = get_object_or_404(
            Project,
            pk=project_id,
            organization=workspace.organization
        )

        # Add to workspace
        workspace_project, created = WorkspaceProject.objects.get_or_create(
            workspace=workspace,
            project=project,
            defaults={'added_by': request.user}
        )

        serializer = WorkspaceProjectSerializer(workspace_project)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='remove-project')
    def remove_project(self, request, pk=None):
        """
        Remove a project from workspace.

        POST /api/workspaces/{id}/remove-project/
        Body: {"project_id": 456}
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

        WorkspaceProject.objects.filter(
            workspace=workspace,
            project_id=project_id
        ).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
```

---

#### Step 3.3: Create URL Routing

Create file: `workplace_RBAC_extension/urls.py`

```python
"""
URL routing for Workspace RBAC Extension.
Maps URLs to API views.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api import WorkspaceViewSet

# Create router
router = DefaultRouter()
router.register(r'workspaces', WorkspaceViewSet, basename='workspace')

# URL patterns
urlpatterns = [
    path('api/', include(router.urls)),
]
```

---

#### Step 3.4: Register URLs (MINIMAL external change #2)

**File to edit:** `label_studio/core/all_urls.py` or main `urls.py`

Add this line:

```python
urlpatterns = [
    # ... existing URLs ...
    path('', include('workplace_RBAC_extension.urls')),  # ← Add this
]
```

---

### Phase 4: Frontend (React UI)

#### Step 4.1: Create Workspace List Page

Create file: `workplace_RBAC_extension/frontend/WorkspaceList.tsx`

```typescript
/**
 * Workspace List Page
 * Shows all workspaces user can access.
 */

import React, { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input } from '@humansignal/ui';
import { useAPI } from 'apps/labelstudio/src/hooks/useAPI';

interface Workspace {
  id: number;
  title: string;
  description: string;
  member_count: number;
  project_count: number;
  created_at: string;
}

export const WorkspaceList: React.FC = () => {
  const api = useAPI();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/workspaces/');
      setWorkspaces(response.data);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (values: any) => {
    try {
      await api.post('/api/workspaces/', values);
      setShowCreateModal(false);
      loadWorkspaces(); // Reload list
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this workspace?')) {
      return;
    }

    try {
      await api.delete(`/api/workspaces/${id}/`);
      loadWorkspaces(); // Reload list
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Workspaces</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Create Workspace
        </Button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <Table
          columns={[
            {
              title: 'Name',
              dataIndex: 'title',
              key: 'title',
              render: (text: string, record: Workspace) => (
                <a href={`/workspaces/${record.id}`}>{text}</a>
              ),
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
            },
            {
              title: 'Projects',
              dataIndex: 'project_count',
              key: 'project_count',
            },
            {
              title: 'Members',
              dataIndex: 'member_count',
              key: 'member_count',
            },
            {
              title: 'Created',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (date: string) => new Date(date).toLocaleDateString(),
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_: any, record: Workspace) => (
                <Button
                  danger
                  onClick={() => handleDeleteWorkspace(record.id)}
                >
                  Delete
                </Button>
              ),
            },
          ]}
          dataSource={workspaces}
          rowKey="id"
        />
      )}

      <Modal
        title="Create Workspace"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        footer={null}
      >
        <Form onFinish={handleCreateWorkspace}>
          <Form.Item
            name="title"
            label="Workspace Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Medical Imaging Projects" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              placeholder="Optional description..."
              rows={3}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
```

---

#### Step 4.2: Create Workspace Detail Page

Create file: `workplace_RBAC_extension/frontend/WorkspaceDetail.tsx`

```typescript
/**
 * Workspace Detail Page
 * Shows projects and members in a workspace.
 * Allows adding/removing projects and members.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Table, Modal, Select, Tabs } from '@humansignal/ui';
import { useAPI } from 'apps/labelstudio/src/hooks/useAPI';

interface WorkspaceDetail {
  id: number;
  title: string;
  description: string;
  members: Array<{
    id: number;
    user: {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
    };
    effective_role: string;
  }>;
  projects: Array<{
    id: number;
    title: string;
    description: string;
  }>;
}

export const WorkspaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const api = useAPI();

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);

  // Available users and projects (loaded on modal open)
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);

  useEffect(() => {
    loadWorkspace();
  }, [id]);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/workspaces/${id}/`);
      setWorkspace(response.data);
    } catch (error) {
      console.error('Failed to load workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      // Get all organization users
      const response = await api.get('/api/users/');
      setAvailableUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadAvailableProjects = async () => {
    try {
      // Get all projects in organization
      const response = await api.get('/api/projects/');
      setAvailableProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleAddMember = async (userId: number) => {
    try {
      await api.post(`/api/workspaces/${id}/add-member/`, {
        user_id: userId,
      });
      setShowAddMemberModal(false);
      loadWorkspace(); // Reload
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!window.confirm('Remove this user from workspace?')) {
      return;
    }

    try {
      await api.post(`/api/workspaces/${id}/remove-member/`, {
        user_id: userId,
      });
      loadWorkspace(); // Reload
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleAddProject = async (projectId: number) => {
    try {
      await api.post(`/api/workspaces/${id}/add-project/`, {
        project_id: projectId,
      });
      setShowAddProjectModal(false);
      loadWorkspace(); // Reload
    } catch (error) {
      console.error('Failed to add project:', error);
    }
  };

  const handleRemoveProject = async (projectId: number) => {
    if (!window.confirm('Remove this project from workspace?')) {
      return;
    }

    try {
      await api.post(`/api/workspaces/${id}/remove-project/`, {
        project_id: projectId,
      });
      loadWorkspace(); // Reload
    } catch (error) {
      console.error('Failed to remove project:', error);
    }
  };

  if (loading || !workspace) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>{workspace.title}</h1>
      <p>{workspace.description}</p>

      <Tabs defaultActiveKey="projects">
        <Tabs.TabPane tab="Projects" key="projects">
          <div style={{ marginBottom: '10px' }}>
            <Button onClick={() => {
              loadAvailableProjects();
              setShowAddProjectModal(true);
            }}>
              Add Project
            </Button>
          </div>

          <Table
            columns={[
              {
                title: 'Project Name',
                dataIndex: 'title',
                key: 'title',
                render: (text: string, record: any) => (
                  <a href={`/projects/${record.id}`}>{text}</a>
                ),
              },
              {
                title: 'Description',
                dataIndex: 'description',
                key: 'description',
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_: any, record: any) => (
                  <Button
                    danger
                    onClick={() => handleRemoveProject(record.id)}
                  >
                    Remove
                  </Button>
                ),
              },
            ]}
            dataSource={workspace.projects}
            rowKey="id"
          />
        </Tabs.TabPane>

        <Tabs.TabPane tab="Members" key="members">
          <div style={{ marginBottom: '10px' }}>
            <Button onClick={() => {
              loadAvailableUsers();
              setShowAddMemberModal(true);
            }}>
              Add Member
            </Button>
          </div>

          <Table
            columns={[
              {
                title: 'Name',
                key: 'name',
                render: (_: any, record: any) => (
                  `${record.user.first_name} ${record.user.last_name}`
                ),
              },
              {
                title: 'Email',
                dataIndex: ['user', 'email'],
                key: 'email',
              },
              {
                title: 'Role',
                dataIndex: 'effective_role',
                key: 'role',
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_: any, record: any) => (
                  <Button
                    danger
                    onClick={() => handleRemoveMember(record.user.id)}
                  >
                    Remove
                  </Button>
                ),
              },
            ]}
            dataSource={workspace.members}
            rowKey="id"
          />
        </Tabs.TabPane>
      </Tabs>

      {/* Add Member Modal */}
      <Modal
        title="Add Member to Workspace"
        open={showAddMemberModal}
        onCancel={() => setShowAddMemberModal(false)}
        footer={null}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="Select a user"
          onChange={(userId) => handleAddMember(Number(userId))}
          options={availableUsers.map(user => ({
            value: user.id,
            label: `${user.first_name} ${user.last_name} (${user.email})`,
          }))}
        />
      </Modal>

      {/* Add Project Modal */}
      <Modal
        title="Add Project to Workspace"
        open={showAddProjectModal}
        onCancel={() => setShowAddProjectModal(false)}
        footer={null}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="Select a project"
          onChange={(projectId) => handleAddProject(Number(projectId))}
          options={availableProjects.map(project => ({
            value: project.id,
            label: project.title,
          }))}
        />
      </Modal>
    </div>
  );
};
```

---

#### Step 4.3: Add Routing

Create file: `workplace_RBAC_extension/frontend/routes.ts`

```typescript
/**
 * Frontend routes for Workspace pages.
 */

import { WorkspaceList } from './WorkspaceList';
import { WorkspaceDetail } from './WorkspaceDetail';

export const workspaceRoutes = [
  {
    path: '/workspaces',
    component: WorkspaceList,
    exact: true,
  },
  {
    path: '/workspaces/:id',
    component: WorkspaceDetail,
    exact: true,
  },
];
```

---

#### Step 4.4: Add Navigation Link (MINIMAL external change #3)

**File to find:** Look for sidebar/navigation in `web/apps/labelstudio/src/components/` or similar

Example file might be: `Sidebar.tsx` or `Navigation.tsx`

**Add this link:**

```tsx
<NavLink to="/workspaces">
  <Icon name="folder" />
  Workspaces
</NavLink>
```

---

### Phase 5: Testing

#### Step 5.1: Create Test File

Create file: `workplace_RBAC_extension/tests/test_workspaces.py`

```python
"""
Tests for Workspace RBAC Extension.
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from organizations.models import Organization, OrganizationMember
from projects.models import Project
from ..models import Workspace, WorkspaceMember, WorkspaceProject

User = get_user_model()


class WorkspaceModelTest(TestCase):
    """Test Workspace model functionality."""

    def setUp(self):
        """Create test data."""
        # Create users
        self.owner = User.objects.create_user(
            email='owner@test.com',
            password='testpass123'
        )
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='testpass123'
        )
        self.annotator = User.objects.create_user(
            email='annotator@test.com',
            password='testpass123'
        )

        # Create organization
        self.org = Organization.create_organization(
            created_by=self.owner,
            title='Test Org'
        )

        # Add admin
        OrganizationMember.objects.create(
            user=self.admin,
            organization=self.org,
            role='admin'
        )

        # Add annotator
        OrganizationMember.objects.create(
            user=self.annotator,
            organization=self.org,
            role='annotator'
        )

        # Create projects
        self.project1 = Project.objects.create(
            title='Project 1',
            organization=self.org
        )
        self.project2 = Project.objects.create(
            title='Project 2',
            organization=self.org
        )

    def test_create_workspace(self):
        """Test creating a workspace."""
        workspace = Workspace.objects.create(
            title='Test Workspace',
            description='Test description',
            organization=self.org,
            created_by=self.owner
        )

        self.assertEqual(workspace.title, 'Test Workspace')
        self.assertEqual(workspace.organization, self.org)
        self.assertTrue(workspace.is_active())

    def test_add_member_to_workspace(self):
        """Test adding a user to workspace."""
        workspace = Workspace.objects.create(
            title='Test Workspace',
            organization=self.org,
            created_by=self.owner
        )

        # Add annotator to workspace
        member = WorkspaceMember.objects.create(
            user=self.annotator,
            workspace=workspace,
            enabled=True
        )

        self.assertEqual(member.get_effective_role(), 'annotator')
        self.assertTrue(member.enabled)

    def test_add_project_to_workspace(self):
        """Test adding project to workspace."""
        workspace = Workspace.objects.create(
            title='Test Workspace',
            organization=self.org,
            created_by=self.owner
        )

        # Add project to workspace
        workspace_project = WorkspaceProject.objects.create(
            workspace=workspace,
            project=self.project1,
            added_by=self.owner
        )

        self.assertEqual(workspace_project.workspace, workspace)
        self.assertEqual(workspace_project.project, self.project1)

    def test_workspace_member_access_to_projects(self):
        """Test that workspace member can access projects in workspace."""
        workspace = Workspace.objects.create(
            title='Test Workspace',
            organization=self.org,
            created_by=self.owner
        )

        # Add projects to workspace
        WorkspaceProject.objects.create(
            workspace=workspace,
            project=self.project1,
            added_by=self.owner
        )
        WorkspaceProject.objects.create(
            workspace=workspace,
            project=self.project2,
            added_by=self.owner
        )

        # Add annotator to workspace
        WorkspaceMember.objects.create(
            user=self.annotator,
            workspace=workspace,
            enabled=True
        )

        # Verify annotator can access projects through workspace
        from ..permissions import has_workspace_access_to_project

        self.assertTrue(has_workspace_access_to_project(self.annotator, self.project1))
        self.assertTrue(has_workspace_access_to_project(self.annotator, self.project2))


class WorkspaceAPITest(TestCase):
    """Test Workspace API endpoints."""

    def setUp(self):
        """Create test data and client."""
        self.client = self.client_class()

        # Create user and org
        self.user = User.objects.create_user(
            email='test@test.com',
            password='testpass123'
        )
        self.org = Organization.create_organization(
            created_by=self.user,
            title='Test Org'
        )
        self.user.active_organization = self.org
        self.user.save()

        # Login
        self.client.force_authenticate(user=self.user)

    def test_list_workspaces(self):
        """Test listing workspaces."""
        # Create workspace
        Workspace.objects.create(
            title='Test Workspace',
            organization=self.org,
            created_by=self.user
        )

        response = self.client.get('/api/workspaces/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Test Workspace')

    def test_create_workspace(self):
        """Test creating workspace via API."""
        data = {
            'title': 'New Workspace',
            'description': 'Test description'
        }

        response = self.client.post('/api/workspaces/', data)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Workspace.objects.count(), 1)

        workspace = Workspace.objects.first()
        self.assertEqual(workspace.title, 'New Workspace')
        self.assertEqual(workspace.organization, self.org)
```

#### Step 5.2: Run Tests

```bash
# Run all tests for workspace extension
python manage.py test workplace_RBAC_extension

# Run specific test
python manage.py test workplace_RBAC_extension.tests.test_workspaces.WorkspaceModelTest.test_create_workspace
```

---

## Integration with Existing Code

### Summary of External Changes

Only **3 minimal changes** outside `workplace_RBAC_extension/`:

1. **Add app to INSTALLED_APPS** (`label_studio/core/settings/base.py`)
   ```python
   'workplace_RBAC_extension',  # 1 line
   ```

2. **Include URLs** (`label_studio/core/urls.py` or similar)
   ```python
   path('', include('workplace_RBAC_extension.urls')),  # 1 line
   ```

3. **Add navigation link** (in sidebar component)
   ```tsx
   <NavLink to="/workspaces">Workspaces</NavLink>  # 2-3 lines
   ```

**That's it!** Everything else stays in `workplace_RBAC_extension/`.

---

### How Workspace Access Integrates

#### Before (Current System)
```
User → ProjectMember → Project ✅
```

#### After (With Workspaces)
```
User → ProjectMember → Project ✅ (still works!)
     ↓
     WorkspaceMember → Workspace → WorkspaceProject → Project ✅ (new way!)
```

**Both paths work!** We're adding, not replacing.

---

## Testing Strategy

### Manual Testing Checklist

#### Phase 1: Basic Functionality
- [ ] Create a workspace
- [ ] Edit workspace title/description
- [ ] Delete a workspace
- [ ] Verify workspace shows in list

#### Phase 2: Projects
- [ ] Add a project to workspace
- [ ] Remove a project from workspace
- [ ] Add multiple projects
- [ ] Verify project appears in both workspace and normal project list

#### Phase 3: Members
- [ ] Add a user to workspace
- [ ] Remove a user from workspace
- [ ] Add multiple users
- [ ] Verify user can access all projects in workspace

#### Phase 4: Permissions
- [ ] Verify owner can manage workspaces
- [ ] Verify admin can manage workspaces
- [ ] Verify annotator CANNOT manage workspaces
- [ ] Verify workspace member can view but not edit workspace

#### Phase 5: Integration
- [ ] User added to workspace can label tasks in all projects
- [ ] User removed from workspace loses access to projects
- [ ] Direct project access still works
- [ ] Organization permissions still work

---

### Automated Testing

Run the test suite:

```bash
# All tests
python manage.py test workplace_RBAC_extension

# With coverage report
coverage run --source='workplace_RBAC_extension' manage.py test workplace_RBAC_extension
coverage report
```

---

## Deployment Checklist

### Before Deployment

1. **Run migrations**
   ```bash
   python manage.py makemigrations workplace_RBAC_extension
   python manage.py migrate workplace_RBAC_extension
   ```

2. **Run tests**
   ```bash
   python manage.py test workplace_RBAC_extension
   ```

3. **Check permissions registration**
   ```bash
   python manage.py shell
   >>> import rules
   >>> rules.perm_exists('workspaces.view')
   True
   ```

4. **Build frontend**
   ```bash
   cd web/apps/labelstudio
   npm run build
   ```

### After Deployment

1. **Verify database tables created**
   ```sql
   SELECT * FROM workspace LIMIT 1;
   SELECT * FROM workspace_member LIMIT 1;
   SELECT * FROM workspace_project LIMIT 1;
   ```

2. **Test API endpoints**
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN" http://localhost:8080/api/workspaces/
   ```

3. **Check frontend loads**
   - Navigate to `/workspaces`
   - Verify page renders without errors

---

## Troubleshooting

### Common Issues

#### Issue: "No module named 'workplace_RBAC_extension'"
**Solution:** Make sure app is added to `INSTALLED_APPS` in settings.

#### Issue: "Table 'workspace' doesn't exist"
**Solution:** Run migrations:
```bash
python manage.py migrate workplace_RBAC_extension
```

#### Issue: "Permission denied" when accessing workspace
**Solution:** Check user's organization role:
```python
OrganizationMember.objects.filter(user=user, organization=org)
```

#### Issue: Frontend shows 404 for /workspaces
**Solution:** Verify URLs are included in main urls.py

---

## Future Enhancements

### Phase 2 Features (Optional)

1. **Workspace Templates**
   - Create workspace with pre-configured projects
   - Clone workspace structure

2. **Bulk Operations**
   - Add multiple users at once
   - Add multiple projects at once

3. **Workspace Analytics**
   - Show workspace-level statistics
   - Track member activity

4. **Fine-grained Permissions**
   - Different roles per workspace
   - Custom permission sets

5. **Workspace Sharing**
   - Share workspace with another organization
   - Temporary access links

---

## Conclusion

This implementation provides:
- ✅ Workspace grouping of projects
- ✅ Single-point user access management
- ✅ Minimal changes to existing code
- ✅ Same permission model
- ✅ Same UI patterns

All contained within `workplace_RBAC_extension/` folder!

---

## Questions?

If you run into issues, check:
1. Django logs: `label_studio/logs/`
2. Browser console: F12 → Console tab
3. Database: Verify tables exist
4. Permissions: Check user roles in organization

Good luck with implementation! 🚀
