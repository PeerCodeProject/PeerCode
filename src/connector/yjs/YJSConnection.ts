import { Doc } from 'yjs';
import { Session } from '../../session/session';
import { IConnection } from '../conn';
export class YjsConnection implements IConnection{
    
    private session: Session;
    constructor(private doc: Doc, private username: string, private room: string) {
        this.session = new Session(room);
           
    }
    getSession(): Session {
        return this.session;
    }

}