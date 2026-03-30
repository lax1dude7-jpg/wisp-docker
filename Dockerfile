# --- Stage 1: Build epoxy-server from source (dynamically linked) ---
FROM rust:alpine AS epoxy-builder

RUN apk add --no-cache musl-dev git cmake make gcc g++ perl

WORKDIR /build
RUN git clone --branch multiplexed --depth 1 https://github.com/MercuryWorkshop/epoxy-tls.git .

WORKDIR /build/server
ENV RUSTFLAGS="-C target-feature=-crt-static"
RUN cargo build --release --features speed-limit

# --- Stage 2: Runtime ---
FROM alpine:latest

EXPOSE 80

# redis for motd caching
RUN apk add --update redis

# runtime deps for dynamically-linked epoxy-server + proxychains
RUN apk add --no-cache libgcc libstdc++ proxychains-ng

# nginx
RUN apk add nginx
RUN mkdir -p /run/nginx
COPY ./nginx.conf /etc/nginx/nginx.conf

# proxychains config for WARP SOCKS5
RUN printf '[ProxyList]\nsocks5 127.0.0.1 40000\n' > /etc/proxychains.conf

# wgcf + wireproxy for Cloudflare WARP SOCKS5
RUN apk add --no-cache curl && \
    curl -L -o /usr/local/bin/wgcf https://github.com/ViRb3/wgcf/releases/download/v2.2.30/wgcf_2.2.30_linux_amd64 && \
    chmod +x /usr/local/bin/wgcf && \
    curl -L -o /tmp/wireproxy.tar.gz https://github.com/windtf/wireproxy/releases/download/v1.0.9/wireproxy_linux_amd64.tar.gz && \
    tar -xzf /tmp/wireproxy.tar.gz -C /usr/local/bin/ wireproxy && \
    chmod +x /usr/local/bin/wireproxy && \
    rm /tmp/wireproxy.tar.gz

# set up cache server
RUN apk add nodejs npm
WORKDIR /app/motd
COPY ./motd-cacher/ /app/motd/
RUN npm install
RUN npx tsc

# set up the app
WORKDIR /app/epoxy
COPY ./wisp/config.toml /app/epoxy/config.toml
COPY --from=epoxy-builder /build/target/release/epoxy-server /app/epoxy/epoxy-server

COPY ./warp-setup.sh /app/
COPY ./launch.sh /app/ 
RUN mkdir -p /data
CMD ["/bin/sh", "/app/launch.sh"]