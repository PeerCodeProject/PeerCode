import { BaseObservable } from "../../observable";
import { DocumentChannel, YDocumentChannel } from "../document/documentChannel";
import * as Y from "yjs";
import { PeerSelection, Selection } from "../../dataStructs";
import { YFile } from "../remoteFile";
import { EditorChannelListener } from "./editorBinding";

export interface EditorChannel {
  addListener(listener: EditorChannelListener): void;

  getDocumentChannel(): DocumentChannel;

  sendSelectionsToRemote(selections: Selection[]): void;
}

export class YEditorChannel extends BaseObservable<EditorChannelListener> implements EditorChannel {
  private readonly documentChannel: YDocumentChannel;

  constructor(
    private doc: Y.Doc,
    private currentUsername: string,
    public yFile: YFile,
  ) {
    super();
    const selectionObserver = (
      event: Y.YArrayEvent<PeerSelection>,
      transaction: Y.Transaction,
    ): void => {
      if (transaction.origin === this.currentUsername) {
        return;
      }
      this.onSelectionChanged(event);
    };
    this.yFile.selections.observe(selectionObserver);
    this.documentChannel = new YDocumentChannel(this.doc, this.currentUsername, yFile);
  }

  addListener(listener: EditorChannelListener): void {
    super.registerListener(listener);
  }

  public getDocumentChannel(): DocumentChannel {
    return this.documentChannel;
  }

  private onSelectionChanged(event: Y.YArrayEvent<PeerSelection>): void {
    const changedPeers = this.getChangedPeers(event);
    this.syncChangedPeers(changedPeers, event);
  }

  private syncChangedPeers(changedPeers: Set<string>, event: Y.YArrayEvent<PeerSelection>): void {
    for (const changedPeer of changedPeers) {
      const peerSelections = this.getSelectionsForPeer(event.target, changedPeer);
      this.notify((listener: EditorChannelListener): void => {
        listener.onSelectionsChangedForPeer(changedPeer, peerSelections, this.yFile.filename);
      });
    }
  }

  private getChangedPeers(event: Y.YArrayEvent<PeerSelection>): Set<string> {
    const changedPeers = new Set<string>();
    for (const addition of event.changes.added) {
      this.extractPeerFromChange(addition, changedPeers);
    }

    for (const deletion of event.changes.deleted) {
      this.extractPeerFromChange(deletion, changedPeers);
    }
    return changedPeers;
  }

  private getSelectionsForPeer(source: Y.Array<PeerSelection>, peer: string): Selection[] {
    return source
      .toArray()
      .filter(s => s.peer === peer)
      .map(s => s.selection);
  }

  private extractPeerFromChange(item: Y.Item, changedPeers: Set<string>): void {
    for (const selection of item.content.getContent()) {
      const peerSelection = selection as PeerSelection;
      changedPeers.add(peerSelection.peer);
    }
  }

  sendSelectionsToRemote(selections: Selection[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.doc.transact(() => {
          for (let i = this.yFile.selections.length - 1; i >= 0; i--) {
            if (this.yFile.selections.get(i).peer === this.currentUsername) {
              this.yFile.selections.delete(i);
            }
          }
          for (const selection of selections) {
            this.yFile.selections.push([{ peer: this.currentUsername, selection: selection }]);
          }
          resolve();
        }, this.currentUsername);
      } catch (error) {
        reject(error);
      }
    });
  }
}
