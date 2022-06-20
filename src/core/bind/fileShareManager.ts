import * as vscode from "vscode";

import { FileSystemManager, getAllFiles, getFileKeyFromUri } from '../fs/fileSystemManager';
import DocumentBinding from "./document/documentBinding";
import { DocumentManager, IDocumentManager } from "./document/documentManager";
import { EditorChannel } from "./editor/editorChannel";
import EditorBinding from "./editor/editorBinding";
import { EditorManager, IEditorManager } from "./editor/editorManager";
import { ConnectionBinder, IShareLocalToRemote, RemoteFileListener } from "./listeners";


export class FileStore {

    private sharedFiles = new Map<string, SharedPeerFile>();

    getSharedFileByUri(uri: vscode.Uri): SharedPeerFile | null {
        const fileKey = getFileKeyFromUri(uri);
        return this.getSharedFile(fileKey);
    }

    getSharedFile(filenameKey: string): SharedPeerFile | null {
        if (!this.sharedFiles.has(filenameKey)) {
            return null;
        }
        const sharedFile = this.sharedFiles.get(filenameKey);
        if (!sharedFile) {
            return null;
        }
        return sharedFile;
    }

    saveFile(peerFile: SharedPeerFile) {
        if (this.sharedFiles.has(peerFile.filenameKey)) {
            console.log("FileStore: saveFile - file already exists:" + peerFile.filenameKey);
        }
        this.sharedFiles.set(peerFile.filenameKey, peerFile);
    }

    removeFile(fileKey: string) {
        this.sharedFiles.delete(fileKey);
    }

}

export class SharedPeerFile {
    constructor(public readonly filenameKey: string,
        public readonly textDocument: vscode.TextDocument,
        public readonly documentBinding: DocumentBinding,
        public readonly editorChannel: EditorChannel,
        public readonly editorBinding: EditorBinding
    ) {
    }
}

export default class FileShareManager implements IShareLocalToRemote, RemoteFileListener {
    private fileStore = new FileStore();
    private documentManager: IDocumentManager = new DocumentManager(this.fileStore, this);
    private editorManager: IEditorManager = new EditorManager(this.fileStore);

    constructor(
        private connBinder: ConnectionBinder,
        private fileSystem: FileSystemManager) {
    }

    async shareFile(uri: vscode.Uri) {
        console.log("FileShareManager - shareFile:" + uri.fsPath);
        const fileKey = getFileKeyFromUri(uri);
        let sharedFile = this.fileStore.getSharedFile(fileKey);
        if (sharedFile) {
            console.log("shareFile: shared file is already exists for key: " + fileKey);
            return;
        }

        const editorChannel = this.connBinder.sendLocalFile(fileKey);
        sharedFile = await this.createAndSaveSharedFile(fileKey, uri, editorChannel);
        this.documentManager.initializeTextToRemote(sharedFile.textDocument);
    }


    private async createAndSaveSharedFile(fileKey: string, uri: vscode.Uri, editorChannel: EditorChannel) {
        const document = await this.editorManager.openDocument(uri);
        const binding = new DocumentBinding(document, editorChannel.getDocumentChannel());
        const editorBinding = new EditorBinding(editorChannel);
        const sharedFile = new SharedPeerFile(fileKey, document, binding, editorChannel, editorBinding);
        this.fileStore.saveFile(sharedFile);
        return sharedFile;
    }

    async onAddRemoteFile(fileKey: string, editorChannel: EditorChannel): Promise<void> {
        console.log("FileShareManager onAddRemoteFile: onAddRemoteFile :" + fileKey);
        const localUri = this.fileSystem.addFile(fileKey);
        if (!localUri) {
            console.warn("FileShareManager onAddRemoteFile: localUri is already exist, skipping....");
            return;
        }
        const sharedFile = this.fileStore.getSharedFile(fileKey);
        if (sharedFile) {
            console.warn("FileShareManager onAddRemoteFile: shared file is already exists for key: " + fileKey);
            return;
        }
        console.log("FileShareManager onAddRemoteFile adding file:" + localUri.fsPath);
        await this.createAndSaveSharedFile(fileKey, localUri, editorChannel);
    }

    deleteFile(uri: vscode.Uri) {
        console.log("FileShareManager deleteFile:" + uri.fsPath);
        const fileKey = getFileKeyFromUri(uri);
        const sharedFile = this.fileStore.getSharedFile(fileKey);
        if (!sharedFile) {
            console.warn("FileShareManager deleteFile: shared file is not exists for key: " + fileKey);
            return;
        }
        this.connBinder.removeFile(fileKey);
        this.fileStore.removeFile(fileKey);
    }

    onDeleteRemoteFile(filename: string): void {
        console.log("FileShareManager onDeleteRemoteFile:" + filename);
        const sharedFile = this.fileStore.getSharedFile(filename);
        if (!sharedFile) {
            console.warn("FileShareManager onDeleteRemoteFile: shared file is not exists for key: " + filename);
            return;
        }
        this.fileStore.removeFile(filename);
        this.fileSystem.deleteFile(this.fileSystem.getFileUri(filename));
    }

    async deleteDirectory(file: vscode.Uri): Promise<void> {
        (await getAllFiles(file.fsPath)).forEach(f => {
            this.fileSystem.deleteFile(f);
        });
    }
}
