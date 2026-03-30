FROM alpine:latest

EXPOSE 80

# set up redis for motd caching
# RUN apk add --update redis

# nginx
RUN apk add nginx
RUN mkdir -p /run/nginx
COPY ./nginx.conf /etc/nginx/nginx.conf

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
COPY ./wisp/ /app/epoxy

COPY ./warp-setup.sh /app/
COPY ./launch.sh /app/ 
RUN mkdir -p /data
CMD ["/bin/sh", "/app/launch.sh"]