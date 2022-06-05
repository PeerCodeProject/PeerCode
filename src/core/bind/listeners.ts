import * as vscode from "vscode";
import { EditorChannel } from "./editor/editorChannel";

export interface ConnectionBinder {
    removeFile(fileKey: string): void;
    sendLocalFile(url: string): EditorChannel;
}

export interface RemoteFileListener {
    onDeleteRemoteFile(filename: string): void;
    onAddRemoteFile(uniqueUri: string, editorChannel: EditorChannel): Promise<void>;
}

export interface IShareLocalToRemote {
    deleteDirectory(file: vscode.Uri): Promise<void>;
    shareFile(uri: vscode.Uri): void;
    deleteFile(uri: vscode.Uri): void;
}

