import * as vscode from 'vscode';
import { input } from '../utils';
import { IConnector } from '../connector/IConnector';
import { Session } from './Session';

export class SessionManager {

    constructor(private connector: IConnector) { }


    async createSession() : Promise<Session> {
        let { username, roomname } = await getSessionInfo();

        let conn = await this.connector.connect(username, roomname);
        return conn.getSession();
    }


    async joinSession() {
        await this.createSession();
    }

}


async function getSessionInfo() {
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
    return { username, roomname };
}
