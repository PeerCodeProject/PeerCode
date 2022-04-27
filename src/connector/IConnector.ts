import { IConnection } from "./IConnection";

export interface IConnector{
    
    connect(username: string, room: string): Promise<IConnection>;

}