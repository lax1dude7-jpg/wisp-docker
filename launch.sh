#!/bin/sh
redis-server --bind 127.0.0.1 --maxmemory 64mb --maxmemory-policy allkeys-lru --protected-mode no --daemonize yes &

/app/warp-setup.sh
wireproxy -c /data/wireproxy.conf &
sleep 2

(cd /app/motd/dist && node index.js) &
proxychains -f /etc/proxychains.conf /app/epoxy/epoxy-server --format toml /app/epoxy/config.toml &
nginx -g "daemon off;"
