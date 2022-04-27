import { IConnection } from './IConnection';
import { IConnector } from './IConnector';
import { YjsConnection } from './YJSConnection';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export class YjsConnector implements IConnector {

    constructor(private signalingServerUrl: string) {
    }

    connect(username: string, room: string): Promise<IConnection> {
        process.env['LOG'] = '*';

        let ydoc = new Y.Doc();
        //@ts-ignore
        const provider = new WebrtcProvider(room, ydoc, {
            signaling: [this.signalingServerUrl],
            peerOpts: { wrtc: require('wrtc') }
        });
        provider.connect();

        const awearness = provider.awareness;
        awearness.setLocalState({ [username]:"test123" });
        console.log("Id", awearness.clientID);
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