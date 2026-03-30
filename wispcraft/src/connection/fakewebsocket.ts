import {
	EpoxyHandlers,
	EpoxyWebSocket,
	EpoxyWebSocketInput,
} from "@mercuryworkshop/epoxy-tls";
import { Connection } from ".";
import { authstore, COMMITHASH, usingDefaultWisp, VERSION, wispUrl, wispcraftSettings } from "..";
import { Buffer } from "../buffer";
import { showUI } from "../ui";
import { epoxyWs } from "./epoxy";
// @ts-ignore typescript sucks
import wispcraft from "./wispcraft.png";

function isWispDomain(hostname: string): boolean {
	// Check if hostname matches *.wisp.q13x.com
	const parts = hostname.split('.');
	if (parts.length >= 3) {
		const domain = parts.slice(-3).join('.');
		return domain === 'wisp.q13x.com';
	}
	return false;
}

const WISP_PROMPT_DISMISSED_KEY = "wispcraft_wisp_prompt_dismissed";

function showWispServerPrompt() {
	if (!usingDefaultWisp || localStorage[WISP_PROMPT_DISMISSED_KEY]) return;

	const overlay = document.createElement("div");
	Object.assign(overlay.style, {
		position: "fixed", inset: "0", zIndex: "9999",
		background: "rgba(0,0,0,0.6)", display: "flex",
		alignItems: "center", justifyContent: "center",
	});

	const box = document.createElement("div");
	Object.assign(box.style, {
		background: "#020817", border: "1px solid #1E293B",
		borderRadius: "0.75rem", padding: "1.5rem", maxWidth: "26rem",
		color: "#F8FAFC", fontFamily: "Inter, sans-serif",
		display: "flex", flexDirection: "column", gap: "1rem",
	});

	const title = document.createElement("h2");
	Object.assign(title.style, { margin: "0", fontSize: "1.125rem" });
	title.textContent = "Select a Wisp Server";

	const msg = document.createElement("p");
	Object.assign(msg.style, { margin: "0", fontSize: "0.875rem", color: "#94A3B8", lineHeight: "1.5" });
	msg.textContent = "You're using the default Wisp server. For optimal performance, select a server closer to your location.";

	const btnRow = document.createElement("div");
	Object.assign(btnRow.style, { display: "flex", gap: "0.5rem", justifyContent: "flex-end" });

	const dismiss = document.createElement("button");
	Object.assign(dismiss.style, {
		background: "transparent", color: "#94A3B8", border: "1px solid #1E293B",
		borderRadius: "6px", padding: "8px 14px", fontSize: "14px", cursor: "pointer",
	});
	dismiss.textContent = "Don't show again";
	dismiss.onclick = () => {
		localStorage[WISP_PROMPT_DISMISSED_KEY] = "1";
		overlay.remove();
	};

	const select = document.createElement("button");
	Object.assign(select.style, {
		background: "#3C82F6", color: "#0F172A", border: "none",
		borderRadius: "6px", padding: "8px 14px", fontSize: "14px", cursor: "pointer",
	});
	select.textContent = "Select Server";
	select.onclick = () => {
		window.open("/settings/wisp_select.html", "_blank");
		overlay.remove();
	};

	btnRow.append(dismiss, select);
	box.append(title, msg, btnRow);
	overlay.append(box);
	document.body.append(overlay);
}

class WispWS extends EventTarget {
	inner: Connection;
	url: string;
	readyState: number;
	serverUrl: URL;
	motdCacherWs: WebSocket | null = null;

	constructor(uri: string) {
		super();

		this.url = uri;
		this.inner = new Connection(uri, authstore);
		this.readyState = WebSocket.CONNECTING;
		// URI is "wss://java://host:port" — strip outer scheme to parse "java://host:port"
		this.serverUrl = new URL(uri.slice(uri.toLowerCase().indexOf("://") + 3));
	}

