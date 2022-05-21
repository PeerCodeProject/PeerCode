import * as vscode from 'vscode';

import {Position, TextChange, TextChangeType} from '../../dataStructs';
import { createRange } from '../textUtil';
import {DocumentChannel} from './documentChannel';


export interface DocumentChannelListener {
    onRemoteInitText(text: string): Promise<void>;

    onRemoteTextChanges(changes: TextChange[]): Promise<void>;

    onSave(): Promise<void>;
}

export default class DocumentBinding implements DocumentChannelListener {

    public mutexLock = false;

    constructor(public document: vscode.TextDocument,
                public documentChannel: DocumentChannel) {

        documentChannel.addListener(this);
    }

    async onRemoteInitText(text: string): Promise<void> {
        console.log("onRemoteInitText - text:" + text);
        let textEdit = new vscode.TextEdit(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), text);
        await this.applyWorkspaceEdits(this.document, [textEdit]);
    }

    async onRemoteTextChanges(changes: TextChange[]): Promise<void> {
        console.log("onRemoteTextChanges- changes length:" + changes.length);
        let textEdits = changes.map(change => {
            return new vscode.TextEdit(createRange(change.start, change.end), change.text);
        });
        await this.applyWorkspaceEdits(this.document, textEdits);
    }

    async onSave(): Promise<void> {
        await this.document.save();
    }



    onDidChangeDocument(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
        console.log("DocumentBinding: onDidChangeBuffer- mutexLock: " + this.mutexLock);
        if (!this.mutexLock) { // prevent multiple updates
            [...changes].sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
                .map(change => {
                    return new TextChange(TextChangeType.UPDATE,
                        new Position(change.range.start.line, change.range.start.character),
                        new Position(change.range.end.line, change.range.end.character),
                        change.text);
                }).forEach(change => {
                this.documentChannel.sendChangeToRemote(change);
            });
        }
    }

    private async update(edit: vscode.WorkspaceEdit) {
        this.mutexLock = true;
        let res = await vscode.workspace.applyEdit(edit);
        this.mutexLock = false;
        return res;
    }

    private async tryApplyChanges(edit: vscode.WorkspaceEdit) {
        try {
            while (!await this.update(edit)) {
                console.warn("tryApplyChanges: retrying");
            }
            console.warn("sucess Appling Changes");
        } catch (err) {
            console.error("error", err);
        }
    }

    requestSavePromise() {
        this.documentChannel.saveToRemote();
        return Promise.resolve();
    }

    async applyWorkspaceEdits(document: vscode.TextDocument, edits: vscode.TextEdit[]) {
        let workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, edits);
        await this.tryApplyChanges(workspaceEdit);
    }

}

