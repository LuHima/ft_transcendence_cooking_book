#!/bin/sh
set -eu

# Background watcher for ACME certificate renewal markers on the shared SSL volume.
# Launched via /docker-entrypoint.d/ so CMD remains ["nginx", "-g", "daemon off;"]
# and upstream /docker-entrypoint.sh still executes template envsubst & ModSecurity hooks.
(
	LAST=""
	while sleep 30; do
		if [ -f /etc/nginx/conf/.reload_needed ]; then
			CUR=$(cat /etc/nginx/conf/.reload_needed 2>/dev/null || true)
			if [ -n "$CUR" ] && [ "$CUR" != "$LAST" ]; then
				LAST="$CUR"
				echo "$LAST" > /tmp/.last_reload_marker
				nginx -s reload || true
			fi
		fi
	done
) </dev/null >/dev/null 2>&1 &

exit 0
