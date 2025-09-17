"""Role-based permission rules for Label Studio."""
import rules
from organizations.models import OrganizationMember


def is_active_user(user):
    """Check if user is active (not inactive role)."""
    if not user.is_authenticated:
        return False
    
    # Superusers and owners always have access
    if user.is_superuser:
        return True
    
    # Check if user has an active organization
    if not user.active_organization:
        return False
    
    # Get user's role in the organization
    try:
        member = OrganizationMember.objects.get(
            user=user, 
            organization=user.active_organization
        )
        # User must have a role and it must not be inactive
        return member.role is not None and member.role != OrganizationMember.ROLE_INACTIVE
    except OrganizationMember.DoesNotExist:
        return False


def is_admin_or_owner(user):
    """Check if user is admin or owner."""
    if not user.is_authenticated:
        return False
    
    # Superusers always have access
    if user.is_superuser:
        return True
    
    # Check if user is organization owner
    if user.active_organization and user.active_organization.created_by == user:
        return True
    
    # Check if user has admin role
    if not user.active_organization:
        return False
    
    try:
        member = OrganizationMember.objects.get(
            user=user, 
            organization=user.active_organization
        )
        return member.role == OrganizationMember.ROLE_ADMIN
    except OrganizationMember.DoesNotExist:
        return False


def is_annotator_or_above(user):
    """Check if user is annotator, reviewer, admin, or owner."""
    if not user.is_authenticated:
        return False
    
    # Superusers always have access
    if user.is_superuser:
        return True
    
    # Check if user is organization owner
    if user.active_organization and user.active_organization.created_by == user:
        return True
    
    # Check if user has appropriate role
    if not user.active_organization:
        return False
    
    try:
        member = OrganizationMember.objects.get(
            user=user, 
            organization=user.active_organization
        )
        return member.role in [
            OrganizationMember.ROLE_ANNOTATOR,
            OrganizationMember.ROLE_REVIEWER,
            OrganizationMember.ROLE_ADMIN
        ]
    except OrganizationMember.DoesNotExist:
        return False


def is_reviewer_or_above(user):
    """Check if user is reviewer, admin, or owner."""
    if not user.is_authenticated:
        return False
    
    # Superusers always have access
    if user.is_superuser:
        return True
    
    # Check if user is organization owner
    if user.active_organization and user.active_organization.created_by == user:
        return True
    
    # Check if user has appropriate role
    if not user.active_organization:
        return False
    
    try:
        member = OrganizationMember.objects.get(
            user=user, 
            organization=user.active_organization
        )
        return member.role in [
            OrganizationMember.ROLE_REVIEWER,
            OrganizationMember.ROLE_ADMIN
        ]
    except OrganizationMember.DoesNotExist:
        return False


def can_view_projects(user):
    """Check if user can view projects."""
    return is_annotator_or_above(user)


def can_create_projects(user):
    """Check if user can create projects."""
    return is_admin_or_owner(user)


def can_edit_projects(user):
    """Check if user can edit projects."""
    return is_admin_or_owner(user)


def can_delete_projects(user):
    """Check if user can delete projects."""
    return is_admin_or_owner(user)


def can_view_organization(user):
    """Check if user can view organization settings."""
    return is_admin_or_owner(user)


def can_edit_organization(user):
    """Check if user can edit organization settings."""
    return is_admin_or_owner(user)


def can_view_annotations(user):
    """Check if user can view annotations."""
    return is_annotator_or_above(user)


def can_create_annotations(user):
    """Check if user can create annotations."""
    return is_annotator_or_above(user)


def can_edit_annotations(user):
    """Check if user can edit annotations."""
    return is_annotator_or_above(user)


def can_delete_annotations(user):
    """Check if user can delete annotations."""
    return is_annotator_or_above(user)


def can_view_tasks(user):
    """Check if user can view tasks."""
    return is_annotator_or_above(user)


def can_create_tasks(user):
    """Check if user can create tasks."""
    return is_admin_or_owner(user)


def can_edit_tasks(user):
    """Check if user can edit tasks."""
    return is_admin_or_owner(user)


def can_delete_tasks(user):
    """Check if user can delete tasks."""
    return is_admin_or_owner(user)
