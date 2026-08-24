#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${CRONWATCH_CRONTAB_BACKUP_DIR:-${project_root}/var/backups/crontab}"
retention_days="${CRONWATCH_CRONTAB_BACKUP_RETENTION_DAYS:-90}"
timestamp="$(TZ=Europe/Madrid date '+%Y-%m-%d_%H-%M-%S')"
target="${backup_dir}/crontab-${timestamp}.txt"
temporary="${target}.tmp.$$"

mkdir -p "${backup_dir}"
chmod 700 "${backup_dir}"

if ! crontab -l >"${temporary}"; then
  rm -f "${temporary}"
  exit 1
fi

chmod 600 "${temporary}"
mv -f "${temporary}" "${target}"
find "${backup_dir}" -maxdepth 1 -type f -name 'crontab-*.txt' -mtime "+${retention_days}" -delete

printf 'Cron backup created: %s\n' "${target}"
