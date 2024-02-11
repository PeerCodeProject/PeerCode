import { Session } from "../session/session";

export interface IConnector {
  connect(authInfo: ConnAuthInfo, isOwner: boolean): Promise<IConnection>;

  supportsPassword(): boolean;
}

export interface IConnection {
  getSession(): Session;
}

export class ConnAuthInfo {
  constructor(
    public username: string,
    public room: string,
    public password: string | null = null,
  ) {}
}
