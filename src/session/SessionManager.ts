import * as vscode from 'vscode';
import { input } from '../utils';
import { IConnector } from '../connector/IConnector';
import { threadId } from 'worker_threads';
import { YjsConnector } from '../connector/YJSConnector';

export class SessionManager {

    constructor(private connector: IConnector) { }


    async createSession() {
        let roomname = await input(async () => {
            return vscode.window.showInputBox(
                { prompt: 'Enter Room' }
            );
        });

        let username = await input(async () => {
            return vscode.window.showInputBox(
                { prompt: 'Enter your username' }
            );
        });

        this.connector.connect(username, roomname);

    }




    async joinSession() {
        await this.createSession();
    }



}