#!/bin/sh
set -e

DATA_DIR="/data"
ACCOUNT_FILE="$DATA_DIR/wgcf-account.toml"
PROFILE_FILE="$DATA_DIR/wgcf-profile.conf"
WIREPROXY_CONF="$DATA_DIR/wireproxy.conf"

if [ -f "$WIREPROXY_CONF" ]; then
    echo "[warp-setup] wireproxy.conf already exists, skipping registration"
    exit 0
fi

cd "$DATA_DIR"

if [ ! -f "$ACCOUNT_FILE" ]; then
    echo "[warp-setup] registering new WARP account..."
    wgcf register --accept-tos
    echo "[warp-setup] registration complete"
fi

if [ ! -f "$PROFILE_FILE" ]; then
    echo "[warp-setup] generating WireGuard profile..."
    wgcf generate
    echo "[warp-setup] profile generated"
fi

echo "[warp-setup] building wireproxy.conf from profile..."

PRIVATE_KEY=$(grep -E '^PrivateKey' "$PROFILE_FILE" | head -1 | cut -d'=' -f2- | tr -d ' ')
ADDRESS=$(grep -E '^Address' "$PROFILE_FILE" | head -1 | cut -d'=' -f2- | tr -d ' ')
PUBLIC_KEY=$(grep -E '^PublicKey' "$PROFILE_FILE" | head -1 | cut -d'=' -f2- | tr -d ' ')
ENDPOINT=$(grep -E '^Endpoint' "$PROFILE_FILE" | head -1 | cut -d'=' -f2- | tr -d ' ')

cat > "$WIREPROXY_CONF" <<EOF
[Interface]
Address = $ADDRESS
PrivateKey = $PRIVATE_KEY
DNS = 1.1.1.1
MTU = 1280

[Peer]
PublicKey = $PUBLIC_KEY
Endpoint = $ENDPOINT
AllowedIPs = 0.0.0.0/0, ::/0

[Socks5]
BindAddress = 127.0.0.1:40000
EOF

echo "[warp-setup] wireproxy.conf written to $WIREPROXY_CONF"
