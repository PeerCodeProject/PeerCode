import { Sess } from "../session/sess";

export interface IConnector {

    connect(username: string, room: string, isOwner: boolean): Promise<IConnection>;

}

export interface IConnection {
    getSession(): Sess;
}

