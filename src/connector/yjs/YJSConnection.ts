import { Doc } from 'yjs';
import { Session } from '../../session/Session';
import { IConnection } from '../IConnection';
export class YjsConnection implements IConnection{
    
    constructor(private doc:  Doc, private username: string, private room: string){
           
    }
    getSession(): Session {
        throw new Error('Method not implemented.');
    }

}