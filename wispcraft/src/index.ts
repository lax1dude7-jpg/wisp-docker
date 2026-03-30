import { getProfile, minecraftAuth, UserInfo } from "./auth";
import { epoxyFetch, initWisp } from "./connection/epoxy";
import { makeFakeWebSocket } from "./connection/fakewebsocket";

//@ts-expect-error this gets filled in by rollup
export const VERSION = self.VERSION;
//@ts-expect-error this too
export const COMMITHASH = self.COMMITHASH;

export let wispUrl: string;
export let usingDefaultWisp = false;

export type AuthStore = {
	user: UserInfo | null;
	yggToken: string;
	msToken: string;
};

export type WispcraftSettings = {
	forceMotdCacher: boolean;
};

export type TokenStore = {
	username: string;
	token: string;
	ms: string;
};

export let authstore: AuthStore = {
	user: null,
	yggToken: "",
	msToken: "",
};

export let wispcraftSettings: WispcraftSettings = {
	forceMotdCacher: false,
};

// Load settings from localStorage
if (localStorage["wispcraft_settings"]) {
	try {
		const savedSettings = JSON.parse(localStorage["wispcraft_settings"]);
		wispcraftSettings = { ...wispcraftSettings, ...savedSettings };
	} catch (e) {
		console.error("Failed to parse wispcraft settings:", e);
	}
}

export function saveWispcraftSettings() {
	localStorage["wispcraft_settings"] = JSON.stringify(wispcraftSettings);
}

const nativeFetch = fetch;

export function setWispUrl(wisp: string) {
	const wispUrlUrl = new URL(wisp);
	if (!wispUrlUrl.pathname.endsWith("/")) {
		wispUrlUrl.pathname += "/";
	}
	wispUrl = wispUrlUrl.href;
}

wispUrl =
	((window as any).anura && (window as any).anura.wsproxyURL) ||
	new URL(window.location.href).searchParams.get("wisp") ||
	localStorage["wispcraft_wispurl"] ||
	"";

if (!wispUrl) {
	wispUrl = "wss://us-east.wisp.q13x.com/";
	usingDefaultWisp = true;
}

try {
	setWispUrl(wispUrl);
} catch (e) {
	console.error(e);
}

if (localStorage["wispcraft_accounts"]) {
	const accounts = JSON.parse(
		localStorage["wispcraft_accounts"]
	) as TokenStore[];
	const account = accounts.find(
		(account) =>
			account.username === localStorage["wispcraft_last_used_account"]
	);
	if (account) {
		(async () => {
			try {
				authstore.msToken = account.ms;
				authstore.yggToken = account.token;
				authstore.user = await getProfile(authstore.yggToken);
			} catch (e) {
				authstore.yggToken = await minecraftAuth(authstore.msToken);
				authstore.user = await getProfile(authstore.yggToken);
			}
		})();
	}
}

// replace websocket with our own
window.WebSocket = makeFakeWebSocket();

// eagler will fetch texture packs, will fail if cors isn't set
// should really fix this but whatever
window.fetch = async function (url: RequestInfo | URL, init?: RequestInit) {
	try {
		return await nativeFetch(url, init);
	} catch (e) {
		return await epoxyFetch("" + url, init);
	}
};

initWisp(wispUrl);

if (window["anura"]) {
	document.addEventListener("click", function () {
		setTimeout(function () {
			(window.frameElement as HTMLIFrameElement)?.focus();
			window.focus();
		}, 5);
	});
	(window.frameElement as HTMLIFrameElement)?.focus();
}
