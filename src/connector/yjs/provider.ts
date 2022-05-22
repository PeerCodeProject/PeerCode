import { Awareness } from "y-protocols/awareness";
import { WebrtcProvider } from "../../y-webrtc/y-webrtc";
import { WebsocketProvider } from "y-websocket";

export interface YjsProvider {
    getAweateness(): Awareness;
}

export class RTCProvider implements YjsProvider{
    constructor(private provider: WebrtcProvider) {
    }

    getAweateness(): Awareness {
        return this.provider.awareness;
    }
}

export class SocketProvider implements YjsProvider {
    constructor(private provider: WebsocketProvider) {
    }

    getAweateness(): Awareness {
        return this.provider.awareness;
    }
}
