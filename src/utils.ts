import * as path from 'path';
const fetch = require('node-fetch');
// const wrtc = require('wrtc');

export async function input(inputter: () => Promise<string | undefined | null>) {
    let result = await inputter();
    if (!result) {
        throw new Error("Input Error");
    }
    
    return result;
}

const globalTemp: any = global;

export function initGlobal() {
    globalTemp.WebSocket = require('ws');
    process.env['LOG'] = '*';
    // globalTemp.RTCPeerConnection = wrtc.RTCPeerConnection;
    // process.env.LOG = '*';
    // globalTemp.crypto = require('crypto');
}



export function fileUrl(str: string) {
    var pathName = path.resolve(str).replace(/\\/g, '/');

    if (pathName[0] !== '/') {
        pathName = '/' + pathName;
    }

    return encodeURI('file://' + pathName);
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve, _reject) => {
        setTimeout(resolve, ms);
    });
}

export function removeValueFromArray<T>(array: T[], value: T) {
    let index = array.indexOf(value);
    if (index >= 0) {
        array.splice(index, 1);
    }
}
