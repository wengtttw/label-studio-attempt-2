## Changes 11 November 2025 - Disable Skip Button Functionality

### Overview
This change disables the skip button in the annotation interface to ensure all annotations are completed rather than skipped.

---

### 1. Skip Button Disabled (Frontend)

**Objective**: Remove the ability for annotators to skip tasks in the annotation interface.

**User Request**: "Able to skip annotation - can we disable this function instead? Ideally all annotations should be annotated and not be skipped"

**Files Modified**:
- `web/libs/editor/src/components/BottomBar/Controls.tsx` (Lines 181-201)

**Logic/Reasoning**:
- Skip functionality allows annotators to bypass tasks they cannot complete
- Client requirement: All tasks must be annotated, not skipped
- Solution: Comment out skip button and unskip button in the UI

**Code Changes**:
```typescript
// Lines 181-190: Commented out "Was skipped" indicator and Unskip button
} else if (annotation.skipped) {
  // CUSTOM MODIFICATION: Skip button disabled - commented out unskip functionality
  /*
  buttons.push(
    <Elem name="skipped-info" key="skipped">
      <IconBan /> Was skipped
    </Elem>,
  );
  buttons.push(<UnskipButton key="unskip" disabled={disabled} store={store} />);
  */
} else {
  // CUSTOM MODIFICATION: Skip button disabled - commented out skip button
  /*
  if (store.hasInterface("skip")) {
    const onSkipWithComment = (e: React.MouseEvent, action: () => any) => {
      handleActionWithComments(e, action, "Please enter a comment before skipping");
    };

    buttons.push(<SkipButton key="skip" disabled={disabled} store={store} onSkipWithComment={onSkipWithComment} />);
  }
  */
```

**What Was Disabled**:
1. **Skip Button**: Button that allows annotators to skip tasks (Ctrl+Space keyboard shortcut)
2. **Unskip Button**: Button that allows reversing a skip action
3. **"Was skipped" Badge**: Visual indicator showing a task was previously skipped

**Impact**:
- ✅ Skip button removed from annotation interface
- ✅ Annotators cannot skip tasks via UI button
- ⚠️ Users can still skip via:
  - Keyboard shortcut (Ctrl+Space) - still active
  - Direct API calls to `/api/tasks/{id}/annotations/` with `was_cancelled=true`

**To Completely Block Skipping**:
If you need to completely prevent skipping (including API and keyboard shortcuts), you should also:
1. Set `show_skip_button=False` in project settings (backend)
2. Or modify backend API to reject skip requests

**Rebuild Required**:
```bash
cd web
npm run build
```

**To Re-enable Skip Button**:
Remove the `/*` and `*/` comment markers from lines 182-201 in `Controls.tsx`

---

## Changes 28 October 2025 by Chris

### 1. Add Database Indexes for Role Lookups
**Impact:** Massive performance boost

**Problem:** Every permission check queries `OrganizationMember` by `user`, `organization`, and `role`. Without indexes, these queries scan entire table (slow for large organizations).


This query runs on every single request.

Without the right index, the database searches through ALL memberships


**Fix implemented:**
Add database indexes to `OrganizationMember` model:
```python
class Meta:
    indexes = [
        models.Index(fields=['user', 'organization', 'deleted_at']),
        models.Index(fields=['organization', 'role']),
        models.Index(fields=['role']),
    ]
```

**Implementation:** Add to `label_studio/organizations/models.py` in `OrganizationMember` class Meta section.


### 2. Changed Button on UI for visbility

Visbility issues with regards to the Membership disabled/enabled

**File:** `label-studio-attempt-2\web\apps\labelstudio\src\pages\Settings\SelectedUser.jsx`

**Lines 95-108:**
```jsx
<button
  onClick={handleToggle}
  style={{ marginRight: 8 }}
  disabled={isSelf || isCreator}
  title={
    isSelf
      ? "You cannot disable yourself from the project."
      : isCreator
      ? "You cannot disable the project creator."
      : undefined
  }
>
  {memberInfo.enabled ? "Disable" : "Enable"}
</button>
```

Replace the native button with the Label Studio `Button` component from `@humansignal/ui`:

```jsx
import { Button } from "@humansignal/ui";

// In the component:
<Button
  variant="neutral"
  look="outlined"
  size="small"
  onClick={handleToggle}
  disabled={isSelf || isCreator}
  tooltip={
    isSelf
      ? "You cannot disable yourself from the project."
      : isCreator
      ? "You cannot disable the project creator."
      : undefined
  }
  style={{ marginRight: 8 }}
>
  {memberInfo.enabled ? "Disable" : "Enable"}
</Button>
```
### 3. Changed add to project button