	start() {
		this.inner.forward(() => {
			this.readyState = WebSocket.OPEN;
			this.dispatchEvent(new Event("open"));
		});
		(async () => {
			try {
				while (true) {
					const { done, value } = await this.inner.eaglerOut.read();
					if (done || !value) break;

					this.dispatchEvent(
						new MessageEvent("message", {
							data: typeof value === "string" ? value : value.inner,
						})
					);
				}
				this.readyState = WebSocket.CLOSING;
				this.dispatchEvent(new Event("close"));
				this.readyState = WebSocket.CLOSED;
			} catch (err) {
				console.error(err);
				this.dispatchEvent(new Event("error"));
			}
		})();
	}

	send(chunk: Uint8Array | ArrayBuffer | string) {
		let buf: Buffer;
		if (typeof chunk == "string") {
			if (chunk.toLowerCase() == "accept: motd") {
				const shouldUseMotdCacher = isWispDomain(new URL(wispUrl).hostname) || wispcraftSettings.forceMotdCacher;

				if (shouldUseMotdCacher) {
					const fullHost = this.serverUrl.port
						? `${this.serverUrl.hostname}:${this.serverUrl.port}`
						: this.serverUrl.hostname;
					const wispBase = new URL(wispUrl);
					wispBase.pathname = "/proxy-motd";
					wispBase.searchParams.set("fullHost", fullHost);
					this.motdCacherWs = new NativeWebSocket(wispBase.href);

					this.motdCacherWs.onopen = () => {
						this.readyState = WebSocket.OPEN;
						this.dispatchEvent(new Event("open"));
						this.motdCacherWs!.send(chunk);
					};

					this.motdCacherWs.onmessage = (event) => {
						this.dispatchEvent(new MessageEvent("message", { data: event.data }));
					};

					this.motdCacherWs.onerror = () => {
						this.dispatchEvent(new Event("error"));
					};

					this.motdCacherWs.onclose = () => {
						this.readyState = WebSocket.CLOSING;
						this.dispatchEvent(new Event("close"));
						this.readyState = WebSocket.CLOSED;
					};
					return;
				}

				this.inner.ping();
			}
			return;
		} else if (chunk instanceof ArrayBuffer) {
			buf = new Buffer(new Uint8Array(chunk), true);
		} else {
			buf = new Buffer(chunk, true);
		}

		showWispServerPrompt();

		if (
			this.url.includes("hypixel.net") &&
			!localStorage["disclaimer_accepted"]
		) {
			if (
				!window.confirm(
					"WARNING: Wispcraft in default configuration will route your traffic through a VPN. This is not officially supported by hypixel, and in the possible event your account gets locked we do not accept responsibility. Continue?"
				)
			) {
				this.dispatchEvent(new Event("error"));
				this.dispatchEvent(new CloseEvent("close"));
				return;
			}
			localStorage["disclaimer_accepted"] = 1;
		}

		this.inner.eaglerIn.write(buf);
	}

	close() {
		if (
			this.readyState == WebSocket.CLOSING ||
			this.readyState == WebSocket.CLOSED
		) {
			return;
		}
		this.readyState = WebSocket.CLOSING;

		// Close motd-cacher WebSocket if it's open
		if (this.motdCacherWs !== null) {
			try {
				this.motdCacherWs.close();
			} catch (err) {}
		}

		try {
			this.inner.eaglerIn.abort();
		} catch (err) {}
		this.readyState = WebSocket.CLOSED;
	}
}
class SettingsWS extends EventTarget {
	readyState: number;
	constructor() {
		super();
		this.readyState = WebSocket.CLOSED;
		setTimeout(() => {
			this.dispatchEvent(new Event("open"));
		});
	}
	send(chunk: Uint8Array | ArrayBuffer | string) {
		if (typeof chunk === "string" && chunk.toLowerCase() === "accept: motd") {
			const accs = localStorage["wispcraft_accounts"]
				? JSON.parse(localStorage["wispcraft_accounts"]).length
				: 0;
			this.dispatchEvent(
				new MessageEvent("message", {
					data: JSON.stringify({
						name: "Settings",
						brand: "mercuryworkshop",
						vers: "wispcraft/" + VERSION,
						cracked: true,
						time: Date.now(),
						uuid: "00000000-0000-0000-0000-000000000000",
						type: "motd",
						data: {
							cache: false,
							icon: true,
							online: accs,
							max: 0,
							motd: ["Sign in with Microsoft", "Configure Proxy URL"],
							players: [`Version: ${VERSION}`, `Build: ${COMMITHASH}`],
						},
					}),
				})
			);
			fetch(wispcraft)
				.then((response) => response.blob())
				.then((blob) => createImageBitmap(blob))
				.then((image) => {
					let canvas = new OffscreenCanvas(image.width, image.height);
					let ctx = canvas.getContext("2d")!;
					ctx.drawImage(image, 0, 0);
					let pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
					this.dispatchEvent(
						new MessageEvent("message", { data: new Uint8Array(pixels) })
					);
				});
		} else {
			showUI();
			let str = "Settings UI launched.";
			let enc = new TextEncoder().encode(str);
			let eag = Uint8Array.from([0xff, 0x08, enc.length, ...enc]);
			this.dispatchEvent(new MessageEvent("message", { data: eag }));
			this.dispatchEvent(new CloseEvent("close"));
		}
	}
	close() {}
}

