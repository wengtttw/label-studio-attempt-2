"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging

from core.utils.common import create_hash, load_func
from django.conf import settings
from django.db import models, transaction
from django.db.models import Count, Q
from django.db.models import Case, When, Value, IntegerField
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)

OrganizationMemberMixin = load_func(settings.ORGANIZATION_MEMBER_MIXIN)


class OrganizationMember(OrganizationMemberMixin, models.Model):
    """ """

    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('reviewer', 'Reviewer'),
        ('annotator', 'Annotator'),
        ('inactive', 'Inactive'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='om_through', help_text='User ID'
    )
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE, help_text='Organization ID'
    )
    role = models.CharField(
        _('role'),
        max_length=20,
        choices=ROLE_CHOICES,
        default='inactive',
        help_text=_('Role of the user in the organization')
    )

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    deleted_at = models.DateTimeField(
        _('deleted at'),
        default=None,
        null=True,
        blank=True,
        db_index=True,
        help_text='Timestamp indicating when the organization member was marked as deleted.  '
        'If NULL, the member is not considered deleted.',
    )

    # objects = OrganizationMemberQuerySet.as_manager()

    @classmethod
    def find_by_user(cls, user_or_user_pk, organization_pk):
        from users.models import User

        user_pk = user_or_user_pk.pk if isinstance(user_or_user_pk, User) else user_or_user_pk
        return OrganizationMember.objects.get(user=user_pk, organization=organization_pk)

    @cached_property
    def is_deleted(self):
        return bool(self.deleted_at)

    @cached_property
    def is_owner(self):
        return self.role == 'owner' or self.user.id == self.organization.created_by.id

    @cached_property
    def is_admin(self):
        return self.role == 'admin'

    @cached_property
    def is_reviewer(self):
        return self.role == 'reviewer'

    @cached_property
    def is_annotator(self):
        return self.role == 'annotator'

    @cached_property
    def is_inactive(self):
        return self.role == 'inactive'

    @cached_property
    def is_active_role(self):
        return self.role in ['owner', 'admin', 'reviewer', 'annotator']

    def can_manage_users(self):
        """Check if user can manage other users in the organization"""
        return self.role in ['owner', 'admin']

    def can_manage_projects(self):
        """Check if user can manage projects in the organization"""
        return self.role in ['owner', 'admin']

    def can_review_annotations(self):
        """Check if user can review annotations"""
        return self.role in ['owner', 'admin', 'reviewer']

    def can_create_annotations(self):
        """Check if user can create annotations"""
        return self.role in ['owner', 'admin', 'reviewer', 'annotator']

    class Meta:
        ordering = ['pk']

        #Changes by Chris, added indexes for faster lookup.
        indexes=[
            models.Index(fields=[ 'user', 'organization','deleted_at' ],name='org_member_lookup_idx'),
            models.Index(fields=['organization','role'],name='org_member_role_idx'),
            models.Index(fields=['role'],name='org_member_global_role_idx'),
        ]

    def soft_delete(self):
        with transaction.atomic():
            self.deleted_at = timezone.now()
            self.save(update_fields=['deleted_at'])
            self.user.active_organization = self.user.organizations.filter(
                organizationmember__deleted_at__isnull=True
            ).first()
            if self.user.avatar:
                self.user.avatar.delete(save=False)
                self.user.avatar = None
            self.user.save(update_fields=['active_organization', 'avatar'])

        self.user.task_locks.all().delete()


OrganizationMixin = load_func(settings.ORGANIZATION_MIXIN)


class Organization(OrganizationMixin, models.Model):
    """ """

    title = models.CharField(_('organization title'), max_length=1000, null=False)

    token = models.CharField(_('token'), max_length=256, default=create_hash, unique=True, null=True, blank=True)

    users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='organizations', through=OrganizationMember)

    created_by = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='organization',
        verbose_name=_('created_by'),
    )

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    contact_info = models.EmailField(_('contact info'), blank=True, null=True)

    def __str__(self):
        return self.title + ', id=' + str(self.pk)

    @classmethod
    def create_organization(cls, created_by=None, title='Your Organization', **kwargs):
        _create_organization = load_func(settings.CREATE_ORGANIZATION)
        return _create_organization(title=title, created_by=created_by, **kwargs)

    @classmethod
    def find_by_user(cls, user, check_deleted=False):
        # Prefer an active (non-deleted) membership with an active role (not 'inactive').
        # Fallback order:
        # 1) non-deleted membership with active role (owner/admin/reviewer/annotator)
        # 2) any non-deleted membership
        # 3) any membership (including soft-deleted)
        active_role_members = OrganizationMember.objects.filter(
            user=user, deleted_at__isnull=True, role__in=['owner', 'admin', 'reviewer', 'annotator']
        ).prefetch_related('organization')
        if active_role_members.exists():
            membership = active_role_members.first()
        else:
            non_deleted = OrganizationMember.objects.filter(user=user, deleted_at__isnull=True).prefetch_related('organization')
            if non_deleted.exists():
                membership = non_deleted.first()
            else:
                # fallback to any membership (keeps legacy behaviour if no non-deleted records found)
                memberships = OrganizationMember.objects.filter(user=user).prefetch_related('organization')
                if not memberships.exists():
                    raise ValueError(f'No memberships found for user {user}')
                membership = memberships.first()

        if check_deleted:
            return (membership.organization, True) if membership.deleted_at else (membership.organization, False)

        return membership.organization

    @classmethod
    def find_by_invite_url(cls, url):
        token = url.strip('/').split('/')[-1]
        if len(token):
            return Organization.objects.get(token=token)
        else:
            raise KeyError(f"Can't find Organization by welcome URL: {url}")

    def has_user(self, user):
        return self.users.filter(pk=user.pk).exists()

    def has_deleted(self, user):
        return OrganizationMember.objects.filter(user=user, organization=self, deleted_at__isnull=False).exists()

    def has_project_member(self, user):
        return self.projects.filter(members__user=user).exists()

    def has_permission(self, user):
        return OrganizationMember.objects.filter(user=user, organization=self, deleted_at__isnull=True).exists()

    def add_user(self, user, role='inactive'):
        if self.users.filter(pk=user.pk).exists():
            logger.debug('User already exists in organization.')
            return

        with transaction.atomic():
            om = OrganizationMember(user=user, organization=self, role=role)
            om.save()

            return om

    def remove_user(self, user):
        OrganizationMember.objects.filter(user=user, organization=self).delete()
        if user.active_organization_id == self.id:
            user.active_organization = user.organizations.filter(organizationmember__deleted_at__isnull=True).first()
            user.save(update_fields=['active_organization'])

    def reset_token(self):
        self.token = create_hash()
        self.save(update_fields=['token'])

    def check_max_projects(self):
        """This check raise an exception if the projects limit is hit"""
        pass

    def projects_sorted_by_created_at(self):
        return (
            self.projects.all()
            .order_by('-created_at')
            .annotate(tasks_count=Count('tasks'), labeled_tasks_count=Count('tasks', filter=Q(tasks__is_labeled=True)))
            .prefetch_related('created_by')
        )

    def created_at_prettify(self):
        return self.created_at.strftime('%d %b %Y %H:%M:%S')

    def per_project_invited_users(self):
        from users.models import User

        invited_ids = self.projects.values_list('members__user__pk', flat=True).distinct()
        per_project_invited_users = User.objects.filter(pk__in=invited_ids)
        return per_project_invited_users

    def should_verify_ssl_certs(self) -> bool:
        if hasattr(self, 'billing') and (org_verify := self.billing.verify_ssl_certs()) is not None:
            return org_verify
        return settings.VERIFY_SSL_CERTS

    @cached_property
    def secure_mode(self):
        return False

    @cached_property
    def members(self):
        return OrganizationMember.objects.filter(organization=self)

    class Meta:
        db_table = 'organization'


