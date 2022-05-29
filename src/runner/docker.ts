import * as Dockerode from "dockerode"; 
import { EventEmitter } from 'events';
import * as fs from "fs";
import { makeFileSync } from "../core/fs/fileSystemManager";

// get all filenames with realtive path in directory
export function getAllFiles(directory: string): string[] {
    return fs.readdirSync(directory);
}

const promisifyStream = (stream: EventEmitter) => new Promise((resolve, reject) => {
    stream.on('data', (data: any) => console.log("data: ", data.toString()));
    stream.on('end', resolve);
    stream.on('error', reject);
});

export class DockerRunner {
    readonly docker = new Dockerode();

    // build image with docker file 
    async buildFromDockerfile(contextpath: string, imageName: string) {
        const options: Dockerode.ImageBuildOptions = {
            t: imageName,
        };
        const context = {
            context: contextpath,
            src: getAllFiles(contextpath)
        };
        const stream = await this.docker.buildImage(context, options);
        await promisifyStream(stream);
    }

    // run image with imagename 
    async run(imageName: string) : Promise<Dockerode.Container>{
        const container = await this.createContainer(imageName);
        console.log(container);

        // const startOptions = { hijack: true }; // deprecated
        const startRes = await container.start();
        console.log("start result:", startRes);
        return container;
    }

    public async saveLogs(container: Dockerode.Container, logsFilename: string) {
        const logs = await this.getContainerLogStream(container);

        writeLogFile(logs, logsFilename);

        await promisifyStream(logs);
        return logs;
    }

    private async getContainerLogStream(container: Dockerode.Container) {
        const containerLogsOpts = {
            follow: true,
            stdout: true,
            stderr: true
        };
        return container.logs(containerLogsOpts);
    }

    private async createContainer(imageName: string) {
        const createContainerOptions: Dockerode.ContainerCreateOptions = {
            Image: imageName,
            AttachStderr: true,
            AttachStdout: true,
            AttachStdin: false,
            Tty: true,
            OpenStdin: false,
            StdinOnce: false
        };
        return this.docker.createContainer(createContainerOptions);
    }
}

function writeLogFile(stream: NodeJS.ReadableStream, fileName: string) {
    console.log("writing to LOG file:", fileName);

    if (makeFileSync(fileName)) {
        console.log("makeing new file");
    }

    const writeStream = fs.createWriteStream(fileName, { flags: 'a' });
    // stream.pipe(writeStream);
    stream.on('data', function (chunk: Buffer) {
            writeStream.write(chunk);
    });

    stream.on('end', () => {
        writeStream.write(getEndOfLog());
        writeStream.close();
    });
    // stream.pipe(writeStream);

}

function getEndOfLog() {
    return convertStrToBuffer("\n----------------END-OF-LOG----------------\n");
}

function convertStrToBuffer(str: string) {
    // convert string to Buffer
    return Buffer.from(str, "utf-8");
}