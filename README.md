# wisp-docker

## What?

This public GitHub repository contains files used for the Wisp backend used on my [Eaglercraft website](https://eaglercraft.q13x.com). Here, you can find code and configuration files for the Wisp backend, as well as the customized Wispcraft client used to communicate with the integrated Eaglercraft MOTD caching server.

A Dockerfile is included for easy setup: to host this yourself, simply open this GitHub repository in your favorite hosting platform with Docker support. Render is a good one; it's free and works well!

There's also an integrated [Eaglercraft MOTD caching server](motd-cacher/README.md) and an accomplying [modified Wispcraft fork](wispcraft/README.md), if you'd like to take a look at those too.

## Features

* Simple installation and deployment through the `Dockerfile`
* Custom Wispcraft fork with support for Vanilla server MOTD caching
* Optional Cloudflare WARP support for IP masking (via proxychains)

## Configuration Options

All of the following exist as environment variables, and can be set to change the behavior of the wisp-docker server.
* `DISABLE_WARP` - set to `1` to disable the Cloudflare WARP tunnel. Useful if you want to use your host's IP address, or cannot use WARP at all. Consider keeping WARP on if you're running a public facing Wisp server and want to keep your IP largely anonymous.
* `DISABLE_MOTD_PROXY` - set to `1` to disable the internal Eaglercraft MOTD proxy. Useful if you don't intend on using the Wisp server specifically for Eaglercraft clients, or aren't running the modified Wispcraft fork.