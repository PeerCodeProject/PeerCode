import * as vscode from "vscode";
import { EditorChannel } from "./editor/editorChannel";

export interface ConnectionBinder {
    sendLocalFile(url: string): EditorChannel;
}

export interface RemoteFileListener {
    onAddRemoteFile(uniqueUri: string, editorChannel: EditorChannel): Promise<void>;
}

export interface IShareLocalToRemote {
    shareFile(uri: vscode.Uri): void;
}

