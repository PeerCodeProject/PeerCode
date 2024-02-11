import * as vscode from 'vscode';

import { IConfig } from './config';
import { FileSharer } from './core/fs/fileSharer';
import { DockerService } from './runner/dockerService';
import { Session } from './session/session';
import { SessionManager } from './session/sessionManager';
import { shareTerminalWithPeers } from './terminal/rtcTerm/terminal';
import { DockerPortListener, tunnelServer } from './tunneling/tunnel';
import { DrawingPanel } from './ui/webviews/panel/paint';
import { input } from './utils';

export class ApplicationFacade {


    constructor(private config: IConfig,
        private sessionManager: SessionManager,
        private fileSharer: FileSharer,
        private dockerService: DockerService) {
    }

    async startSession() {
        if (!this.fileSharer.workspacePath) {
            console.error("open workspace before starting session");
            return;
        }
        const sess = await this.sessionManager.createSession(this.dockerService, true);
        await this.fileSharer.shareWorkspace(sess);
        this.dockerService.registerListener(new DockerPortListener(sess.provider.getProvider()));
    }

    async joinSession() {
        await this.sessionManager.createSession(this.dockerService);
    }

    renderPaint(extensionUri: vscode.Uri, session: Session) {
        DrawingPanel.render(extensionUri, this.config,
            session.getRoomName(),
            session.getUsername());
    }

    async runDocker(session: Session, workspacePath: string | null) {
        if (workspacePath === null) {
            console.error("workspacePath is null");
            return;
        }
        if (session.isOwner) {
            await this.dockerService.runDockerLocallyAndShare(workspacePath, session);
        } else {
            if (session.provider.supportsDocker()) {
                this.dockerService.runDockerRemote(session);
            }
        }

    }

    async sharePort(session: Session) {
        if (!session.provider.supportsTunneling()) {
            throw new Error("does not support tunneling");
        }
        const port = await getPortToShare();
        tunnelServer(session.provider.getProvider(), port);
    }

    async shareTerminal(session: Session, workspacePath: string) {
        shareTerminalWithPeers(session.provider.getProvider(), workspacePath);
    }
}

async function getPortToShare() {
    const portStr = await input(async () => {
        return vscode.window.showInputBox(
            { prompt: 'Enter port to share', placeHolder: '8080', }
        );
    });
    return parseInt(portStr);
}

