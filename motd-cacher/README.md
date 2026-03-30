# motd-cacher

Source code for the Java MOTD cacher used on my Eaglercraft website, to be used in conjunction of a modified Wispcraft client.

## Why?

Wispcraft, by default, does _not_ cache MOTDs: it is fully incapable of doing that. Since all site visitors use only one of a few Wisp exit nodes dedicated to this website, ALL MOTD requests for Vanilla servers are sent through a single chokepoint (the regional Wisp server). As all the requests seemingly originate from a single IP, some servers (tsk tsk Hypixel) notice the high request volume and end up temporarily fully blocking the shared Wisp server entirely.

Caching the MOTD circumvents this issue: a single MOTD cache layer per regional Wisp server can serve hundreds of users per a single periodic MOTD request. Unfortunately, this necessitates the use of a modified client that is correctly set up to make use of the caching layer.

## Attributions

In another life, the code responsible for pulling MOTDs and communicating with the Eaglercraft client was used in my EaglerProxy client.
