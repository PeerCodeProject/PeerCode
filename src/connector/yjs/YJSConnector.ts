import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { tunnelClient, tunnelServer } from '../../tunneling/tunnel';
import { WebrtcProvider } from '../../y-webrtc/y-webrtc';
import { IConnection, IConnector } from '../conn';
import { RTCProvider, SocketProvider } from './provider';
import { YjsConnection } from './YJSConnection';

export abstract class YjsConnector implements IConnector {
    abstract connect(username: string, room: string, isOwner: boolean): Promise<IConnection>;

}


export class YWebSocketConnector extends YjsConnector {
    constructor(private wsServerUrl: string) {
        super();
    }

    async connect(username: string, room: string, isOwner: boolean): Promise<IConnection> {
        console.debug("connecting via websocket to " + this.wsServerUrl + " room: " + room + " username: " + username);
        const ydoc = new Y.Doc();
        const provider = new WebsocketProvider(this.wsServerUrl, room, ydoc,
            {
                WebSocketPolyfill: require('ws')  // eslint-disable-line
            });
        await this.awaitConnection(provider);
        console.debug("Connected to:" + room);

        return new YjsConnection(new SocketProvider(provider), ydoc, username, room);
    }


    private awaitConnection(provider: WebsocketProvider) {
        return new Promise<void>((resolve, _reject) => {
            provider.on("status", (event: any) => {
                const status = event.status;
                console.debug("status on ws connect:" + status);
                if (status === "connected") {
                    resolve();
                }
            });
        });
    }

}


export class YWebRTCConnector extends YjsConnector {
    constructor(private signalingServerUrl: string) {
        super();
    }

    async connect(username: string, room: string, isOwner: boolean): Promise<IConnection> {
        console.debug("connecting via webrtc to " + this.signalingServerUrl + " room: " + room + " username: " + username);
        const ydoc = new Y.Doc();
        const provider = new WebrtcProvider(room, ydoc, [this.signalingServerUrl], isOwner);
        await this.awaitConnection(provider);

        if (isOwner) {
            tunnelServer(provider.room!.webrtcConns, provider, 8888);
        } else {
            tunnelClient(provider.room!.webrtcConns, provider);
        }
        return new YjsConnection(new RTCProvider(provider), ydoc, username, room);

    }

    awaitConnection(provider: WebrtcProvider) {
        return new Promise<void>((resolve, _reject) => {
            provider.on("synced", (event: any) => {
                console.log("Synced", event);
                resolve();
            });

            provider.on("peers", (event: any) => {
                console.log("peers", event);
                resolve();
            });
        });
    }



}
