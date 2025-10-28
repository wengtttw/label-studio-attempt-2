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