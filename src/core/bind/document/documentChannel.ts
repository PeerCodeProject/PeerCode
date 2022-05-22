import * as Y from "yjs";

import {TextChange, TextChangeType} from "../../dataStructs";
import {BaseObservable} from "../../observable";
import {YFile} from "../remoteFile";
import * as util from "../textUtil";
import {DocumentChannelListener} from "./documentBinding";


export interface DocumentChannel {
    addListener(listener: DocumentChannelListener): void;

    sendChangeToRemote(change: TextChange): void;

    sendChangesToRemote(changes: TextChange[]): void;

    saveToRemote(): void;
}

export class YDocumentChannel extends BaseObservable<DocumentChannelListener> implements DocumentChannel {

    private currentText = "";

    constructor(private doc: Y.Doc,
                private currentUsername: string,
                public yFile: YFile) {
        super();
        const yChangeObserver = async (event: Y.YTextEvent, transaction: Y.Transaction) => {
            if (transaction.origin === this.currentUsername) {
                return;
            }
            await this.onRemoteTextChanged(event);
        };
        const saveObserver = (event: any, transaction: Y.Transaction) => {
            if (transaction.origin === this.currentUsername) {
                return;
            }
            this.onRemoteSave(event);
        };
        this.yFile.text.observe(yChangeObserver);
        this.yFile.saveRequests.observe(saveObserver);

        if (this.yFile.text.length > 0) {
            this.currentText = this.yFile.text.toString();
            const text = this.currentText;
            console.log("YDocumentBinder: constructor- text:", text, "length:", text.length);
            this.notify(async (listener) => {
                await listener.onRemoteInitText(text);
            });
        }
    }


    addListener(listener: DocumentChannelListener): void {
        super.registerListener(listener);
    }

    private async onRemoteTextChanged(event: Y.YTextEvent) {
        const changes: TextChange[] = [];
        let position = 0;
        for (const delta of event.changes.delta) {
            if (delta.retain) {
                position += delta.retain;
            } else if (delta.delete) {
                const textDelete = new TextChange(TextChangeType.DELETE,
                    util.indexToLineAndCharacter(this.currentText, position),
                    util.indexToLineAndCharacter(this.currentText, position + delta.delete),
                    "");
                changes.push(textDelete);
                this.applyChange(textDelete);
            } else if (delta.insert) {
                const textInsert = new TextChange(TextChangeType.INSERT,
                    util.indexToLineAndCharacter(this.currentText, position),
                    util.indexToLineAndCharacter(this.currentText, position),
                    delta.insert as string);
                changes.push(textInsert);
                this.applyChange(textInsert);
                position += delta.insert.length;
            }
        }

        const reversed = [...changes].reverse();
        this.notify(async (listener) => {
            await listener.onRemoteTextChanges(reversed);
        });
    }

    private onRemoteSave(_event: Y.YArrayEvent<string>) {
        if (this.yFile.saveRequests.length > 0) {
            this.notify(async (listener) => {
                await listener.onSave();
            });
            this.doc.transact(() => {
                this.yFile.saveRequests.delete(0, this.yFile.saveRequests.length);
            }, this.currentUsername);
        }
    }

    private applyChange(change: TextChange) {
        const startIndex = util.lineAndCharacterToIndex(this.currentText, change.start);
        const endIndex = util.lineAndCharacterToIndex(this.currentText, change.end);
        const start = this.currentText.slice(0, startIndex);
        const end = this.currentText.slice(endIndex);
        // console.log("YDocumentBinder: applyChange- change:", change.text,
        //     "start:", start, "end:", end, "startIndex:",
        //     startIndex, "endIndex:", endIndex, "length:", this.currentText.length);
        this.currentText = start + change.text + end;
    }

    async sendChangeToRemote(change: TextChange): Promise<void> {
        console.log("YDocumentBinder: sendChangeToRemote- change:", change);
        const startIndex = util.lineAndCharacterToIndex(this.currentText, change.start);
        const endIndex = util.lineAndCharacterToIndex(this.currentText, change.end);
        this.sendChangeInTransaction(change, startIndex, endIndex);
        this.applyChange(change);
    }

    sendChangesToRemote(changes: TextChange[]): void {
        console.log("YDocumentBinder: sendChangeToRemote- changes:", changes);
        this.doc.transact(() => {
            changes.forEach(async (change) => {
                await this.sendChangeToRemote(change);
            });
        }, this.currentUsername);
    }

    private sendChangeInTransaction(change: TextChange, startIndex: number, endIndex: number) {
        this.doc.transact(() => {
            if (change.type === TextChangeType.DELETE) {
                this.yFile.text.delete(startIndex, endIndex - startIndex);
            } else if (change.type === TextChangeType.INSERT) {
                this.yFile.text.insert(startIndex, change.text);
            } else if (change.type === TextChangeType.UPDATE) {
                if (startIndex !== endIndex) {
                    this.yFile.text.delete(startIndex, endIndex - startIndex);
                }
                this.yFile.text.insert(startIndex, change.text);
            }
        }, this.currentUsername);
    }

    saveToRemote() {
        this.doc.transact(() => {
            this.yFile.saveRequests.push([this.currentUsername]);
        }, this.currentUsername);
    }

}
