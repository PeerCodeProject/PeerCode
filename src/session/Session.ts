import { PeerManager } from '../peer/peer';

export interface SessionListener {

    onAddSession(session: Session): void;

    onRemoveSession(session: Session): void;
}

export class Session {

    private peerManager: PeerManager = new PeerManager();

    constructor(private roomname: string) {
    }

    public getPeerManager(): PeerManager {
        return this.peerManager;
    }

    public getRoomName(): string {
        return this.roomname;
    }

} 