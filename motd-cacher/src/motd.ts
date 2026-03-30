import { randomUUID } from "crypto";
import pkg, { type NewPingResult } from "minecraft-protocol";
import { Chat } from "./eaglerproxy/Chat.js";
import { generateEaglerMOTDImage } from "./util.js";
const { ping } = pkg;

const BRAND = 'motd-cacher', FULL_VERSION = `${BRAND}/67.41`
const IMAGE_DATA_PREPEND = "data:image/png;base64,"

export namespace Motd {
  export class MOTD {
    public jsonMotd: JSONMotd;
    public image?: Buffer | null;

    constructor(motd: JSONMotd, image: Buffer | null = null) {
      this.jsonMotd = motd;
      this.image = image;
    }

    public static async generateMOTDFromPing(host: string, port: number): Promise<MOTD> {
      const pingRes = await ping({ host: host, port: port });
      if (typeof pingRes.version == "string") throw new Error("Non-1.8 server detected!");
      else {
        const newPingRes = pingRes as NewPingResult;
        let image: Buffer;

        if (newPingRes.favicon != null) {
          if (!newPingRes.favicon.startsWith(IMAGE_DATA_PREPEND)) throw new Error("Invalid MOTD image!");
          image = await generateEaglerMOTDImage(Buffer.from(newPingRes.favicon.substring(IMAGE_DATA_PREPEND.length), "base64"))
        }

        return new MOTD(
          {
            brand: BRAND,
            cracked: true,
            data: {
              cache: true,
              icon: newPingRes.favicon != null ? true : false,
              max: newPingRes.players.max,
              motd: [typeof newPingRes.description == "string" ? newPingRes.description : Chat.chatToPlainString(newPingRes.description), ""],
              online: newPingRes.players.online,
              players: newPingRes.players.sample != null ? newPingRes.players.sample.map((v) => v.name) : [],
            },
            name: "placeholder name",
            secure: false,
            time: Date.now(),
            type: "motd",
            uuid: randomUUID(), // replace placeholder with global. cached UUID
            vers: FULL_VERSION,
          },
          image!
        );
      }
    }

    public toBuffer(): [string, Buffer] {
      return [JSON.stringify(this.jsonMotd), this.image!];
    }
  }

  export type JSONMotd = {
    brand: string;
    cracked: true;
    data: {
      cache: true;
      icon: boolean;
      max: number;
      motd: [string, string];
      online: number;
      players: string[];
    };
    name: string;
    secure: false;
    time: ReturnType<typeof Date.now>;
    type: "motd";
    uuid: ReturnType<typeof randomUUID>;
    vers: string;
  };
}