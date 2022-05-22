import { Uri, Webview } from "vscode";

const globalTemp: any = global;

export function initGlobal() {
    globalTemp.WebSocket = require("ws");
    // process.env['LOG'] = '*';

}

export async function input(inputter: () => Promise<string | undefined | null>) {
    let result = await inputter();
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