class Workspace(models.Model):
    """Workspace / Team which can own projects and have members.

    Simple model mirroring Organization but scoped to projects grouping.
    """

    title = models.CharField(_('workspace title'), max_length=1000, null=False)

    token = models.CharField(
        _('token'), max_length=256, default=create_hash, unique=True, null=True, blank=True
    )

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.SET_NULL, null=True, blank=True, related_name='workspaces'
    )

    users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='workspaces', through='WorkspaceMember')

    # allow a user to create multiple workspaces (many workspaces -> one user)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_workspaces',
        verbose_name=_('created_by'),
    )

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    contact_info = models.EmailField(_('contact info'), blank=True, null=True)

    def __str__(self):
        return self.title + ', id=' + str(self.pk)


class WorkspaceMember(models.Model):
    """Membership record for workspaces.

    When a WorkspaceMember becomes active, we create corresponding ProjectMember rows
    (enabled=False by default) for the projects attached to the workspace. When a
    WorkspaceMember is deactivated/soft-deleted, the workspace-origin project members
    are disabled.
    """

    # No per-workspace roles here: permission/role checks should be resolved via
    # OrganizationMember semantics. Workspace membership is a simple active/inactive
    # membership (soft-delete via deleted_at).
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wm_through', help_text='User ID'
    )
    workspace = models.ForeignKey('organizations.Workspace', on_delete=models.CASCADE, help_text='Workspace ID')

    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    deleted_at = models.DateTimeField(
        _('deleted at'),
        default=None,
        null=True,
        blank=True,
        db_index=True,
        help_text='Timestamp indicating when the workspace member was marked as deleted. If NULL, the member is not considered deleted.',
    )

    class Meta:
        ordering = ['pk']

    @property
    def is_active(self):
        """WorkspaceMember is active when not soft-deleted. Role checks should be
        sourced from OrganizationMember when needed elsewhere in the system."""
        return self.deleted_at is None


# Signals: keep workspace membership synced into project membership
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=WorkspaceMember)
def _sync_workspace_member_to_projects(sender, instance: WorkspaceMember, **kwargs):
    """Ensure that when a WorkspaceMember is active, the user is present as ProjectMember
    for projects belonging to the workspace. We create ProjectMember rows only when they
    don't exist. Created ProjectMember rows are created with enabled=False as requested.

    If the WorkspaceMember is not active (role inactive or soft-deleted), we disable
    ProjectMember rows that were created for this WorkspaceMember (matching workspace_member FK).
    """
    # import here to avoid circular imports
    try:
        from projects.models import Project, ProjectMember
    except Exception:
        # If projects app is not yet ready during migrations, just skip.
        return

    active = instance.is_active

    if active:
        projects = instance.workspace.projects.all()
        for p in projects:
            # If user already a ProjectMember for this project, skip (do not create).
            pm_qs = ProjectMember.objects.filter(user=instance.user, project=p)
            if pm_qs.exists():
                # leave existing membership untouched
                continue

            # create a project member for the user tied to this workspace_member
            try:
                ProjectMember.objects.create(
                    user=instance.user, project=p, enabled=False, workspace_member=instance
                )
            except Exception:
                # swallow errors during migrations or race conditions
                logger.exception('Failed to create ProjectMember for workspace sync', exc_info=True)
    else:
        # deactivate project members that were created by this workspace member
        try:
            ProjectMember.objects.filter(workspace_member=instance, enabled=True).update(enabled=False)
        except Exception:
            logger.exception('Failed to disable ProjectMembers for workspace sync', exc_info=True)
