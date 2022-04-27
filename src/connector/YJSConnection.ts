import { Doc } from 'yjs';
import { IConnection } from './IConnection';
export class YjsConnection implements IConnection{
    constructor(private doc:  Doc, private username: string, private room: string){
           
    }

}