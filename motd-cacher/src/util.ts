import sharp from "sharp"
import WebSocket from "ws"
import * as crypto from "crypto"

const ICON_SQRT = 64
export function generateEaglerMOTDImage(file: string | Buffer): Promise<Buffer> {
    return sharp(file)
        .resize(ICON_SQRT, ICON_SQRT, {
            kernel: "nearest",
        })
        .ensureAlpha()
        .raw({
            depth: "uchar",
        })
        .toBuffer();
}

export function awaitPacket(ws: WebSocket, filter?: (msg: Buffer) => boolean): Promise<Buffer> {
    return new Promise<Buffer>((res, rej) => {
        let resolved = false;
        const msgCb = (msg: any) => {
            if (filter != null && filter(msg)) {
                resolved = true;
                ws.removeListener("message", msgCb);
                ws.removeListener("close", discon);
                ws.setMaxListeners(ws.getMaxListeners() - 2 < 0 ? 5 : ws.getMaxListeners() - 2);
                res(msg);
            } else if (filter == null) {
                resolved = true;
                ws.removeListener("message", msgCb);
                ws.removeListener("close", discon);
                ws.setMaxListeners(ws.getMaxListeners() - 2 < 0 ? 5 : ws.getMaxListeners() - 2);
                res(msg);
            }
        };
        const discon = () => {
            resolved = true;
            ws.removeListener("message", msgCb);
            ws.removeListener("close", discon);
            ws.setMaxListeners(ws.getMaxListeners() - 2 < 0 ? 5 : ws.getMaxListeners() - 2);
            rej("Connection closed");
        };
        ws.setMaxListeners(ws.getMaxListeners() + 2);
        ws.on("message", msgCb);
        ws.on("close", discon);
        setTimeout(() => {
            ws.removeListener("message", msgCb);
            ws.removeListener("close", discon);
            ws.setMaxListeners(ws.getMaxListeners() - 2 < 0 ? 5 : ws.getMaxListeners() - 2);
            rej("Timed out");
        }, 10000);
    });
}

export function uuidStringToBuffer(uuid: string): Buffer {
    if (!uuid) return Buffer.alloc(16); // Return empty buffer
    const hexStr = uuid.replace(/-/g, "");
    if (uuid.length != 36 || hexStr.length != 32) throw new Error(`Invalid UUID string: ${uuid}`);
    return Buffer.from(hexStr, "hex");
}

export function uuidBufferToString(buffer: Buffer): string | null {
    if (buffer.length != 16) throw new Error(`Invalid buffer length for uuid: ${buffer.length}`);
    if (buffer.equals(Buffer.alloc(16))) return null; // If buffer is all zeros, return null
    const str = buffer.toString("hex");
    return `${str.slice(0, 8)}-${str.slice(8, 12)}-${str.slice(12, 16)}-${str.slice(16, 20)}-${str.slice(20)}`;
}

export function hashServer(host: string, port: number): string {
    const engine = crypto.createHash('sha256')
    engine.write(Buffer.concat([Buffer.from(host), Buffer.from(String(port))]))
    return engine.digest().toString('hex')
}