class EpoxyWS extends EventTarget {
	inner: EpoxyWebSocket | null;
	readyState: number;
	binaryType: string = "arraybuffer";
	queue: Array<EpoxyWebSocketInput>;

	constructor(uri: string, protocols?: string | string[]) {
		super();
		this.queue = [];
		this.inner = null;
		this.readyState = WebSocket.CONNECTING;
		this.start(uri, protocols);
	}

	async start(uri: string, protocols?: string | string[]) {
		const handlers = new EpoxyHandlers(
			() => {
				this.readyState = WebSocket.OPEN;
				this.dispatchEvent(new Event("open"));
				if (this.inner != null) {
					for (let item of this.queue) {
						this.inner.send(item);
					}
					this.queue.length = 0;
				}
			},
			() => {
				this.readyState = WebSocket.CLOSING;
				this.dispatchEvent(new CloseEvent("close"));
				this.readyState = WebSocket.CLOSED;
				if (this.inner != null) {
					this.inner.free();
				}
			},
			(error: Error) => {
				console.error(error);
				this.dispatchEvent(new Event("error"));
			},
			(data: Uint8Array) => {
				this.dispatchEvent(new MessageEvent("message", { data: data.buffer }));
			}
		);
		this.inner = await epoxyWs(handlers, uri, protocols);
	}

	send(chunk: Uint8Array | ArrayBuffer | string) {
		chunk = chunk.slice(0);
		if (chunk instanceof Uint8Array) {
			chunk = chunk.buffer as ArrayBuffer;
		}
		if (this.inner == null || this.readyState == WebSocket.CONNECTING) {
			this.queue.push(chunk);
		} else {
			this.inner.send(chunk);
		}
	}

	close() {
		if (
			this.inner != null &&
			this.readyState != WebSocket.CLOSED &&
			this.readyState != WebSocket.CLOSING
		) {
			try {
				this.inner.close(0, "");
			} catch (e) {}
		}
	}
}

class AutoWS extends EventTarget {
	inner: WebSocket | WispWS | EpoxyWS | null;
	url: string;
	queue: Array<Uint8Array | ArrayBuffer | string>;

