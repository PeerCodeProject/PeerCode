
import * as path from 'path';
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve( __dirname, '../.env') });

export var config = {
    connector: process.env.CONNECTOR ||'y-webrtc', // y-websocket | y-webrtc
    webrtcServerURL: process.env.RTC_URL || 'wss://peercode-signaling.herokuapp.com',
    webSocketServerURL: process.env.WS_URL || "wss://yjs-websocket-test.herokuapp.com"
};
