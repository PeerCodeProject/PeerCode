/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as Dockerode from "dockerode";
import { EventEmitter } from "events";
import * as fs from "fs";
import { makeFileSync } from "../core/fs/fileSystemManager";
import { ListContains } from "../utils";
import * as path from "path";

const Dockerfile = "Dockerfile";

// get all filenames with realtive path in directory
export function getAllFiles(directory: string): string[] {
  return fs.readdirSync(directory);
}

const promisifyStream = (stream: EventEmitter): Promise<unknown> =>
  new Promise((resolve, reject) => {
    stream.on("data", (data: any) => console.log("data: ", data.toString()));
    stream.on("end", resolve);
    stream.on("error", reject);
  });

export class DockerRunner {
  readonly docker = new Dockerode();

  // build image with docker file
  async buildFromDockerfile(contextPath: string, imageName: string): Promise<string[]> {
    const files = getAllFiles(contextPath);

    if (!ListContains(files, Dockerfile)) {
      throw new Error("Dockerfile not found in contextPath");
    }

    const portsList = getPortsToExport(path.join(contextPath, Dockerfile));

    const options: Dockerode.ImageBuildOptions = {
      t: imageName,
    };
    const context = {
      context: contextPath,
      src: files,
    };
    const stream = await this.docker.buildImage(context, options);
    await promisifyStream(stream);
    return portsList;
  }

  // run image with imagename
  async run(imageName: string, ports: string[]): Promise<Dockerode.Container> {
    const container = await this.createContainer(imageName, ports);
    console.log(container.id);

    // const startOptions = { hijack: true }; // deprecated
    const startRes = await container.start();
    console.log("start result:", startRes);
    return container;
  }

  public async saveLogs(
    container: Dockerode.Container,
    logsFilename: string,
  ): Promise<NodeJS.ReadableStream> {
    if (makeFileSync(logsFilename)) {
      console.log("making new file");
    }

    const logs = await DockerRunner.getContainerLogStream(container);

    writeLogFile(logs, logsFilename);

    await promisifyStream(logs);
    return logs;
  }

  private static async getContainerLogStream(
    container: Dockerode.Container,
  ): Promise<NodeJS.ReadableStream> {
    const containerLogsOpts = {
      follow: true,
      stdout: true,
      stderr: true,
    };
    // @ts-ignore
    return container.logs(containerLogsOpts);
  }

  private async createContainer(imageName: string, ports: string[]): Promise<Dockerode.Container> {
    const exposedPorts = getExposedPorts(ports);
    const portBindings = getPortBindings(ports);
    const createContainerOptions: Dockerode.ContainerCreateOptions = {
      Image: imageName,
      AttachStderr: true,
      AttachStdout: true,
      AttachStdin: false,
      Tty: true,
      OpenStdin: false,
      StdinOnce: false,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
      },
    };
    return this.docker.createContainer(createContainerOptions);
  }
}

function writeLogFile(stream: NodeJS.ReadableStream, fileName: string): void {
  console.log("writing to LOG file:", fileName);

  const writeStream = fs.createWriteStream(fileName, { flags: "a" });
  // stream.pipe(writeStream);
  stream.on("data", function (chunk: Buffer) {
    writeStream.write(chunk);
  });

  stream.on("end", () => {
    writeStream.write(getEndOfLog());
    writeStream.close();
  });
  // stream.pipe(writeStream);
}

function getEndOfLog(): Buffer {
  return convertStrToBuffer("\n----------------END-OF-LOG----------------\n");
}

function convertStrToBuffer(str: string): Buffer {
  // convert string to Buffer
  return Buffer.from(str, "utf-8");
}

function getPortsToExport(dockerfile: string): string[] {
  const ports: string[] = [];
  const lines = fs.readFileSync(dockerfile).toString().split("\n");
  lines.forEach(line => {
    if (line.startsWith("EXPOSE")) {
      const port = line.split(" ")[1].trim();
      ports.push(port);
    }
  });
  return ports;
}

type PortBindings = { [port: string]: { HostPort: string }[] };

function getPortBindings(ports: string[]): PortBindings {
  const portBindings: PortBindings = {};
  ports.forEach(port => {
    portBindings[port] = [{ HostPort: port }];
  });
  return portBindings;
}

function getExposedPorts(ports: string[]): { [port: string]: object } | undefined {
  if (ports.length === 0) {
    return undefined;
  }
  const exposedPorts: { [port: string]: object } = {};
  ports.forEach(port => {
    exposedPorts[port] = {};
  });
  return exposedPorts;
}
