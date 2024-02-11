import { IConfig } from "../config";
import { IConnector } from "./connection";
import { YWebRTCConnector, YWebSocketConnector } from "./yjs/YJSConnector";

export class ConnectionFactory {
  constructor(private config: IConfig) {}

  create(): IConnector {
    if (this.config.getParamSting("connector") === "y-websocket") {
      return new YWebSocketConnector(this.config.getParamSting("webSocketServerURL"));
    } else if (this.config.getParamSting("connector") === "y-webrtc") {
      return new YWebRTCConnector(this.config.getParamSting("webrtcServerURL"));
    }
    throw new Error("Connector not found");
  }
}
