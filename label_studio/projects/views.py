"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging

from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.http import HttpResponseForbidden
from organizations.models import OrganizationMember

logger = logging.getLogger(__name__)


@login_required
def project_list(request):
    return render(request, 'projects/list.html')


@login_required
def project_settings(request, pk, sub_path):
    user = request.user
    # Get org role for user
    org_member = OrganizationMember.objects.filter(user=user, organization=user.active_organization).first()
    if not org_member or org_member.role not in ["admin", "owner"]:
        return HttpResponseForbidden("You do not have permission to access this page.")
    return render(request, 'projects/settings.html')
