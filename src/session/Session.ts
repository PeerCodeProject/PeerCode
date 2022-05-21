import * as vscode from 'vscode';

import {IShareLocalToRemote} from '../core/bind/listeners';
import {Peer, PeerManager} from '../peer/peer';

export interface SessionListener {

    onAddSession(session: Session): void;

    onRemoveSession(session: Session): void;
}

export class Session {

    constructor(private roomname: string,
                private peerManager: PeerManager,
                private shareLocalToRemote: IShareLocalToRemote) {

    }

    public getPeerManager(): PeerManager {
        return this.peerManager;
    }

    public getSessionPeers(): Peer[] {
        return this.peerManager.getPeers();
    }

    public getRoomName(): string {
        return this.roomname;
    }

    public shareLocalFile(file: vscode.Uri) {
        return this.shareLocalToRemote.shareFile(file);
    }
}
