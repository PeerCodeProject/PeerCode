import * as vscode from 'vscode';

import { IConfig } from './config';
import { FileSharer } from './core/fs/fileSharer';
import { DockerService } from './runner/dockerService';
import { Sess } from './session/sess';
import { SessManager } from './session/sessManager';
import { shareTerminalWithPeers } from './terminal/rtcTerm/terminal';
import { DockerPortListener, tunnelServer } from './tunneling/tunnel';
import { DrawingPanel } from './ui/webviews/panel/paint';
import { input } from './utils';

export class ApplicationFacade {


    constructor(private config: IConfig,
        private sessionManager: SessManager,
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
        this.dockerService.registerListener(new DockerPortListener(sess.provider.getPorvider()));
    }

    async joinSession() {
        await this.sessionManager.createSession(this.dockerService);
    }

    renderPaint(extensionUri: vscode.Uri, session: Sess) {
        DrawingPanel.render(extensionUri, this.config,
            session.getRoomName(),
            session.getUsername());
    }

    async runDocker(session: Sess, workspacePath: string | null) {
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

    async sharePort(session: Sess) {
        if (!session.provider.supportsTunneling()) {
            throw new Error("does not support tunneling");
        }
        const port = await getPortToShare();
        tunnelServer(session.provider.getPorvider(), port);
    }

    async shareTerminal(session: Sess, workspacePath: string) {
        shareTerminalWithPeers(session.provider.getPorvider(), workspacePath);
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

