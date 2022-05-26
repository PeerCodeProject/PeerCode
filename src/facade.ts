import * as vscode from 'vscode';

import { IConfig } from './config';
import { FileSharer } from './core/fs/fileSharer';
import { DockerService } from './runner/dockerService';
import { Session } from './session/session';
import { SessionManager } from './session/sessionManager';
import { DrawingPanel } from './ui/webviews/panel/paint';

export class ApplicationFacade {

    constructor(private config: IConfig,
        private sessionManager: SessionManager,
        private fileSharer: FileSharer,
        private dockerService: DockerService ) {
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
        DrawingPanel.render(extensionUri, this.config, session.getRoomName(), session.getUsername());
    }

    async runDocker(session: Session, workspacePath: string | null) {
        if (workspacePath === null) {
            console.error("workspacePath is null");
            return;
        }
        const pathToLogs = await this.dockerService.runProject(workspacePath, session.getRoomName());

        const logUri = vscode.Uri.file(pathToLogs);
        this.fileSharer.shareFile(session, logUri);
    }
}
