import { Session } from "../session/session";

export interface IConnector {

    connect(username: string, room: string, isOwner: boolean): Promise<IConnection>;

}

export interface IConnection {
    getSession(): Session;
}

