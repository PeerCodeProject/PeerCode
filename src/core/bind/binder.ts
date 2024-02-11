import * as Y from "yjs";

import { Peer, PeerManager } from "../../peer/peer";
import { BaseObservable } from "../observable";
import { EditorChannel, YEditorChannel } from "./editor/editorChannel";
import { ConnectionBinder, RemoteFileListener } from "./listeners";
import { RemoteFile, RemoteFileWrapper } from "./remoteFile";
import { YjsConstants } from "./constants";

export class YjsBinder extends BaseObservable<RemoteFileListener> implements ConnectionBinder {
  private peers: Y.Map<Y.Map<Y.Map<unknown>>>;
  private currentFiles = new Y.Map<Y.Map<unknown>>();
  private editorChannelsForPeer = new Map<string, Map<string, EditorChannel>>();

  constructor(
    public doc: Y.Doc,
    public currentPeer: string,
    private peerConnListener: PeerManager,
  ) {
    super();
    this.peers = doc.getMap(YjsConstants.peersKey);
    this.setupObservers();
  }

  private setupObservers(): void {
    this.peers.set(this.currentPeer, this.currentFiles);
    for (const peer of this.peers.keys()) {
      this.addPeer(peer, this.peers.get(peer)!);
    }
    this.peers.observe(this.peerEventListener.bind(this));
  }

  setRemoteFileListener(fileShareManager: RemoteFileListener): void {
    this.registerListener(fileShareManager);
  }

  private peerEventListener(
    event: Y.YMapEvent<Y.Map<Y.Map<unknown>>>,
    transaction: Y.Transaction,
  ): void {
    if (transaction.origin === this.currentPeer) {
      return;
    }
    event.changes.keys.forEach(
      (key: { action: "add" | "update" | "delete"; oldValue: boolean }, peer: string): void => {
        switch (key.action) {
          case "add":
            this.addPeer(peer, this.peers.get(peer)!);
            break;
          case "delete":
            this.deletePeer(peer);
            break;
          default:
            break;
        }
      },
    );
  }

  addPeer(peer: string, files: Y.Map<Y.Map<unknown>>): void {
    console.debug("Adding peer " + peer);
    if (peer === this.currentPeer) {
      return;
    }

    for (const fileName of files.keys()) {
      this.addPeerFile(peer, fileName, files.get(fileName)!);
    }
    this.addObserverForFileList(peer, files);

    this.peerConnListener.peerJoined(new Peer(peer));
  }

  addObserverForFileList(peer: string, files: Y.Map<Y.Map<unknown>>): void {
    const fileChangeListener = (
      event: Y.YMapEvent<Y.Map<unknown>>,
      transaction: Y.Transaction,
    ): void => {
      if (transaction.origin === this.currentPeer) {
        return;
      }
      this.onFilesChanged(peer, event);
    };

    files.observe(fileChangeListener);
  }

  private onFilesChanged(peer: string, event: Y.YMapEvent<Y.Map<unknown>>): void {
    event.changes.keys.forEach((key, filename): void => {
      switch (key.action) {
        case "add":
          this.addPeerFile(peer, filename, this.peers.get(peer)!.get(filename)!);
          break;
        case "delete":
          this.deletePeerFile(peer, filename);
          break;
        default:
          break;
      }
    });
  }

  deletePeerFile(peer: string, filename: string): void {
    console.log("Deleting peer file " + filename + ", From " + peer);
    if (!this.editorChannelsForPeer.has(peer)) {
      console.error("peer is not in map: " + peer);
      return;
    }
    const files = this.editorChannelsForPeer.get(peer);
    if (!files) {
      console.error("files is not in map: " + peer);
      return;
    }
    if (!files.has(filename)) {
      console.error("file is not in map: " + filename);
      return;
    }
    files.delete(filename);

    this.notify(listener => {
      listener.onDeleteRemoteFile(filename);
    });

    this.currentFiles.delete(filename);
  }

  addPeerFile(peer: string, filename: string, file: Y.Map<unknown>): void {
    console.debug("Adding Peer file " + filename + ", From " + peer);
    const remoteFile = new RemoteFileWrapper(file);
    console.log("remote file name:" + remoteFile.filename);
    if (!this.editorChannelsForPeer.has(peer)) {
      this.editorChannelsForPeer.set(peer, new Map<string, YEditorChannel>());
    }
    let editorChannel = this.editorChannelsForPeer.get(peer)!.get(filename);
    if (!editorChannel) {
      console.log("addPeerFile creating new YEditorBinder for:" + filename, "peer:" + peer);
      editorChannel = new YEditorChannel(this.doc, this.currentPeer, remoteFile);
      this.editorChannelsForPeer.get(peer)!.set(filename, editorChannel);
    }
    const channelConst = editorChannel;
    this.notify(async listener => {
      await listener.onAddRemoteFile(remoteFile.filename, channelConst);
    });
  }

  deletePeer(peer: string): void {
    console.log("Deleting peer " + peer);
    if (!this.editorChannelsForPeer.has(peer)) {
      console.error("peer is not in map: " + peer);
    }
  }

  sendLocalFile(filename: string): EditorChannel {
    console.debug("sendLocalFile file:" + filename + ", peer:");
    const remoteFile = new RemoteFile(this.currentPeer, filename);
    this.doc.transact(() => {
      this.currentFiles.set(filename, remoteFile);
    }, this.currentPeer);

    if (!this.editorChannelsForPeer.has(this.currentPeer)) {
      this.editorChannelsForPeer.set(this.currentPeer, new Map<string, YEditorChannel>());
    }
    console.log(
      "sendLocalFile creating new YEditorBinder for:" + filename,
      "curr peer:" + this.currentPeer,
    );
    const sync = new YEditorChannel(this.doc, this.currentPeer, remoteFile);

    this.editorChannelsForPeer.get(this.currentPeer)!.set(filename, sync);
    return sync;
  }

  removeFile(fileKey: string): void {
    console.log("removeFile file:" + fileKey + ", peer:", this.currentPeer);
    if (!this.editorChannelsForPeer.has(this.currentPeer)) {
      console.error("peer is not in map: " + this.currentPeer);
      return;
    }
    const filesMap = this.editorChannelsForPeer.get(this.currentPeer);
    if (!filesMap) {
      console.error("peer is not registered: " + this.currentPeer);
      return;
    }

    if (!filesMap.has(fileKey)) {
      console.log("file is not in map: " + fileKey);
      return;
    }
    filesMap.delete(fileKey);

    this.doc.transact(() => {
      this.currentFiles.delete(fileKey);
    }, this.currentPeer);
  }
}
