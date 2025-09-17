# Role System Implementation

## Overview
This implementation adds a comprehensive role-based access control (RBAC) system to Label Studio with 5 distinct roles: **owner**, **admin**, **reviewer**, **annotator**, and **inactive**.

## Roles and Permissions

### 1. Owner (Superuser)
- **Default assignment**: Organization creator
- **Permissions**:
  - Full system access
  - Billing management
  - All project management
  - User management
  - Annotation creation and review
  - Organization settings

### 2. Admin
- **Permissions**:
  - User management (limited)
  - All organization settings
  - All project management
  - Annotation creation and review

### 3. Reviewer
- **Permissions**:
  - Review annotations
  - Manage quality control
  - Annotation creation
  - View projects (read-only)

### 4. Annotator
- **Permissions**:
  - Create and edit annotations
  - View projects (read-only)
  - Cannot review annotations

### 5. Inactive
- **Default assignment**: New users
- **Permissions**:
  - No access to system features
  - Must be activated by admin/owner

## Implementation Details

### Database Changes
- Added `role` field to `OrganizationMember` model
- Field type: `CharField` with choices
- Default value: `'inactive'`
- Migration: `0007_add_role_field.py`

### Model Updates

#### OrganizationMember Model
```python
ROLE_CHOICES = [
    ('owner', 'Owner'),
    ('admin', 'Admin'),
    ('reviewer', 'Reviewer'),
    ('annotator', 'Annotator'),
    ('inactive', 'Inactive'),
]

role = models.CharField(
    _('role'),
    max_length=20,
    choices=ROLE_CHOICES,
    default='inactive',
    help_text=_('Role of the user in the organization')
)
```

#### Helper Methods Added
- `is_owner()` - Check if user is owner
- `is_admin()` - Check if user is admin
- `is_reviewer()` - Check if user is reviewer
- `is_annotator()` - Check if user is annotator
- `is_inactive()` - Check if user is inactive
- `is_active_role()` - Check if user has active role
- `can_manage_users()` - Check user management permissions
- `can_manage_projects()` - Check project management permissions
- `can_review_annotations()` - Check annotation review permissions
- `can_create_annotations()` - Check annotation creation permissions

### User Creation Process
- **New users**: Automatically assigned `inactive` role
- **Organization creators**: Automatically assigned `owner` role
- **Existing organizations**: New users added with `inactive` role

### API Updates
- Updated `OrganizationMemberSerializer` to include role information
- Updated `OrganizationMemberListSerializer` to include role information
- Role information now available in API responses

## Files Modified

1. **`label_studio/organizations/models.py`**
   - Added role field and choices
   - Added helper methods for role checking
   - Updated `add_user()` method to accept role parameter

2. **`label_studio/organizations/functions.py`**
   - Updated `create_organization()` to assign owner role to creator

3. **`label_studio/organizations/serializers.py`**
   - Updated serializers to include role information

4. **`label_studio/users/functions/common.py`**
   - Updated user signup to assign inactive role

5. **`label_studio/server.py`**
   - Updated user creation to assign inactive role

6. **`label_studio/organizations/migrations/0007_add_role_field.py`**
   - Database migration for role field

## Usage Examples

### Creating a User with Specific Role
```python
# Add user with specific role
org.add_user(user, role='admin')

# Create organization (creator becomes owner)
org = Organization.create_organization(created_by=user, title='My Org')
```

### Checking User Permissions
```python
membership = OrganizationMember.objects.get(user=user, organization=org)

# Check role
if membership.is_admin:
    print("User is an admin")

# Check permissions
if membership.can_manage_users():
    print("User can manage other users")

if membership.can_review_annotations():
    print("User can review annotations")
```

### Updating User Role
```python
membership.role = 'reviewer'
membership.save()
```

## Migration Status
- Migration created and applied (fake-applied due to existing column)
- Database schema updated with role field
- All existing users will have the default 'inactive' role

## Next Steps
1. Update frontend UI to display and manage roles
2. Add role-based access controls to views and API endpoints
3. Implement role assignment interface for administrators
4. Add role-based filtering and permissions throughout the application
