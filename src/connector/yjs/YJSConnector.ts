import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { tunnelClient } from '../../tunneling/tunnel';
import { WebrtcProvider } from '../../y-webrtc/y-webrtc';
import { ConnAuthInfo, IConnection, IConnector } from '../conn';
import { RTCProvider, SocketProvider } from './provider';
import { YjsConnection } from './YJSConnection';

export abstract class YjsConnector implements IConnector {
    supportsPassword(): boolean {
        return false;
    }

    abstract connect(authInfo: ConnAuthInfo, isOwner: boolean): Promise<IConnection>;

}


export class YWebSocketConnector extends YjsConnector {
    constructor(private wsServerUrl: string) {
        super();
    }

    async connect(authInfo: ConnAuthInfo, isOwner: boolean): Promise<IConnection> {
        console.debug("connecting via websocket to " + this.wsServerUrl + " room: " + authInfo.room + " username: " + authInfo.username);
        const ydoc = new Y.Doc();
        const provider = new WebsocketProvider(this.wsServerUrl, authInfo.room, ydoc,
            {
                WebSocketPolyfill: require('ws')  // eslint-disable-line
            });
        await this.awaitConnection(provider);
        console.debug("Connected to:" + authInfo.room);

        return new YjsConnection(new SocketProvider(provider), ydoc, authInfo.username, authInfo.room, isOwner);
    }


    private awaitConnection(provider: WebsocketProvider) {
        return new Promise<void>((resolve, _reject) => {
            provider.on("status", (event: { status: string }) => {
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

    async connect(authInfo: ConnAuthInfo, isOwner: boolean): Promise<IConnection> {
        console.debug("connecting via webrtc to " + this.signalingServerUrl + " room: " + authInfo.room + " username: " + authInfo.username);
        if (!authInfo.password) {
            console.warn("no password provided for webrtc connection");
        }

        const ydoc = new Y.Doc();
        const provider = new WebrtcProvider(authInfo.room, ydoc, [this.signalingServerUrl], isOwner, authInfo.password);
        await this.awaitConnection(provider);

        tunnelClient(provider);

        return new YjsConnection(new RTCProvider(provider), ydoc, authInfo.username, authInfo.room, isOwner);

    }

    async awaitConnection(provider: WebrtcProvider) {
        await provider.connect();
        return new Promise<void>((resolve, _reject) => {
            provider.on("synced", (event: { synced: boolean }) => {
                console.log("Synced", event.synced);
                resolve();
            });

            provider.on("peers", (event: {
                removed: Array<string>,
                added: Array<string>,
                webrtcPeers: Array<string>,
                bcPeers: Array<string>
            }) => {
                console.log("peers", event);
                resolve();
            });
        });
    }

    supportsPassword(): boolean {
        return true;
    }

}


