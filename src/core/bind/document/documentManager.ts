import * as vscode from "vscode";

import {FileStore} from "../fileShareManager";
import { IShareLocalToRemote } from "../listeners";

export interface IDocumentManager {
    initializeTextToRemote(document: vscode.TextDocument): void;
}

export class DocumentManager implements IDocumentManager {

    constructor(private fileStore: FileStore,private sharer: IShareLocalToRemote) {
        vscode.workspace.onDidChangeTextDocument(this.onChangeTextDocument.bind(this));
        vscode.workspace.onWillSaveTextDocument(this.onSaveDocument.bind(this));
        vscode.workspace.onDidCreateFiles(this.onCreateFiles.bind(this));
        vscode.workspace.onDidDeleteFiles(this.onDeleteFiles.bind(this));
        vscode.workspace.onDidRenameFiles(this.onRenameFiles.bind(this));
    }


    public onChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
        if (event.contentChanges.length === 0) {
            console.log("no content changes: reason" + event.reason + ", doc name:" + event.document.fileName);
            return;
        }
        console.log("Handling change event: " + event.contentChanges.length, ", doc name:" + event.document.fileName);

        const sharedFile = this.fileStore.getSharedFileByUri(event.document.uri);
        if (!sharedFile) {
            console.error("onChangeTextDocument: No shared file found for document: " + event.document.uri);
            return;
        }
        sharedFile.documentBinding.onDidChangeDocument(event.contentChanges);
    }

    private onSaveDocument(event: vscode.TextDocumentWillSaveEvent) {
        console.log("Handling on save document:" + event.document.fileName);
        const sharedFile = this.fileStore.getSharedFileByUri(event.document.uri);
        if (!sharedFile) {
            console.error("onSaveDocument: No shared file found for document: " + event.document.uri);
            return;
        }
        event.waitUntil(sharedFile.documentBinding.requestSavePromise());
    }

    private onCreateFiles(event: vscode.FileCreateEvent) {
        event.files.forEach(file => {
            console.log("Handling create file event: " + file.fsPath);
            this.sharer.shareFile(file);
        });
        console.log("Handling create file event: " + event);
    }

    private onDeleteFiles(event: vscode.FileDeleteEvent) {
        console.log("Handling delete file event: " + event);
    }

    private onRenameFiles(event: vscode.FileRenameEvent) {
        console.log("Handling rename file event: " + event);
    }


    initializeTextToRemote(document: vscode.TextDocument) {
        const changeEvent = {
            document: document,
            contentChanges: [
                {
                    range: new vscode.Range(new vscode.Position(0, 0),
                        new vscode.Position(0, 0)),
                    rangeOffset: 0,
                    rangeLength: 0,
                    text: document.getText()
                }
            ],
            reason: undefined
        };
        this.onChangeTextDocument(changeEvent);
    }
}
