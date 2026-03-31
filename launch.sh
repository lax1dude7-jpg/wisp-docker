#!/bin/sh

# WARNING! Don't run this script directly!
# The backend is meant to be launched through Docker. Please use that instead.

if [ "${DISABLE_WARP}" != "1" ]; then
    /app/warp-setup.sh
    wireproxy -c /data/wireproxy.conf &
    sleep 2
fi

if [ "${DISABLE_MOTD_PROXY}" != "1" ]; then
    redis-server --bind 127.0.0.1 --maxmemory 64mb --maxmemory-policy allkeys-lru --protected-mode no --daemonize yes &
    (cd /app/motd/dist && node index.js) &
fi

if [ "${DISABLE_WARP}" != "1" ]; then
    proxychains -f /etc/proxychains.conf /app/epoxy/epoxy-server --format toml /app/epoxy/config.toml &
else
    /app/epoxy/epoxy-server --format toml /app/epoxy/config.toml &
fi

nginx -g "daemon off;"