**File:** `label-studio-attempt-2\web\apps\labelstudio\src\pages\Settings\SelectedUser.jsx`

**Lines 90-92:**
```jsx
{!isMember && (
  <button onClick={handleAdd}>Add to Project</button>
)}
```

Replaced with:

```jsx
{!isMember && (
  <Button
    variant="primary"
    look="filled"
    size="small"
    onClick={handleAdd}
    disabled={loading}
  >
    Add to Project
  </Button>
)}
```

---

## Changes 01 November 2025 - Workspace RBAC Permission Cascade Fixes

### Overview
This section documents fixes for two critical issues in the Workspace RBAC system:
1. **Issue #1**: Removing users from workspaces didn't revoke their project-level access
2. **Issue #2**: Users appeared inactive at project level despite having workspace access

---

### 1. Cascading Workspace Removal (Issue #1 Fix)

**Objective**: When removing a user from a workspace, provide options to cascade the removal to project-level access.

**Files Modified**:
- `label_studio/workplace_RBAC_extension/api.py` - WorkspaceViewSet.remove_member()
- `web/apps/labelstudio/src/pages/Workspaces_extension/WorkspaceDetail.jsx`

**Logic/Reasoning**:
- Previously, `remove_member()` only disabled `WorkspaceMember.enabled = False`
- Users who were also added directly to projects retained access (security issue)
- Solution: Add `cascade_to_projects` parameter with three options:
  - `none`: Remove from workspace only (preserve direct project access)
  - `disable`: Remove from workspace AND disable in all workspace projects (DEFAULT)
  - `remove`: Remove from workspace AND soft-delete from all workspace projects

**Code Changes**:
```python
# NEW API Parameter
cascade_to_projects: 'none' | 'disable' | 'remove' (default: 'disable')

# When cascade='disable':
- Sets WorkspaceMember.enabled = False
- Sets ProjectMember.enabled = False for all workspace projects

# When cascade='remove':
- Sets WorkspaceMember.enabled = False
- Sets ProjectMember.deleted_at = now() for all workspace projects (soft delete)
```

**Why cascade='disable' is default**:
- User preference: Stricter security by default
- Admins must explicitly choose 'none' to preserve project access
- Prevents accidental permission leakage

---

### 2. Soft Delete for ProjectMember (Issue #1 Enhancement)

**Objective**: Enable recovery of accidentally removed project memberships.

**Files Modified**:
- `label_studio/projects/models.py` - ProjectMember model
- `label_studio/projects/migrations/XXXX_add_deleted_at_to_projectmember.py` (NEW)
- All queries that fetch ProjectMember records

**Logic/Reasoning**:
- Hard delete is permanent and can't be undone
- Soft delete allows audit trail and potential recovery
- Maintains historical access records for compliance

**Code Changes**:
```python
# NEW Field in ProjectMember model
deleted_at = models.DateTimeField(null=True, blank=True, default=None)

# All ProjectMember queries now filter:
ProjectMember.objects.filter(..., deleted_at__isnull=True)
```

**Migration Command**:
```bash
python manage.py makemigrations projects
python manage.py migrate projects
```

---

### 3. Auto-Add Members to Projects (Issue #2 Fix)

**Objective**: When adding a project to a workspace, automatically create ProjectMember entries for all workspace members.

**Files Modified**:
- `label_studio/workplace_RBAC_extension/api.py` - WorkspaceViewSet.add_project()

**Logic/Reasoning**:
- Previously, workspace members accessed projects "implicitly" through workspace membership
- No ProjectMember records existed, causing users to appear "missing" or "inactive" in project member lists
- Solution: Automatically create explicit ProjectMember entries when project is added to workspace

**Code Changes**:
```python
# When adding project to workspace:
1. Create WorkspaceProject entry (existing)
2. NEW: For each enabled workspace member:
   - Create ProjectMember(user, project, enabled=True, deleted_at=NULL)
   - Uses update_or_create to handle existing records
```

**Benefits**:
- All workspace members now visible in project member list
- Consistent UI display
- Resolves "inactive" appearance issue

---

### 4. Auto-Add Projects to Members (Issue #2 Fix)

**Objective**: When adding a member to a workspace, automatically create ProjectMember entries for all workspace projects.

**Files Modified**:
- `label_studio/workplace_RBAC_extension/api.py` - WorkspaceViewSet.add_member()

**Logic/Reasoning**:
- When a new member joins a workspace, they should immediately have access to all workspace projects
- Creates explicit ProjectMember records for visibility and consistency

**Code Changes**:
```python
# When adding member to workspace:
1. Create WorkspaceMember entry (existing)
2. NEW: For each project in workspace:
   - Create ProjectMember(user, project, enabled=True, deleted_at=NULL)
   - Uses update_or_create to handle existing records
```

