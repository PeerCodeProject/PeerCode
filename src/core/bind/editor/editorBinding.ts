import * as vscode from "vscode";
import { Position, Selection } from "../../dataStructs";
import { getFileKeyFromUri } from "../../fs/fileSystemManager";
import { EditorChannel } from "./editorChannel";
import { getPosition, getRandomColor, getVSCodePosition, isCursor } from "../textUtil";


export interface EditorChannelListener {
    onSelectionsChangedForPeer(peer: string, selections: Selection[], fileKey: string): void;
}


class UserDecorator {
    constructor(public selectionDecoration: vscode.TextEditorDecorationType,
        public cursorDecoration: vscode.TextEditorDecorationType,
        public nameDecoration: vscode.TextEditorDecorationType) {
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
            borderWidth: "7px 1px 7px 1px",
        });

        const nameDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: peer,
                color: "rgba(0, 0, 0, 1)",
                fontWeight: "bold",
                backgroundColor: color,
                fontStyle: "italic",
                margin: `0 0 0 -${peer.length}ch`,
                width: `${peer.length}ch; position:absoulute; z-index:99;`,
            },
        });

        decor = new UserDecorator(selectionDecoration, cursorDecoration, nameDecoration);
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
        const nameRanges: vscode.Range[] = [];

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
            nameRanges.push(
                new vscode.Range(
                    getVSCodePosition(new Position(selection.end.row + 1, selection.end.column)),
                    getVSCodePosition(new Position(selection.end.row + 1, selection.end.column))));
        }

        for (const editor of vscode.window.visibleTextEditors) {
            if (getFileKeyFromUri(editor.document.uri) === fileKey) {
                const decor = this.selectionColorStore.getColor(peername);
                editor.setDecorations(decor.selectionDecoration, selectionRanges);
                editor.setDecorations(decor.cursorDecoration, cursorRanges);
                editor.setDecorations(decor.nameDecoration, nameRanges);
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
