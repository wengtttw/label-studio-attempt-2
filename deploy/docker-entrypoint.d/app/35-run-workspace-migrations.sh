#!/bin/sh
set -e ${DEBUG:+-x}

if [ "${SKIP_DB_MIGRATIONS:-}" != "true" ]; then
  echo >&3 "=> Running workspace RBAC extension migrations..."
  python3 /label-studio/label_studio/manage.py migrate workplace_RBAC_extension >&3 2>&3 || echo >&3 "=> Workspace migrations may have already been applied."
  echo >&3 "=> Workspace migrations completed."
else
  echo >&3 "=> Skipping workspace migrations."
fi
