FROM alpine:latest

EXPOSE 80

# set up redis for motd caching
RUN apk add --update redis

# nginx
RUN apk add nginx
RUN mkdir -p /run/nginx
COPY ./nginx.conf /etc/nginx/nginx.conf

# set up cache server
RUN apk add nodejs npm
WORKDIR /app/motd
COPY ./motd-cacher/ /app/motd/
RUN npm install
RUN npx tsc

# set up the app
WORKDIR /app/epoxy
COPY ./wisp/ /app/epoxy

COPY ./launch.sh /app/ 
CMD ["/bin/sh", "/app/launch.sh"]