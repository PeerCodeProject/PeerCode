import * as http from 'http';
import stream = require('stream');

import { WebrtcConn, WebrtcProvider } from '../y-webrtc/y-webrtc';
import fetch, { RequestInit } from "node-fetch";

export function tunnelClient(webrtcConns: Map<string, WebrtcConn>, provider: WebrtcProvider) {
    // create server socket that listen to 8080 port
    // and send the received data to WebrtcConn
    const port = 8081;

    const serverHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const content = await getContent(req);
        const requ = getRequestObject(content, req);
        const request = JSON.stringify(requ);

        provider.emit("clientRequest", [request]);

        const responseHandler = (data1: string) => {
            console.log("responseHandler:" + data1);
            provider.off("tunneledServerResponse", responseHandler);
            const resp = JSON.parse(data1);
            res.writeHead(resp.status, resp.statusText, resp.headers);
            res.write(resp.data);
            res.end();
        };

        provider.on("tunneledServerResponse", responseHandler);
    };

    http.createServer(serverHandler).listen(port, () => {
        console.log(`http CLIENT TUNNEL running at port: ${port}`);
    });

}


export function tunnelServer(webrtcConns: Map<string, WebrtcConn>, provider: WebrtcProvider, port: number) {
    const handleTunneledRequestData = async (data1: string) => {
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

        provider.emit("serverResponse", [JSON.stringify({
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            headers: res.headers.raw(),
            data: await res.text()
        })]);


        console.log('sent response');
    };
    provider.on("tunneledClientRequest", handleTunneledRequestData);
}

function getRequestObject(content: unknown, req: http.IncomingMessage) {
    let requ;
    if (content !== null) {
        requ = {
            method: req.method,
            headers: req.headers,
            url: req.url,
            data: content
        };
    } else {
        requ = {
            method: req.method,
            headers: req.headers,
            url: req.url,
        };
    }
    return requ;
}


function getContent(readable: stream.Readable) {
    const chunks: any[] = [];
    readable.on('readable', () => {
        let chunk;
        while (null !== (chunk = readable.read())) {
            chunks.push(chunk);
        }
    });
    return new Promise((resolve, reject) => {
        readable.on('end', () => {
            if (chunks.length === 0) {
                resolve(null);
            }
            resolve(chunks.join(''));
        });
        readable.on("error", (e) => {
            reject(e);
        });
    });

}
