import { IConnection } from '../IConnection';
import { IConnector } from '../IConnector';
import { YjsConnection } from './YJSConnection';
import * as Y from 'yjs';
import { WebrtcProvider } from '../../y-webrtc/y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import { YjsBinder } from '../../core/Binder';


export abstract class YjsConnector implements IConnector {
    abstract connect(username: string, room: string): Promise<IConnection>;

}


export class YWebSocketConnector extends YjsConnector {
    constructor(private wsServerUrl: string) {
        super();
    }
    async connect(username: string, room: string): Promise<IConnection> {
        console.debug("connecting via websocket to " + this.wsServerUrl + " room: " + room + " username: " + username);
        let ydoc = new Y.Doc();
        const provider = new WebsocketProvider(this.wsServerUrl, room, ydoc,
            {
                WebSocketPolyfill: require('ws')  // eslint-disable-line 
            });
        let promise = new Promise<void>((resolve, _reject) => {
            provider.on('status', (event: any) => {
                let status = event.status;
                console.debug("status on ws connect:" + status);
                if (status === "connected") {
                    console.debug('Connected to:' + room);
                    resolve();
                }
            });
        });
        await promise;
        let _binder = new YjsBinder(ydoc, username);
        return new YjsConnection(ydoc, username, room);
    }

}


export class YWebRTCConnector extends YjsConnector {
    constructor(private signalingServerUrl: string) {
        super();
    }

    connect(username: string, room: string): Promise<IConnection> {
        console.debug("connecting via webrtc to " + this.signalingServerUrl + " room: " + room + " username: " + username);
        console.debug(process.env);
        process.env['LOG'] = '*';
        let ydoc = new Y.Doc();
        const provider = new WebrtcProvider(room, ydoc, [this.signalingServerUrl]);

        const awearness = provider.awareness;
        awearness.on("change", (x: any) => {
            console.log("change", x);
        });
        provider.on("synced", (event: any) => {
            console.log("Synced", event);
        });

        provider.on("peers", (event: any) => {
            console.log("peers", event);
        });
        let arr = ydoc.getArray("test-Array");
        arr.push([username]);
        return new Promise((resolve, _reject) => {
            provider.on('connected', () => {
                resolve(new YjsConnection(ydoc, username, room));
            });
        });

    }
}