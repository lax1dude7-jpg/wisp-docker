import WebSocket, { WebSocketServer } from "ws"
import { awaitPacket, hashServer } from "./util.js";
import { Motd } from "./motd.js"
import { URLSearchParams } from "url";
import BucketRateLimiter from "./ratelimit.js";
// import { pack, unpack } from "msgpackr";
// import { Redis } from "ioredis";

const wss = new WebSocketServer({
    port: 3000
})
// const ratelimit = new BucketRateLimiter(120, 60)
// const redis = new Redis()

// redis.on('error', err => {
//     console.log("redis error", err)
// })

const cache = new Map<string, { motd: string, image: Buffer, expires: number }>()
const CACHE_TTL_MS = 15_000

setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache) {
        if (entry.expires <= now) cache.delete(key)
    }
}, CACHE_TTL_MS)

const TRUST_FORWARDED_IP = true

wss.on('connection', async (ws, request) => {
    try {
        let handled: boolean = false
        setTimeout(() => {
            if (!handled) ws.close()
        }, 30_000);
        ws.once('close', () => handled = true)

        const ip = TRUST_FORWARDED_IP ?
            ((request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                request.socket.remoteAddress!) : request.socket.remoteAddress!;
        
        // if (!ratelimit.consume(ip, 1).success) {
        //     ws.close()
        //     handled = true
        //     return
        // }

        // find the server ip
        const url = new URL("http://urmom" + request.url).searchParams.get("fullHost")
        let host: string, port: number
        if (url == null) {
            handled = true
            ws.close()
            return
        } else {
            const split = url.split(':', 2)
            if (split.length == 1) {
                host = split[0]!
                port = 25565
            } else {
                host = split[0]!
                port = parseInt(split[1]!)
                if (isNaN(port)) {
                    handled = true
                    ws.close()
                    return
                }
            }
        }

        const initial = await awaitPacket(ws)

        if (/^accept: motd/i.test(initial.toString()) && !handled) {
            try {
                const key = hashServer(host, port)
                const hit = cache.get(key)
                let motd: string, image: Buffer
                if (hit && hit.expires > Date.now()) {
                    const parsed = JSON.parse(hit.motd)
                    parsed.cache_hit = 'HIT'
                    motd = JSON.stringify(parsed)
                    image = hit.image
                } else {
                    cache.delete(key)
                    const fetch = (await Motd.MOTD.generateMOTDFromPing(host, port)).toBuffer()
                    const parsed = JSON.parse(fetch[0])
                    parsed.cache_hit = 'MISS'
                    motd = JSON.stringify(parsed)
                    image = fetch[1]
                    cache.set(key, { motd: fetch[0], image, expires: Date.now() + CACHE_TTL_MS })
                }
                if (!handled) {
                    ws.send(motd)
                    ws.send(image)
                    ws.close()
                }
            } catch (err) {
                console.error(`[${host}:${port}] MOTD fetch failed:`, err)
                ws.close()
                handled = true
            }
        } else {
            ws.close()
            handled = true
        }

    } catch (err) {
        console.error("[connection] unhandled error:", err)
        ws.close()
    }
})

wss.once('listening', () => {
    console.log("server listening")
})