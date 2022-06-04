import { Awareness } from "y-protocols/awareness";
import { WebrtcProvider } from "../../y-webrtc/y-webrtc";
import { WebsocketProvider } from "y-websocket";
import { Observable } from 'lib0/observable';

export interface YjsProviderWrapper {
    getAweateness(): Awareness;
    supportsTunneling(): boolean;
    supportsDocker(): boolean;
    getPorvider(): Observable<string>; // todo change
}

export class RTCProvider implements YjsProviderWrapper {
    constructor(private provider: WebrtcProvider) {
    }

    supportsTunneling(): boolean {
        return true;
    }

    supportsDocker(): boolean {
        return true;
    }

    getAweateness(): Awareness {
        return this.provider.awareness;
    }

    getPorvider(): Observable<string> {
        return this.provider;
    }
}

export class SocketProvider implements YjsProviderWrapper {
    constructor(private provider: WebsocketProvider) {
    }

    supportsTunneling(): boolean {
        return false;
    }

    supportsDocker(): boolean {
        return false;
    }

    getAweateness(): Awareness {
        return this.provider.awareness;
    }

    getPorvider(): Observable<string> {
        return this.provider;
    }
}
