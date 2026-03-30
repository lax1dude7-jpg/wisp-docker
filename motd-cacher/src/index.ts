import WebSocket, { WebSocketServer } from "ws"
import { awaitPacket, hashServer } from "./util.js";
import { Motd } from "./motd.js"
import { URLSearchParams } from "url";
import BucketRateLimiter from "./ratelimit.js";
import { pack, unpack } from "msgpackr";
import { Redis } from "ioredis";

const wss = new WebSocketServer({
    port: 3000
})
const ratelimit = new BucketRateLimiter(120, 60)
const redis = new Redis()

redis.on('error', err => {
    console.error("redis error", err)
})

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
        
        if (!ratelimit.consume(ip, 1).success) {
            ws.close()
            handled = true
            return
        }

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
                const key = hashServer(host, port), hit = await redis.getBuffer(key)
                let motd: string, image: Buffer
                if (hit) {
                    const unpacked = unpack(hit) as ReturnType<Motd.MOTD['toBuffer']>
                    {
                        const parsed = JSON.parse(unpacked[0])
                        parsed.cache_hit = 'HIT'
                        motd = JSON.stringify(parsed)
                    }
                    image = unpacked[1]
                } else {
                    const fetch = (await Motd.MOTD.generateMOTDFromPing(host, port)).toBuffer()
                    {
                        const parsed = JSON.parse(fetch[0])
                        parsed.cache_hit = 'MISS'
                        motd = JSON.stringify(parsed)
                    }
                    await redis.set(key, pack(fetch), 'EX', 15)
                    image = fetch[1]
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