	constructor(uri: string, protocols?: string | string[]) {
		super();
		this.queue = [];
		let flag2 = false;
		let flag3 = false;
		const url = new URL(uri);
		this.inner = null;
		this.url = url.protocol + "//java://" + url.hostname;
		const el = (event: Event) => {
			switch (event.type.toLowerCase()) {
				case "close":
					this.dispatchEvent(new CloseEvent("close", event));
					break;
				case "message":
					this.dispatchEvent(new MessageEvent("message", event));
					break;
				default:
					this.dispatchEvent(new Event(event.type, event));
			}
		};
		let flag = false;
		const el3 = (event: Event) => {
			called = true;
			if (this.inner != null) {
				this.inner.removeEventListener("close", el2);
				this.inner.removeEventListener("error", el2);
				this.inner.addEventListener("close", el);
				this.inner.addEventListener("error", el);
				flag = true;
				for (let item of this.queue) {
					this.inner.send(item);
				}
				this.queue.length = 0;
			}
			el(event);
		};
		let ti: any = -1;
		let called = false;
		const el2 = () => {
			if (called) {
				return;
			}
			called = true;
			if (ti != -1) {
				clearTimeout(ti);
				ti = -1;
			}
			if (this.inner != null) {
				if (flag) {
					this.inner.removeEventListener("close", el);
					this.inner.removeEventListener("error", el);
				} else {
					this.inner.removeEventListener("close", el2);
					this.inner.removeEventListener("error", el2);
				}
				this.inner.removeEventListener("open", el3);
				this.inner.removeEventListener("message", el);
			}
			if (!flag2 && url.protocol.length == 3) {
				flag2 = true;
				called = false;
				flag = false;
				const bt = (this.inner as WebSocket)?.binaryType || "arraybuffer";
				this.inner?.close();
				this.inner = null;
				ti = setTimeout(el2, 2000);
				try {
					this.inner = new NativeWebSocket("ws" + uri.slice(1), protocols);
					this.inner.binaryType = bt;
					this.inner.addEventListener("close", el2);
					this.inner.addEventListener("error", el2);
					this.inner.addEventListener("open", el3);
					this.inner.addEventListener("message", el);
				} catch (e) {
					el2();
				}
				return;
			}
			if (!flag3) {
				flag3 = true;
				called = false;
				flag = false;
				flag2 = false;
				const bt = (this.inner as WebSocket)?.binaryType || "arraybuffer";
				this.inner?.close();
				this.inner = null;
				ti = setTimeout(el2, 2000);
				try {
					this.inner = new EpoxyWS(uri, protocols);
					this.inner.binaryType = bt;
					this.inner.addEventListener("close", el2);
					this.inner.addEventListener("error", el2);
					this.inner.addEventListener("open", el3);
					this.inner.addEventListener("message", el);
				} catch (e) {
					el2();
				}
				return;
			}
			this.inner = new WispWS(this.url);
			this.inner.addEventListener("close", el);
			this.inner.addEventListener("error", el);
			this.inner.addEventListener("open", el);
			this.inner.addEventListener("message", el);
			this.inner.start();
			for (let item of this.queue) {
				this.inner.send(item);
			}
			this.queue.length = 0;
		};
		ti = setTimeout(el2, 2000);
		try {
			const ws = new NativeWebSocket(uri, protocols);
			if (this.inner != null) {
				ws.close();
				return;
			}
			this.inner = ws;
			this.inner.addEventListener("close", el2);
			this.inner.addEventListener("error", el2);
			this.inner.addEventListener("open", el3);
			this.inner.addEventListener("message", el);
		} catch (e) {
			el2();
		}
	}

	send(chunk: Uint8Array | ArrayBuffer | string) {
		if (this.inner == null || this.inner.readyState == WebSocket.CONNECTING) {
			this.queue.push(chunk);
		} else {
			return this.inner.send(chunk);
		}
	}

	close() {
		if (this.inner != null) {
			try {
				return this.inner.close();
			} catch (e) {}
		}
	}

	get binaryType() {
		if (this.inner != null && this.inner instanceof WebSocket) {
			return this.inner.binaryType;
		}
		return "arraybuffer";
	}

	get readyState() {
		if (this.inner != null) {
			return this.inner.readyState;
		}
		return WebSocket.CONNECTING;
	}

	set binaryType(binaryType: BinaryType) {
		if (this.inner != null && this.inner instanceof WebSocket) {
			this.inner.binaryType = binaryType;
		}
	}
}

const NativeWebSocket = WebSocket;
export function makeFakeWebSocket(): typeof WebSocket {
	return new Proxy(WebSocket, {
		construct(_target, [uri, protos]) {
			if (uri == wispUrl) {
				return new NativeWebSocket(uri, protos);
			}

			let url = new URL(uri);
			let isCustomProtocol = url.port == "" && url.pathname.startsWith("//");

			if (isCustomProtocol && url.hostname == "java") {
				const ws = new WispWS(uri);
				ws.start();
				return ws;
			} else if (isCustomProtocol && url.hostname == "settings") {
				return new SettingsWS();
			} else {
				return new AutoWS(uri, protos);
			}
		},
	});
}
