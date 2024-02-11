import { Uri, Webview } from "vscode";
import * as os from "os";

const globalTemp: typeof globalThis = globalThis;

export function initGlobal(): void {
  // @ts-expect-error need to set globalThis websocket
  globalTemp.WebSocket = require("ws");
  // process.env['LOG'] = '*';
}

export function ListContains<T>(list: T[], item: T): boolean {
  return list.some(listItem => listItem === item);
}

export function isWindows(): boolean {
  return os.platform() === "win32";
}

export async function input(inputter: () => Promise<string | undefined | null>): Promise<string> {
  const result = await inputter();
  if (!result) {
    throw new Error("Input Error");
  }
  return result;
}

export function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]): Uri {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}
