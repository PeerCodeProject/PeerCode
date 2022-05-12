import { Session } from "../session/Session";

export interface IConnection {
    getSession(): Session ;

}