import * as vscode from 'vscode';

import { ConnAuthInfo, IConnector } from '../connector/conn';
import { BaseObservable } from '../core/observable';
import { DockerService } from '../runner/dockerService';
import { input } from '../utils';
import { Sess, SessionListener } from './sess';

export class SessManager extends BaseObservable<SessionListener> {
    private sessions: Sess[] = [];

    constructor(private connector: IConnector) {
        super();
    }

    async createSession(dockerService: DockerService, isSessionOwner: boolean = false): Promise<Sess> {
        const authInfo = await getSessionInfo(this.connector.supportsPassword());
        const conn = await this.connector.connect(authInfo, isSessionOwner);
        const session = conn.getSession();
        dockerService.listenToDockerRun(session.provider.getPorvider(), session);
        this.addSession(session);
        return session;
    }

    addSession(session: Sess) {
        this.sessions.push(session);
        this.notify(async (listener) => listener.onAddSession(session));
    }

    getSessions(): Sess[] {
        return this.sessions;
    }

}


async function getSessionInfo(needPassword: boolean) {
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

    if (needPassword) {
        const password = await input(async () => {
            return vscode.window.showInputBox(
                {
                    prompt: "Enter room password",
                    password: true
                }
            );
        });
        return new ConnAuthInfo(username, roomname, password);
    }

    return new ConnAuthInfo(username, roomname);
}
