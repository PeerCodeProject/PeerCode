import { IConnector } from './conn';
import { YWebRTCConnector, YWebSocketConnector } from './yjs/YJSConnector';



export class ConnectorFactory {

    constructor(private config: any) {
    }

    create(): IConnector {
        if (this.config.connector === 'y-websocket') {
            return new YWebSocketConnector(this.config.webSocketServerURL);
        } else if (this.config.connector === 'y-webrtc') {
            return new YWebRTCConnector(this.config.webrtcServerURL);
        }
        throw new Error('Connector not found');
    }

}
