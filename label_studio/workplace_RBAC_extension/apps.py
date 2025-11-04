"""
Django App Configuration for Workspace RBAC Extension.

This module configures the workspace RBAC app within Django's application framework.
The ready() method is called during Django startup to register permissions with
the django-rules library.

Upstream dependencies (what this imports):
    - django.apps.AppConfig: Django app configuration base class
    - permissions module: Imported in ready() to trigger rule registration

Downstream consumers:
    - Django: Loads this config when 'workplace_RBAC_extension' is in INSTALLED_APPS
    - permissions.py: Executes rules.add_perm() when imported by ready()

Startup flow:
    1. Django loads INSTALLED_APPS from settings
    2. Finds this AppConfig class
    3. Calls ready() method after all apps loaded
    4. Imports permissions.py, which registers workspace rules
    5. Workspace permissions become available via rules.test_rule()
"""

from django.apps import AppConfig


class WorkspaceRBACExtensionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'label_studio.workplace_RBAC_extension'
    verbose_name = 'Workspace RBAC Extension'

    def ready(self):
        """
        Called when Django starts.
        Register our custom permissions here.
        """
        # Import permissions to register them with django-rules
        try:
            from . import permissions  # noqa: F401
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f'Failed to load workspace permissions: {e}')
