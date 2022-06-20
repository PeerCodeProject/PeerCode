import { Uri, Webview } from "vscode";
import * as os from "os";

const globalTemp: typeof globalThis = global;

export function initGlobal() {
    globalTemp.WebSocket = require("ws");
    // process.env['LOG'] = '*';

}

export function isWindows() {
    return os.platform() === "win32";
}

export async function input(inputter: () => Promise<string | undefined | null>) {
    const result = await inputter();
    if (!result) {
        throw new Error("Input Error");
    }
    return result;
}

export function randomInteger(min:number, max:number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getUri(
    webview: Webview,
    extensionUri: Uri,
    pathList: string[]
) {
    return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}
