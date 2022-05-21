import * as vscode from 'vscode';
import {Selection} from '../../dataStructs';
import {getFileKeyFromUri} from '../../fs/fileSystemManager';
import {EditorChannel} from './editorChannel';
import {getPosition, getRandomColor, getVSCodePosition, isCursor} from "../textUtil";


export interface EditorChannelListener {
    onSelectionsChangedForPeer(peer: string, selections: Selection[], fileKey: string): void;
}

const color = getRandomColor();

const selectionDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: color,
});
const cursorDecoration = vscode.window.createTextEditorDecorationType({
    border: "solid " + color,
    borderWidth: '6px 1px 6px 1px'
});


export default class EditorBinding implements EditorChannelListener {

    constructor(
        public editorChannel: EditorChannel) {
        editorChannel.addListener(this);
    }

    onSelectionsChangedForPeer(peername: string, selections: Selection[], fileKey: string): Promise<void> {
        console.log(this.constructor.name + ": onSelectionsChangedForPeer- peerId:" + peername + ", selections size:" + selections.length);
        let selectionRanges: vscode.Range[] = [];
        let cursorRanges: vscode.Range[] = [];

        for (let selection of selections) {
            if (selection.isCursor) {
                cursorRanges.push(
                    new vscode.Range(
                        getVSCodePosition(selection.start),
                        getVSCodePosition(selection.end)));
            } else {
                selectionRanges.push(
                    new vscode.Range(
                        getVSCodePosition(selection.start),
                        getVSCodePosition(selection.end)));
            }
        }
        for (let editor of vscode.window.visibleTextEditors) {
            if (getFileKeyFromUri(editor.document.uri) === fileKey) {
                editor.setDecorations(selectionDecoration, selectionRanges);
                editor.setDecorations(cursorDecoration, cursorRanges);
                return Promise.resolve();
            }
        }
        return Promise.reject();
    }

    updateSelections(selections: readonly vscode.Selection[]) {

        let remoteSelections: Selection[] = [];
        for (let i = 0; i < selections.length; i++) {
            let selection = selections[i];
            remoteSelections.push(new Selection(i + "",
                getPosition(selection.start),
                getPosition(selection.end),
                selection.isReversed,
                isCursor(selection)));
        }
        this.editorChannel.sendSelectionsToRemote(remoteSelections);
    }

}
