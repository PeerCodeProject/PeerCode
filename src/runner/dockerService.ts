import path = require("path");
import { DockerRunner } from "./docker";
import * as vscode from 'vscode';
import { Session } from '../session/session';
import { FileSharer } from "../core/fs/fileSharer";
import { Observable } from 'lib0/observable';
import { getWorkspacePath, makeFileSync } from '../core/fs/fileSystemManager';
import { BaseObservable } from "../core/observable";
import { DockerPortListener } from '../tunneling/tunnel';

const DockerContainerIdLength = 12;

export class DockerService extends BaseObservable<DockerPortListener>{

    constructor(private fileSharer: FileSharer) {
        super();
    }

    async runDockerLocallyAndShare(workspacePath: string, session: Session) {
        const pathToLogs = await this.runProject(workspacePath, session.getRoomName());
        const logUri = vscode.Uri.file(pathToLogs);
        await this.fileSharer.shareFile(session, logUri);
    }

    async runProject(workspacePath: string, roomName: string) {
        const imageName = DockerService.getImageName(roomName);
        const runner = new DockerRunner();
        const ports = await runner.buildFromDockerfile(workspacePath, imageName);
        const container = await runner.run(imageName, ports);
        const pathToLogs = DockerService.getLogPath(workspacePath, container.id);

        for (const port of ports) {
            this.notify((listener) => {
                console.log("tunnelServer: " + port);
                listener.sharePort(port);
            });
        }

        if (makeFileSync(pathToLogs)) {
            console.log("making new file: " + pathToLogs);
        }

        runner.saveLogs(container, pathToLogs).then(() => {
            console.log("logs saved");
        }).catch((err) => {
            console.error(err);
        });

        return pathToLogs;
    }


    private static getImageName(roomName: string) {
        return "peercode-" + roomName.toLowerCase();
    }

    private static getLogPath(workspacePath: string, containerId: string) {

        if (containerId.length > DockerContainerIdLength) {
            containerId = containerId.slice(0, DockerContainerIdLength);
        }
        return path.join(workspacePath, ".peercode", "logs", `run.${containerId}.log`);
    }


    public runDockerRemote(session: Session) {
        const provider = session.provider.getProvider();
        provider.emit("runDockerRemote", [session.getUsername()]);
    }

    public listenToDockerRun(provider: Observable<string>, session: Session) {
        provider.on("runDocker", async (args: string[]) => {
            console.log("run docker remotely");
            const wsPath = getWorkspacePath();
            if (!wsPath) {
                console.error("open workspace!");
                return;
            }
            await this.runDockerLocallyAndShare(wsPath, session);
        });
    }
}

