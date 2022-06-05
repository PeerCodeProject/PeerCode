import * as vscode from "vscode";
import {Selection} from "../../dataStructs";
import {getFileKeyFromUri} from "../../fs/fileSystemManager";
import {EditorChannel} from "./editorChannel";
import {getPosition, getRandomColor, getVSCodePosition, isCursor} from "../textUtil";


export interface EditorChannelListener {
    onSelectionsChangedForPeer(peer: string, selections: Selection[], fileKey: string): void;
}


class UserDecorator {
    constructor(public selectionDecoration: vscode.TextEditorDecorationType,
        public cursorDecoration: vscode.TextEditorDecorationType) {
    }
}
class UserDecoratorStore {
    private static instance: UserDecoratorStore;
    private colorMap: Map<string, UserDecorator> = new Map();

    static getInstance() {
        if (!UserDecoratorStore.instance) {
            UserDecoratorStore.instance = new UserDecoratorStore();
        }
        return UserDecoratorStore.instance;
    }

    getColor(peer: string) {
        let decor = this.colorMap.get(peer);
        if (decor) {
            return decor;
        }
        const color = getRandomColor();
        const selectionDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
        });
        const cursorDecoration = vscode.window.createTextEditorDecorationType({
            border: "solid " + color,
            borderWidth: "6px 1px 6px 1px"
        });
        decor = new UserDecorator(selectionDecoration, cursorDecoration);
        this.colorMap.set(peer, decor);
        return decor;
    }
}

export default class EditorBinding implements EditorChannelListener {

    private selectionColorStore = UserDecoratorStore.getInstance();
    constructor(
        public editorChannel: EditorChannel) {
        editorChannel.addListener(this);
    }

    onSelectionsChangedForPeer(peername: string, selections: Selection[], fileKey: string): Promise<void> {
        const selectionRanges: vscode.Range[] = [];
        const cursorRanges: vscode.Range[] = [];

        for (const selection of selections) {
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
        for (const editor of vscode.window.visibleTextEditors) {
            if (getFileKeyFromUri(editor.document.uri) === fileKey) {
                const decor = this.selectionColorStore.getColor(peername);
                editor.setDecorations(decor.selectionDecoration, selectionRanges);
                editor.setDecorations(decor.cursorDecoration, cursorRanges);
                return Promise.resolve();
            }
        }
        return Promise.reject();
    }

    updateSelections(selections: readonly vscode.Selection[]) {

        const remoteSelections: Selection[] = [];
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            remoteSelections.push(new Selection(i + "",
                getPosition(selection.start),
                getPosition(selection.end),
                selection.isReversed,
                isCursor(selection)));
        }
        this.editorChannel.sendSelectionsToRemote(remoteSelections);
    }

}
