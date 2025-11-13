# Label Studio RBAC (Role-Based Access Control) Matrix

**Document Version:** 1.0
**Generated:** 2025-11-13
**Based on:** Label Studio Codebase Analysis (branch: c_RBAC)

---

## Table of Contents

1. [Role Definitions](#role-definitions)
2. [Permission Overview](#permission-overview)
3. [Comprehensive Access Control Matrix](#comprehensive-access-control-matrix)
4. [Workspace Operations](#workspace-operations)
5. [Export/Import Operations](#exportimport-operations)
6. [Project Operations](#project-operations)
7. [Task Operations](#task-operations)
8. [Annotation Operations](#annotation-operations)
9. [Organization Management](#organization-management)
10. [Member Management](#member-management)
11. [Permission Implementation Details](#permission-implementation-details)
12. [Key Security Rules](#key-security-rules)

---

## Role Definitions

Label Studio implements a hierarchical role-based access control system with five organizational roles:

### Role Hierarchy (Highest to Lowest Privilege)

| Role | Description | File Reference |
|------|-------------|----------------|
| **Owner** | Organization creator or explicitly assigned owner. Full administrative access to all resources. | `organizations/models.py:21-27` |
| **Admin** | Administrator with nearly equivalent permissions to Owner. Can manage users and projects. | `organizations/models.py:21-27` |
| **Reviewer** | Can review and approve annotations, create annotations, but cannot manage projects or users. | `organizations/models.py:21-27` |
| **Annotator** | Can create and edit annotations on assigned tasks. No review or management capabilities. | `organizations/models.py:21-27` |
| **Inactive** | Disabled user with no system access. Default role for new users until activated. | `organizations/models.py:21-27` |

### Role Capability Methods

Located in `organizations/models.py:93-107`:

| Method | Owner | Admin | Reviewer | Annotator | Inactive |
|--------|-------|-------|----------|-----------|----------|
| `can_manage_users()` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `can_manage_projects()` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `can_review_annotations()` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `can_create_annotations()` | ✓ | ✓ | ✓ | ✓ | ✗ |

---

## Permission Overview

### Core Permission Categories

Defined in `core/permissions.py:13-50`:

1. **Organization Permissions**
   - `organizations.create`
   - `organizations.view`
   - `organizations.change`
   - `organizations.delete`
   - `organizations.invite`

2. **Project Permissions**
   - `projects.create`
   - `projects.view`
   - `projects.change`
   - `projects.delete`

3. **Task Permissions**
   - `tasks.create`
   - `tasks.view`
   - `tasks.change`
   - `tasks.delete`

4. **Annotation Permissions**
   - `annotations.create`
   - `annotations.view`
   - `annotations.change`
   - `annotations.delete`

5. **Workspace Permissions** (Extended RBAC)
   - `workspaces.view`
   - `workspaces.change`
   - `workspaces.delete`
   - `workspaces.add_member`
   - `workspaces.add_project`

---

## Comprehensive Access Control Matrix

### Legend
- ✓ = Full access granted
- ✓* = Conditional access (requires membership or specific conditions)
- ✗ = Access denied
- † = Special restrictions apply (see notes)

---

## Workspace Operations

**File References:** `workplace_RBAC_extension/api.py`, `workplace_RBAC_extension/permissions.py`

| Operation | Endpoint | Owner | Admin | Reviewer | Annotator | Inactive | Permission Required | File:Line |
|-----------|----------|-------|-------|----------|-----------|----------|---------------------|-----------|
| **View All Workspaces** | GET `/api/workspaces/` | ✓ | ✓ | ✗ | ✗ | ✗ | Org owner/admin | `workplace_RBAC_extension/api.py:98-102` |
| **View Own Workspaces** | GET `/api/workspaces/` | ✓ | ✓ | ✓* | ✓* | ✗ | Workspace member | `workplace_RBAC_extension/api.py:104-109` |
| **Retrieve Workspace Details** | GET `/api/workspaces/:id/` | ✓ | ✓ | ✓* | ✓* | ✗ | `workspaces.view` | `workplace_RBAC_extension/api.py:111-115` |
| **Create Workspace** | POST `/api/workspaces/` | ✓ | ✓ | ✗ | ✗ | ✗ | Authenticated | `workplace_RBAC_extension/api.py:117-137` |
| **Update Workspace** | PATCH `/api/workspaces/:id/` | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.change` | `workplace_RBAC_extension/api.py:145-149` |
| **Delete Workspace** | DELETE `/api/workspaces/:id/` | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.delete` | `workplace_RBAC_extension/api.py:139-143` |
| **Add Member to Workspace** | POST `/api/workspaces/:id/add-member/` | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.add_member` | `workplace_RBAC_extension/api.py:151-279` |
| **Remove Member from Workspace** | POST `/api/workspaces/:id/remove-member/` | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.add_member` | `workplace_RBAC_extension/api.py:281-379` |
| **Add Project to Workspace** | POST `/api/workspaces/:id/add-project/` | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.add_project` | `workplace_RBAC_extension/api.py:381-477` |
| **Remove Project from Workspace** | POST `/api/workspaces/:id/remove-project/` | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.add_project` | `workplace_RBAC_extension/api.py:479-533` |
| **Modify Owner Role (via workspace)** | POST `/api/workspaces/:id/add-member/` | ✓† | ✗ | ✗ | ✗ | ✗ | Owner only | `workplace_RBAC_extension/api.py:236-247` |

**Notes:**
- † Only owners can modify other owners or promote users to owner role
- * Requires enabled workspace membership
- Adding member auto-cascades to all workspace projects
- Removing member can cascade to projects (configurable: none/disable/remove)
- Adding project auto-grants access to all workspace members

---

## Export/Import Operations

**File References:** `data_export/api.py`, `data_import/api.py`

| Operation | Endpoint | Owner | Admin | Reviewer | Annotator | Inactive | Permission Required | File:Line |
|-----------|----------|-------|-------|----------|-----------|----------|---------------------|-----------|
| **List Export Formats** | GET `/api/projects/:id/export/formats` | ✓ | ✓ | ✓* | ✓* | ✗ | `projects.view` | `data_export/api.py:73-74` |
| **Export Tasks (Sync)** | GET `/api/projects/:id/export` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_export/api.py:162-163` |
| **List Export Snapshots** | GET `/api/projects/:id/exports/` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_export/api.py:311-315` |
| **Create Export Snapshot** | POST `/api/projects/:id/exports/` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_export/api.py:311-315` |
| **View Export Snapshot** | GET `/api/projects/:id/exports/:pk` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_export/api.py:416-421` |
| **Download Export** | GET `/api/projects/:id/exports/:pk/download` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_export/api.py:505-510` |
| **Delete Export Snapshot** | DELETE `/api/projects/:id/exports/:pk` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_export/api.py:416-421` |
| **Convert Export Format** | POST `/api/projects/:id/exports/:pk/convert` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_export/api.py:661-664` |
| **Import Tasks** | POST `/api/projects/:id/import` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_import/api.py:233-235` |
| **Import Predictions** | POST `/api/projects/:id/import/predictions` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_import/api.py:419-430` |
| **Re-Import Tasks** | POST `/api/projects/:id/reimport` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_import/api.py:589-590` |
| **List File Uploads** | GET `/api/projects/:id/file-uploads` | ✓ | ✓ | ✓* | ✓* | ✗ | `projects.view` | `data_import/api.py:744-750` |
| **Delete File Uploads** | DELETE `/api/projects/:id/file-uploads` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `data_import/api.py:744-750` |

**Notes:**
- * Requires project membership
- Export operations use `projects.change` permission (typically owner/admin only)
- Import operations have limits: 250K tasks, 200 MB per request
- Import predictions require matching task IDs

---

## Project Operations

**File References:** `projects/api.py`, `projects/models.py`

| Operation | Endpoint | Owner | Admin | Reviewer | Annotator | Inactive | Permission Required | File:Line |
|-----------|----------|-------|-------|----------|-----------|----------|---------------------|-----------|
| **List Projects** | GET `/api/projects/` | ✓ | ✓ | ✓* | ✓* | ✗ | `projects.view` | `projects/api.py:281-299` |
| **Create Project** | POST `/api/projects/` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.create` | `projects/api.py:306-330` |
| **Retrieve Project** | GET `/api/projects/:id/` | ✓ | ✓ | ✓* | ✓* | ✗ | `projects.view` | `projects/api.py:495-516` |
| **Update Project** | PATCH `/api/projects/:id/` | ✓ | ✓ | ✓* | ✗ | ✗ | `projects.change` | `projects/api.py:565-576` |
| **Delete Project** | DELETE `/api/projects/:id/` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.delete` | `projects/api.py:578-581` |
| **Validate Label Config** | POST `/api/projects/:id/validate/` | ✓ | ✓ | ✓* | ✗ | ✗ | `projects.change` | `projects/api.py:713-722` |
| **Update Label Config** | PATCH `/api/projects/:id/` | ✓ | ✓ | ✗ | ✗ | ✗ | `projects.change` | `projects/api.py:565-576` |
| **Get Next Task** | GET `/api/projects/:id/next/` | ✓ | ✓ | ✓* | ✓* | ✗ | `tasks.view` | `projects/api.py:605-629` |
| **Add Project Member** | POST `/api/projects/:id/members/` | ✓ | ✓ | ✗ | ✗ | ✗ | Project admin | `projects/api.py:1083-1139` |
| **Remove Project Member** | DELETE `/api/projects/:id/members/:pk` | ✓ | ✓ | ✗ | ✗ | ✗ | Project admin | `projects/api.py:1083-1139` |
| **List Project Members** | GET `/api/projects/:id/members/` | ✓ | ✓ | ✓* | ✓* | ✗ | Project member | `projects/api.py:1083-1139` |

**Notes:**
- * Requires project membership (direct or via workspace)
- Project list shows only user's accessible projects (creator, member, or workspace access)
- Owner role sees ALL organization projects
- Label config updates validate against existing annotations

**Project Access Criteria** (from `projects/api.py:287-299`):
1. User is organization owner
2. User is project creator
3. User is ProjectMember with `enabled=True` and `deleted_at=None`
4. User is WorkspaceMember for workspace containing the project

---

## Task Operations

**File References:** `tasks/api.py`, `tasks/models.py`

| Operation | Endpoint | Owner | Admin | Reviewer | Annotator | Inactive | Permission Required | File:Line |
|-----------|----------|-------|-------|----------|-----------|----------|---------------------|-----------|
| **List Tasks** | GET `/api/tasks/` | ✓ | ✓ | ✓* | ✓* | ✗ | `tasks.view` | `tasks/api.py:317-333` |
| **Create Task** | POST `/api/tasks/` | ✓ | ✓ | ✓* | ✓* | ✗ | `tasks.create` | `tasks/api.py:198-205` |
| **Retrieve Task** | GET `/api/tasks/:id/` | ✓ | ✓ | ✓* | ✓* | ✗ | `tasks.view` | `tasks/api.py:317-333` |
| **Update Task** | PATCH `/api/tasks/:id/` | ✓ | ✓ | ✓* | ✓* | ✗ | `tasks.change` | `tasks/api.py:371-372` |
| **Delete Task** | DELETE `/api/tasks/:id/` | ✓ | ✓ | ✗ | ✗ | ✗ | `tasks.delete` | `tasks/api.py:374-376` |
| **Bulk Delete Tasks** | DELETE `/api/tasks/` | ✓ | ✓ | ✗ | ✗ | ✗ | `tasks.delete` | `tasks/api.py:262-276` |
| **Lock Task** | Automatic on access | ✓ | ✓ | ✓* | ✓* | ✗ | Task access | `tasks/models.py:362-391` |
| **Release Task Lock** | Automatic on submit | ✓ | ✓ | ✓* | ✓* | ✗ | Task access | `tasks/models.py:393-402` |

**Notes:**
- * Requires project membership
- Task permissions inherit from parent project permissions
- Task locking prevents concurrent work by multiple users
- Lock TTL configurable per project (default from settings)
- Tasks filtered by organization: `queryset.filter(project__organization=request.user.active_organization)`

**Task Locking System** (from `tasks/models.py:271-402`):
- `has_lock(user)`: Check if task is locked
- `set_lock(user)`: Automatically locks task when accessed
- `release_lock(user)`: Releases lock after annotation submission
- Respects project's `overlap` setting (how many concurrent annotations allowed)

---

## Annotation Operations

**File References:** `tasks/api.py`, `tasks/models.py`

| Operation | Endpoint | Owner | Admin | Reviewer | Annotator | Inactive | Permission Required | File:Line |
|-----------|----------|-------|-------|----------|-----------|----------|---------------------|-----------|
| **List Annotations** | GET `/api/tasks/:id/annotations/` | ✓ | ✓ | ✓* | ✓* | ✗ | `annotations.view` | `tasks/api.py:574-575` |
| **Create Annotation** | POST `/api/tasks/:id/annotations/` | ✓ | ✓ | ✓ | ✓ | ✗ | `annotations.create` | `tasks/api.py:596-657` |
| **Retrieve Annotation** | GET `/api/annotations/:id/` | ✓ | ✓ | ✓* | ✓* | ✗ | `annotations.view` | `tasks/api.py:478-479` |
| **Update Annotation** | PATCH `/api/annotations/:id/` | ✓ | ✓ | ✓ | ✗ | ✗ | `annotations.change` | `tasks/api.py:487-488` |
| **Delete Annotation** | DELETE `/api/annotations/:id/` | ✓ | ✓ | ✓ | ✗ | ✗ | `annotations.delete` | `tasks/api.py:490-492` |
| **Set Ground Truth** | PATCH `/api/annotations/:id/` | ✓ | ✓ | ✓ | ✗ | ✗ | Review permission | `tasks/api.py:460-476` |
| **List Annotation Drafts** | GET `/api/tasks/:id/drafts/` | ✓ | ✓ | ✓* | ✓* | ✗ | Task access | `tasks/api.py` |
| **Create Annotation Draft** | POST `/api/tasks/:id/drafts/` | ✓ | ✓ | ✓ | ✓ | ✗ | `annotations.create` | `tasks/api.py` |

**Notes:**
- * Requires project membership
- Annotators can create annotations but cannot update/delete them
- Reviewers and above can update/delete annotations
- Creating annotation automatically:
  - Sets `completed_by` to current user
  - Releases task lock
  - Updates task `is_labeled` status
- Draft permissions check ownership: only draft creator can convert to annotation
- Ground truth annotations are unique per task

**Annotation Permission Check** (from `tasks/models.py:726-730`):
```python
def has_permission(self, user):
    user.project = self.project
    return self.project.has_permission(user)
```

---

## Organization Management

**File References:** `organizations/api.py`, `organizations/models.py`

| Operation | Endpoint | Owner | Admin | Reviewer | Annotator | Inactive | Permission Required | File:Line |
|-----------|----------|-------|-------|----------|-----------|----------|---------------------|-----------|
| **View Organization** | GET `/api/organizations/:id/` | ✓ | ✓ | ✗ | ✗ | ✗ | Org owner/admin | `organizations/api.py` |
| **Update Organization** | PATCH `/api/organizations/:id/` | ✓ | ✓ | ✗ | ✗ | ✗ | Org owner/admin | `organizations/api.py` |
| **Delete Organization** | DELETE `/api/organizations/:id/` | ✓ | ✗ | ✗ | ✗ | ✗ | Owner only | `organizations/api.py` |
| **List Organization Members** | GET `/api/organizations/:id/members/` | ✓ | ✓ | ✗ | ✗ | ✗ | Org owner/admin | `organizations/api.py` |
| **Invite User** | POST `/api/organizations/:id/invite/` | ✓ | ✓ | ✗ | ✗ | ✗ | `can_manage_users()` | `organizations/api.py` |
| **Remove Member** | DELETE `/api/organizations/:id/members/:pk` | ✓ | ✓ | ✗ | ✗ | ✗ | `can_manage_users()` | `organizations/api.py` |
| **Update Member Role** | PATCH `/api/organizations/:id/members/:pk` | ✓ | ✓† | ✗ | ✗ | ✗ | `can_manage_users()` | `organizations/api.py:404-433` |
| **View Organization Settings** | GET `/api/organizations/:id/settings/` | ✓ | ✓ | ✗ | ✗ | ✗ | Org owner/admin | `organizations/api.py` |
| **Update Organization Settings** | PATCH `/api/organizations/:id/settings/` | ✓ | ✓ | ✗ | ✗ | ✗ | Org owner/admin | `organizations/api.py` |

**Notes:**
- † Admins cannot promote users to owner or modify existing owners
- Only owners can modify owner roles or promote to owner
- Default role for new users is 'inactive' until activated
- Organization deletion is restricted to owner only

---

## Member Management

**File References:** `projects/api.py`, `workplace_RBAC_extension/api.py`

| Operation | Context | Owner | Admin | Reviewer | Annotator | Inactive | Permission Required | File:Line |
|-----------|---------|-------|-------|----------|-----------|----------|---------------------|-----------|
| **Add Organization Member** | Organization | ✓ | ✓ | ✗ | ✗ | ✗ | `can_manage_users()` | `organizations/api.py` |
| **Remove Organization Member** | Organization | ✓ | ✓ | ✗ | ✗ | ✗ | `can_manage_users()` | `organizations/api.py` |
| **Change Member Role** | Organization | ✓ | ✓† | ✗ | ✗ | ✗ | `can_manage_users()` | `organizations/api.py:420` |
| **Add Project Member** | Project | ✓ | ✓ | ✗ | ✗ | ✗ | Project admin | `projects/api.py:1083-1139` |
| **Remove Project Member** | Project | ✓ | ✓ | ✗ | ✗ | ✗ | Project admin | `projects/api.py:1083-1139` |
| **Add Workspace Member** | Workspace | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.add_member` | `workplace_RBAC_extension/api.py:151-279` |
| **Remove Workspace Member** | Workspace | ✓ | ✓ | ✗ | ✗ | ✗ | `workspaces.add_member` | `workplace_RBAC_extension/api.py:281-379` |
| **Set Role Override** | Workspace | ✓ | ✗ | ✗ | ✗ | ✗ | Owner only | `workplace_RBAC_extension/api.py:236-247` |

**Notes:**
- † Admins cannot modify owner roles
- Adding workspace member auto-cascades to all workspace projects
- Removing workspace member has cascade options: none/disable/remove
- Role override allows workspace-specific role assignment

**Role Modification Rules** (from `workplace_RBAC_extension/api.py:236-247`):
1. Only owners can modify other owners
2. Only owners can promote users to owner role
3. Admins attempting owner operations receive PermissionDenied

---

## Permission Implementation Details

### Permission Check Flow

1. **Django Rest Framework Permission Classes**
   - `IsAuthenticated` - Basic authentication check
   - `IsProjectOwnerOrMember` - Project-level access (`projects/api.py:192-201`)
   - `IsProjectAdminOrReadOnly` - Admin-only write, read for members (`projects/api.py:1046-1080`)

2. **Django-Rules Integration**
   - All permissions registered with `rules.add_perm()` (`core/permissions.py:63-73`)
   - Predicates defined as functions returning boolean
   - Checked with `rules.test_rule(permission_name, user, object)`

3. **Model-Level Permission Methods**
   - `has_permission(user)` methods on models
   - Example: `Task.has_permission()`, `Annotation.has_permission()`
   - Inherit from parent objects (task → project → organization)

4. **Function-Based Permission Checks**
   - `can_view_workspace(user, workspace)` (`workplace_RBAC_extension/permissions.py:43-85`)
   - `can_manage_workspace(user, workspace)` (`workplace_RBAC_extension/permissions.py:88-132`)
   - Role methods: `can_manage_users()`, `can_manage_projects()`, etc.

### Permission Inheritance Hierarchy

```
Organization
    ↓ (organization membership with role)
Workspace
    ↓ (workspace membership with optional role_override)
Project
    ↓ (project membership)
Task
    ↓
Annotation
```

**Effective Role Calculation** (from `workplace_RBAC_extension/models.py:185-211`):
1. Check workspace `role_override` (highest priority)
2. Fall back to organization role
3. Default to 'annotator' if no organization membership

---

## Key Security Rules

### 1. Organization Boundaries
- All operations enforce organization matching
- Projects must be in same organization as workspace
- Users must be organization members before workspace/project membership
- Tasks filtered by active organization

### 2. Owner Protection
**File:** `workplace_RBAC_extension/api.py:236-247`
- Only owners can modify other owners
- Only owners can promote users to owner role
- Prevents privilege escalation by admins
- Hard enforcement with `PermissionDenied` exception

### 3. Soft Delete Pattern
- Workspaces use `deleted_at` timestamp
- ProjectMember uses `deleted_at` for soft deletes
- Enables audit trail and potential recovery
- Filtered out in querysets via `deleted_at__isnull=True`

### 4. Automatic Cascading

**Adding Member to Workspace** (`workplace_RBAC_extension/api.py:261-273`):
- Auto-creates ProjectMember for ALL workspace projects
- Sets `enabled=True`, `deleted_at=None`

**Adding Project to Workspace** (`workplace_RBAC_extension/api.py:456-471`):
- Auto-grants access to ALL enabled workspace members
- Creates ProjectMember records automatically

**Removing Member from Workspace** (`workplace_RBAC_extension/api.py:361-373`):
- Configurable cascade: `none`, `disable`, or `remove`
- `disable`: Sets ProjectMember.enabled=False
- `remove`: Sets ProjectMember.deleted_at=now()
- `none`: Only disables workspace membership

**Removing Project from Workspace** (`workplace_RBAC_extension/api.py:522-531`):
- NO automatic cascade
- Users retain ProjectMember access
- Manual cleanup required if access should be revoked

### 5. Task Locking Mechanism
**File:** `tasks/models.py:271-402`
- Prevents concurrent editing
- Automatic lock on task access
- Automatic release on annotation submission
- Respects project's `overlap` setting
- TTL ensures locks expire (configurable per project)

### 6. Authentication Requirements
- All endpoints require `IsAuthenticated`
- No anonymous access to any resources
- Inactive users blocked by middleware (`core/middleware.py:289-291`)

### 7. Default Permissions
**File:** `core/permissions.py:72-73`
- All permissions default to `rules.is_authenticated`
- Can be overridden with custom predicates
- Superusers bypass all permission checks

---

## Implementation File Map

### Core Permission System
| File | Lines | Description |
|------|-------|-------------|
| `core/permissions.py` | 13-50 | All permission definitions |
| `core/permissions.py` | 63-73 | Permission registration with django-rules |
| `core/role_permissions.py` | 6-186 | Function-based role permission checks |

### Organization RBAC
| File | Lines | Description |
|------|-------|-------------|
| `organizations/models.py` | 18-133 | OrganizationMember model and role definitions |
| `organizations/models.py` | 21-27 | ROLE_CHOICES definition |
| `organizations/models.py` | 93-107 | Role capability methods |
| `organizations/api.py` | 404-433 | Update user role API |

### Workspace RBAC Extension
| File | Lines | Description |
|------|-------|-------------|
| `workplace_RBAC_extension/models.py` | 46-122 | Workspace model |
| `workplace_RBAC_extension/models.py` | 124-212 | WorkspaceMember model with role_override |
| `workplace_RBAC_extension/models.py` | 214-272 | WorkspaceProject model |
| `workplace_RBAC_extension/api.py` | 64-533 | Workspace ViewSet with all operations |
| `workplace_RBAC_extension/permissions.py` | 43-252 | Workspace permission functions |

### Project RBAC
| File | Lines | Description |
|------|-------|-------------|
| `projects/api.py` | 192-201 | IsProjectOwnerOrMember permission class |
| `projects/api.py` | 281-299 | Project list queryset filtering |
| `projects/api.py` | 306-330 | Project creation with admin/owner check |
| `projects/api.py` | 1046-1080 | IsProjectAdminOrReadOnly permission class |
| `projects/api.py` | 1083-1139 | ProjectMember ViewSet |
| `projects/models.py` | 405-410 | Project permission helper methods |

### Task & Annotation RBAC
| File | Lines | Description |
|------|-------|-------------|
| `tasks/api.py` | 198-205 | Task creation |
| `tasks/api.py` | 317-376 | Task CRUD operations |
| `tasks/api.py` | 478-492 | Annotation detail operations |
| `tasks/api.py` | 574-657 | Annotation list and creation |
| `tasks/models.py` | 271-402 | Task locking system |
| `tasks/models.py` | 353-357 | Task.has_permission() |
| `tasks/models.py` | 726-730 | Annotation.has_permission() |

### Export/Import RBAC
| File | Lines | Description |
|------|-------|-------------|
| `data_export/api.py` | 73-664 | All export operations and permissions |
| `data_import/api.py` | 233-820 | All import operations and permissions |
| `projects/permissions.py` | 7-11 | ProjectImportPermission class |

---

## Summary Tables

### Operations by Permission Type

| Permission | Operations Covered | Typical Roles |
|------------|-------------------|---------------|
| `projects.create` | Create new projects | Owner, Admin |
| `projects.view` | List/retrieve projects, export formats, file uploads | All active roles (filtered by membership) |
| `projects.change` | Update projects, export/import, label config | Owner, Admin |
| `projects.delete` | Delete projects | Owner, Admin |
| `tasks.create` | Create tasks | All project members |
| `tasks.view` | List/retrieve tasks, get next task | All project members |
| `tasks.change` | Update task data | All project members |
| `tasks.delete` | Delete tasks | Owner, Admin |
| `annotations.create` | Create annotations, drafts | Owner, Admin, Reviewer, Annotator |
| `annotations.view` | List/retrieve annotations | All project members |
| `annotations.change` | Update annotations, set ground truth | Owner, Admin, Reviewer |
| `annotations.delete` | Delete annotations | Owner, Admin, Reviewer |
| `workspaces.view` | View workspace details | Workspace members, Org owner/admin |
| `workspaces.change` | Update workspace metadata | Org owner/admin |
| `workspaces.delete` | Delete workspace | Org owner/admin |
| `workspaces.add_member` | Add/remove workspace members | Org owner/admin |
| `workspaces.add_project` | Add/remove workspace projects | Org owner/admin |

### Role Comparison Matrix

| Capability | Owner | Admin | Reviewer | Annotator | Inactive |
|------------|-------|-------|----------|-----------|----------|
| Manage Organization | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage Users | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create/Delete Projects | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage Workspaces | ✓ | ✓ | ✗ | ✗ | ✗ |
| Export/Import Data | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create/Delete Tasks | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Projects (member) | ✓ | ✓ | ✓ | ✓ | ✗ |
| Update Projects (member) | ✓ | ✓ | ✓ | ✗ | ✗ |
| View Tasks (member) | ✓ | ✓ | ✓ | ✓ | ✗ |
| Review Annotations | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create Annotations | ✓ | ✓ | ✓ | ✓ | ✗ |
| Update/Delete Annotations | ✓ | ✓ | ✓ | ✗ | ✗ |
| Modify Owner Roles | ✓ | ✗ | ✗ | ✗ | ✗ |
| System Access | ✓ | ✓ | ✓ | ✓ | ✗ |

---

**Document End**

*This document was generated by analyzing the Label Studio codebase (branch: c_RBAC). All file references and line numbers are accurate as of the analysis date. For the most current implementation, please refer to the source code.*
