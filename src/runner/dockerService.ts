import path = require("path");
import { DockerRunner } from "./docker";

export class DockerService {
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
}