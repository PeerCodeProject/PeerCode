import { IConfig } from "./config";
import { SessionManager } from "./session/sessionManager";
import { FileSharer } from "./core/fs/fileSharer";
import { Session } from "./session/session";
import * as vscode from "vscode";
import { DrawingPanel } from './ui/webviews/panel/paint';

export class ApplicationFacade {
    constructor(private config: IConfig, private sessionManager: SessionManager, private fileSharer: FileSharer) {
    }

    async startSession() {
        if (!this.fileSharer.workspacePath) {
            console.error("open workspace before starting session");
            return;
        }
        const sess = await this.sessionManager.createSession(true);
        await this.fileSharer.shareWorkspace(sess);
    }

    async joinSession() {
        await this.sessionManager.createSession(true);
    }

    renderPaint(extensionUri: vscode.Uri, session: Session) {
        DrawingPanel.render(extensionUri,this.config, session.getRoomName(), session.getUsername());
    }
}
