import * as http from "http";
import stream = require("stream");

import fetch, { RequestInit, Response, Headers } from "node-fetch";
import { Observable } from "lib0/observable";
import * as vscode from "vscode";

interface DockerPortListenerEvents {
  clientRequest: (port: number, request: string) => void;
  serverResponse: (port: number, response: string) => void;
  startSharingPort: (port: number) => void;
  sharePort: (port: number) => void;
  tunneledClientRequest: (port: number, request: string) => void;
  tunneledServerResponse: (port: number, response: string) => void;
}

export class DockerPortListener {
  constructor(private provider: Observable<string>) {}

  public sharePort(port: string): void {
    tunnelServer(this.provider, +port);
  }
}

export function tunnelClient(provider: Observable<string>): void {
  const serverHandler = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    port: number,
  ): Promise<void> => {
    const content = await getContent(req);
    // TODO: this wont work for binary data
    const requestObject = getRequestObject(content, req);
    const requestString = JSON.stringify(requestObject);

    provider.emit("clientRequest", [port, requestString]);

    const responseHandler: (dataStr: string) => void = (dataStr: string) => {
      try {
        console.log("responseHandler:" + dataStr);
        const resp = JSON.parse(dataStr);

        resp.headers = resp.headers || {};
        const data = getData(resp);

        res.writeHead(resp.status, resp.statusText, resp.headers);
        res.write(data);
      } catch (error) {
        if (error instanceof Error) {
          res.writeHead(500, "Internal Server Error", {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "text/plain",
          });
          res.write("PEERCODE Error: " + error.message);
          console.error(error.message);
        }
      }
      res.end();
    };

    provider.on("tunneledServerResponse", (reqPort: number, data: string) => {
      if (port !== reqPort) {
        return;
      }
      responseHandler(data);
    });
  };

  provider.on("sharePort", (port: number) => {
    console.log("remote port is opened on: " + port);
    const server = http.createServer(async (req, res) => {
      await serverHandler(req, res, port);
    });
    server.listen(0, async () => {
      const address = server.address();
      if (address) {
        if (typeof address === "string") {
          await vscode.window.showInformationMessage("Tunnel opened on: " + address);
        } else {
          await vscode.window
            .showInformationMessage<string>(
              "Tunnel opened on: http://localhost:" + address.port,
              "Open",
            )
            .then(async _result => {
              await vscode.env.openExternal(vscode.Uri.parse("http://localhost:" + address.port));
            });
        }
      }
      console.log(`http CLIENT TUNNEL running at: ${JSON.stringify(server.address())}`);
    });
  });
}

export function tunnelServer(provider: Observable<string>, port: number): void {
  provider.emit("startSharingPort", [port]);

  const handleTunneledRequestData = async (reqPort: number, data1: string): Promise<void> => {
    if (port !== reqPort) {
      return;
    }
    try {
      const data = JSON.parse(data1);
      console.log(`Tunneled Request ${JSON.stringify(data, null, 2)}`);
      const url = `http://localhost:${port}${data.url}`;

      const reqInit: RequestInit = {
        headers: data.headers,
        method: data.method,
      };
      if (data.data !== undefined && data.data !== "") {
        reqInit.body = data.data;
      }
      const res = await fetch(url, reqInit);
      console.log(`Local response ${JSON.stringify(res, null, 2)}`);

      const contentData = await getContentData(res);
      // console.log("contentData: " + contentData);

      provider.emit("serverResponse", [
        port,
        JSON.stringify({
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          headers: res.headers.raw(),
          data: contentData,
          // data: new Uint8Array( await res.arrayBuffer())
        }),
      ]);
    } catch (error) {
      if (error instanceof Error) {
        provider.emit("serverResponse", [
          port,
          JSON.stringify({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            headers: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              "Content-Type": "text/plain",
            },
            data: "PEERCODE Error: " + error.message,
          }),
        ]);
        console.error(error.message);
      }
    }
    console.log("sent response");
  };
  provider.on("tunneledClientRequest", handleTunneledRequestData);
}

async function getContentData(res: Response): Promise<string> {
  return shouldGetBytes(res.headers)
    ? Buffer.from(await res.arrayBuffer()).toString("base64")
    : res.text();
}

function getRequestObject(content: unknown, req: http.IncomingMessage) {
  if (content !== null) {
    return {
      method: req.method,
      headers: req.headers,
      url: req.url,
      data: content,
    };
  }
  return {
    method: req.method,
    headers: req.headers,
    url: req.url,
  };
}

function getContent(readable: stream.Readable): Promise<string | Buffer | null> {
  const chunks: object[] = [];
  readable.on("readable", () => {
    let chunk;
    while (null !== (chunk = readable.read())) {
      chunks.push(chunk);
    }
  });
  return new Promise((resolve, reject) => {
    readable.on("end", () => {
      if (chunks.length === 0) {
        resolve(null);
      }
      resolve(chunks.join(""));
    });
    readable.on("error", e => {
      reject(e);
    });
  });
}

function shouldGetBytes(headers: Headers): boolean {
  const contentRanges = headers.get("Content-Ranges");
  if (contentRanges && contentRanges.includes("bytes")) {
    return true;
  }

  const contentType = headers.get("Content-Type");
  if (contentType === undefined || contentType === null) {
    return false;
  }

  return contentType.startsWith("image") || contentType.startsWith("video");
}

function getData(resp: any): string | Buffer {
  if (resp.data === undefined || resp.data === null) {
    return "";
  }
  const ranges = resp.headers["content-ranges"];
  if (ranges !== undefined && ranges !== null) {
    const range = ranges[0];
    if (range !== undefined && range !== null && range.includes("bytes")) {
      return Buffer.from(resp.data, "base64");
    }
  }

  const contentType = resp.headers["content-type"] || resp.headers["Content-Type"];
  if (contentType === undefined || contentType === null) {
    return resp.data;
  }

  if (contentType[0].includes("image") || contentType[0].includes("video")) {
    return Buffer.from(resp.data, "base64");
  }
  return resp.data;
}
