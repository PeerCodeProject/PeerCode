import path = require("path");
import { DockerRunner } from "./docker";
import * as vscode from 'vscode';
import { Sess } from '../session/sess';
import { FileSharer } from "../core/fs/fileSharer";
import { Observable } from 'lib0/observable';
import { getWorkspacePath } from '../core/fs/fileSystemManager';

export class DockerService {
    
    constructor(private fileSharer: FileSharer) {}
    
    async runDockerLocallyAndShare(workspacePath: string,  session: Sess) {
        const pathToLogs = await this.runProject(workspacePath,  session.getRoomName());
        const logUri = vscode.Uri.file(pathToLogs);
        this.fileSharer.shareFile(session, logUri);
    }

    async runProject(workspacePath: string, roomName: string) {
        const imageName = this.getImageName(roomName);
        
        const runner = new DockerRunner();
        
        await runner.buildFromDockerfile(workspacePath, imageName);
        
        const container = await runner.run(imageName);

        const pathToLogs = this.getLogPath(workspacePath, container.id);

        await runner.saveLogs(container, pathToLogs);
        return pathToLogs;
    }


    private getImageName(roomName: string) {
        return "peercode-" + roomName;
    }

    private getLogPath(workspacePath: string, containerId: string) {
        if (containerId.length > 8) {
            containerId = containerId.slice(0, 9);
        }
        return path.join(workspacePath, ".peercode", "logs", `run.${containerId}.log`);
    }


    public runDockerRemote(session: Sess) {
        const provider = session.provider.getPorvider();
        provider.emit("runDockerRemote", [session.getUsername()]); 
    }

    public listenToDockerRun(provider: Observable<string>, session:Sess) {
        provider.on("runDocker", async (args: string[]) => {
            console.log("run docker remotely");
            await this.runDockerLocallyAndShare(getWorkspacePath()!, session);
        });
    }
}

