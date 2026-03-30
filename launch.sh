#!/bin/sh
redis-server --bind 127.0.0.1 --maxmemory 64mb --maxmemory-policy allkeys-lru --protected-mode no --daemonize yes &
(cd /app/motd/dist && node index.js) &
/app/epoxy/epoxy-server --format toml /app/epoxy/config.toml &
nginx -g "daemon off;"