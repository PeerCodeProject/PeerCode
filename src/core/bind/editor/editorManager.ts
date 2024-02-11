import * as vscode from "vscode";

import { FileStore } from "../fileShareManager";

export interface IEditorManager {
  openDocument(uri: vscode.Uri): Promise<vscode.TextDocument>;
}

export class EditorManager implements IEditorManager {
  constructor(private fileStore: FileStore) {
    vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection.bind(this));
  }

  async openDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    return vscode.workspace.openTextDocument(uri);
  }

  private onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent): void {
    const sharedFile = this.fileStore.getSharedFileByUri(event.textEditor.document.uri);
    if (sharedFile) {
      sharedFile.editorBinding.updateSelections(event.selections);
    }
  }
}
