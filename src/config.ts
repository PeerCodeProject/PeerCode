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

  constructor(initialConfigMap: Map<string, string> | null = null) {
    if (initialConfigMap) {
      this.configs = initialConfigMap;
    } else {
      // todo make outside
      this.configs = new Map<string, string>();
      // y-websocket | y-webrtc
      this.configs.set("connector", process.env.CONNECTOR!);
      this.configs.set("webrtcServerURL", process.env.RTC_URL!);
      this.configs.set(
        "webSocketServerURL",
        process.env.WS_URL ?? "wss://yjs-websocket-test.herokuapp.com",
      );
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
