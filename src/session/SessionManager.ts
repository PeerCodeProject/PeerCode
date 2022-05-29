import * as vscode from 'vscode';

import { IConnector } from '../connector/conn';
import { BaseObservable } from '../core/observable';
import { input } from '../utils';
import { Session, SessionListener } from './session';

export class SessionManager extends BaseObservable<SessionListener> {


    private sessions: Session[] = [];

    constructor(private connector: IConnector) {
        super();
    }

    async createSession(isSessionOwner: boolean = false): Promise<Session> {
        const { username, roomname } = await getSessionInfo();
        const conn = await this.connector.connect(username, roomname, isSessionOwner);
        const session = conn.getSession();
        this.addSession(session);
        return session;
    }

    addSession(session: Session) {
        this.sessions.push(session);
        this.notify(async (listener) => listener.onAddSession(session));
    }

    getSessions(): Session[] {
        return this.sessions;
    }

}


async function getSessionInfo() {
    const roomname = await input(async () => {
        return vscode.window.showInputBox(
            { prompt: 'Enter Room' }
        );
    });

    const username = await input(async () => {
        return vscode.window.showInputBox(
            { prompt: "Enter your username" }
        );
    });
    return { username, roomname};
}
