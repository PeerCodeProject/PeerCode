
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export interface IConfig {
    getParam(key: string): string | null;
    getParamSting(key: string): string;
    getParamInt(key: string): number;

}

export class Config implements IConfig {
    configs: Map<string, string>;

    constructor(initalConfigMap: Map<string, string> | null = null) {
        if (initalConfigMap) {
            this.configs = initalConfigMap;
        } else { // todo make outside
            this.configs = new Map<string, string>();
            // y-websocket | y-webrtc
            this.configs.set("connector", process.env.CONNECTOR || "y-webrtc");
            this.configs.set("webrtcServerURL", process.env.RTC_URL || "wss://peercode-signaling.herokuapp.com");
            this.configs.set("webSocketServerURL", process.env.WS_URL || "wss://yjs-websocket-test.herokuapp.com");
        }
    }

    getParam(key: string): string | null {
        const res = this.configs.get(key);
        if (!res) {
            return null;
        }
        return res;
    }

    getParamSting(key: string): string {
        const res = this.getParam(key);
        if (!res) {
            throw new Error(`Config key ${key} not found`);
        }
        return res;
    }

    getParamInt(key: string): number {
        return parseInt(this.getParamSting(key));
    }
}

// export const config = {
//     connector: process.env.CONNECTOR || "y-webrtc", // y-websocket | y-webrtc
//     webrtcServerURL: process.env.RTC_URL || "wss://peercode-signaling.herokuapp.com",
//     webSocketServerURL: process.env.WS_URL || "wss://yjs-websocket-test.herokuapp.com"
// };
