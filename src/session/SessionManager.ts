import * as vscode from "vscode";

import { IConnector } from "../connector/conn";
import { FileSharer } from "../core/fs/fileSharer";
import { BaseObservable } from "../core/observable";
import { input } from "../utils";
import { Session, SessionListener } from "./session";
import { DrawingPanel } from "../ui/webviews/panel/paint";

export class SessionManager extends BaseObservable<SessionListener> {


    private sessions: Session[] = [];

    constructor(private connector: IConnector,
        private fileSharer: FileSharer) {
        super();
    }

    async startSession() {
        if (!this.fileSharer.workspacePath) {
            console.error("open workspace before starting session");
            return;
        }
        let sess = await this.createSession();
        await this.fileSharer.shareWorkspace(sess);
    }

    async createSession(): Promise<Session> {
        let { username, roomname } = await getSessionInfo();

        let conn = await this.connector.connect(username, roomname);
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

    async joinSession() {
        await this.createSession();
    }

    renderPaint(extensionUri: vscode.Uri, session: Session) {
        DrawingPanel.render(extensionUri,session.getRoomName(),session.getUsername());
    }
}


async function getSessionInfo() {
    // let roomname = await input(async () => {
    //     return vscode.window.showInputBox(
    //         { prompt: 'Enter Room' }
    //     );
    // });

    let username = await input(async () => {
        return vscode.window.showInputBox(
            { prompt: "Enter your username" }
        );
    });
    return { username, "roomname": "roomname1" };
}