---

### 5. Fix Project Member Reactivation

**Objective**: Ensure re-adding a disabled user to a project reactivates them.

**Files Modified**:
- `label_studio/projects/api.py` - ProjectListAPI.perform_create()

**Logic/Reasoning**:
- `get_or_create()` only sets defaults on CREATE, not on UPDATE
- If a disabled ProjectMember exists, `get_or_create` returns it without updating `enabled`
- Solution: Use `update_or_create()` which updates existing records with defaults

**Code Changes**:
```python
# OLD:
ProjectMember.objects.get_or_create(
    user=user,
    project=project,
    defaults={"enabled": True}
)

# NEW:
ProjectMember.objects.update_or_create(
    user=user,
    project=project,
    defaults={"enabled": True, "deleted_at": None}
)
```

---

### 6. Frontend Cascade Confirmation Modal

**Objective**: Provide clear UI for admins to choose cascade option when removing workspace members.

**Files Modified**:
- `web/apps/labelstudio/src/pages/Workspaces_extension/WorkspaceDetail.jsx`

**UI Changes**:
```
When clicking "Remove Member":
1. Show confirmation modal with dropdown:
   - Remove from workspace only (keep project access)
   - Remove from workspace and disable in all projects (DEFAULT)
   - Remove from workspace and remove from all projects

2. Show affected project count

3. Require explicit confirmation
```

---

### API Changes Summary

**WorkspaceViewSet.remove_member() - New Request Body**:
```json
{
  "user_id": 123,
  "cascade_to_projects": "disable"
}
```

**WorkspaceViewSet.remove_member() - New Response**:
```json
{
  "message": "User removed from workspace",
  "cascade": "disable",
  "projects_affected": 5
}
```



---

### Backward Compatibility

✅ Fully backward compatible:
- Old API calls without `cascade_to_projects` use default ('disable')
- Existing ProjectMember records unaffected (deleted_at=NULL)
- All existing queries continue to work

---

## Migration Fix - Django Dependency Conflict Resolution

### Issue Encountered

After implementing the changes above, a migration dependency conflict occurred:

```
django.db.migrations.exceptions.InconsistentMigrationHistory: Migration workplace_RBAC_extension.0001_initial is applied before its dependency projects.0031_projectmember_deleted_at on database 'default'.
```

### Root Cause

The `workplace_RBAC_extension.0001_initial` migration used Django's `'__latest__'` dependency marker for both organizations and projects apps:

```python
dependencies = [
    ('organizations', '__latest__'),  # Anti-pattern
    ('projects', '__latest__'),        # Anti-pattern
    migrations.swappable_dependency(settings.AUTH_USER_MODEL),
]
```

**The Problem with `__latest__`:**
- When workplace_RBAC_extension.0001_initial was first applied, the latest projects migration was `0030_project_search_vector_index`
- We then added a new migration `0031_projectmember_deleted_at`
- Django tried to resolve `'__latest__'` to migration 0031
- But the database showed that workplace_RBAC_extension was already applied when only 0030 existed
- This created an inconsistent migration history

### Solution Applied

**File Modified**: `label_studio/workplace_RBAC_extension/migrations/0001_initial.py`

Changed dependencies from `'__latest__'` to explicit migration numbers:

```python
# BEFORE:
dependencies = [
    ('organizations', '__latest__'),
    ('projects', '__latest__'),
    migrations.swappable_dependency(settings.AUTH_USER_MODEL),
]

# AFTER:
dependencies = [
    ('organizations', '0007_add_role_field'),
    ('projects', '0030_project_search_vector_index'),
    migrations.swappable_dependency(settings.AUTH_USER_MODEL),
]
```

### Why This Fix Works

1. **Pinned Dependencies**: Explicitly states which migrations workplace_RBAC_extension actually depends on
2. **Accurate History**: Reflects the state when the migration was originally created and applied
3. **Allows New Migrations**: Permits `projects.0031_projectmember_deleted_at` to be applied after workplace_RBAC_extension.0001_initial
4. **Best Practice**: Follows Django's recommendation to avoid `'__latest__'` in production code

### Verification

After applying this fix, run:
```bash
python manage.py migrate
```

Expected output:
```
Running migrations:
  Applying projects.0031_projectmember_deleted_at... OK
```

### Prevention

**Going Forward:**
- ✅ Always use explicit migration numbers in dependencies
- ✅ Never use `'__latest__'` in production migrations
- ❌ Avoid `('app_name', '__latest__')` pattern

**Example - Correct Way:**
```python
dependencies = [
    ('organizations', '0007_add_role_field'),
    ('projects', '0031_projectmember_deleted_at'),
]
```