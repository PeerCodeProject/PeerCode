import { Awareness } from "y-protocols/awareness";
import { WebrtcProvider } from "../../y-webrtc/y-webrtc";
import { WebsocketProvider } from "y-websocket";
import { Observable } from "lib0/observable";

export interface YjsProviderWrapper {
  getAwareness(): Awareness;
  supportsTunneling(): boolean;
  supportsDocker(): boolean;
  getProvider(): Observable<string>; // todo change
}

export class RTCProvider implements YjsProviderWrapper {
  constructor(private provider: WebrtcProvider) {}

  supportsTunneling(): boolean {
    return true;
  }

  supportsDocker(): boolean {
    return true;
  }

  getAwareness(): Awareness {
    return this.provider.awareness;
  }

  getProvider(): Observable<string> {
    return this.provider;
  }
}

export class SocketProvider implements YjsProviderWrapper {
  constructor(private provider: WebsocketProvider) {}

  supportsTunneling(): boolean {
    return false;
  }

  supportsDocker(): boolean {
    return false;
  }

  getAwareness(): Awareness {
    return this.provider.awareness;
  }

  getProvider(): Observable<string> {
    return this.provider;
  }
}
