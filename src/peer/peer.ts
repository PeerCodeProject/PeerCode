import { BaseObservable } from '../core/observable';

export class Peer {
    constructor(public peername: string) {

    }

}

export interface PeerConnectionListener {
    onPeerAdded(peer: Peer): void;
    onPeerRemoved(peer: Peer): void;
}

export class PeerManager extends BaseObservable<PeerConnectionListener> {

    private peers: Peer[] = [];

    async peerJoined(peer: Peer): Promise<void> {
        console.log("peer joined: " + peer);
        this.peers.push(peer);
        this.notify(async (listener) => {
            listener.onPeerAdded(peer);
        });
    }

    async peerLeft(peer: Peer): Promise<void> {
        console.log("peer joined: " + peer);
        this.peers = this.peers.filter(p => p !== peer);
        this.notify(async (listener) => {
            listener.onPeerRemoved(peer);
        });
    }

    getPeers(): Peer[] {
        return this.peers.slice();
    }
}