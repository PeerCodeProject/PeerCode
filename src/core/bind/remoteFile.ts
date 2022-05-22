import * as Y from "yjs";

import { PeerSelection } from "../dataStructs";
import { YjsConstants } from "./constants";

export interface YFile {
    peer: string;
    filename: string;
    selections: Y.Array<PeerSelection>;
    text: Y.Text;
    saveRequests: Y.Array<string>;
}


export class RemoteFile extends Y.Map<any> implements YFile {

    constructor(peer: string,
        filename: string,
        initialText: string | null = null) {
        super();
        this.peer = peer;
        this.filename = filename;
        this.selections = new Y.Array<PeerSelection>();
        this.saveRequests = new Y.Array<string>();
        if (initialText) {
            this.text = new Y.Text(initialText);
        } else {
            this.text = new Y.Text();
        }
    }

    get peer(): string {
        return this.get(YjsConstants.peerKey);
    }

    set peer(peer: string) {
        this.set(YjsConstants.peerKey, peer);
    }

    get filename(): string {
        return this.get(YjsConstants.filenameKey);
    }

    set filename(filename: string) {
        this.set(YjsConstants.filenameKey, filename);
    }

    get selections(): Y.Array<PeerSelection> {
        const selections = this.get(YjsConstants.selectionsKey);
        if (selections === undefined) {
            console.warn("Proxy: Selections are undefined");
        }
        return selections;
    }

    set selections(selections: Y.Array<PeerSelection>) {
        if (selections === undefined) {
            console.error("Settings selections to undefined");
        }
        this.set(YjsConstants.selectionsKey, selections);
    }

    get text(): Y.Text {
        return this.get(YjsConstants.textKey);
    }

    set text(text: Y.Text) {
        this.set(YjsConstants.textKey, text);
    }

    get saveRequests(): Y.Array<string> {
        return this.get(YjsConstants.saveRequestsKey);
    }

    set saveRequests(saveRequests: Y.Array<string>) {
        this.set(YjsConstants.saveRequestsKey, saveRequests);
    }


}


export class RemoteFileWrapper implements YFile {
    constructor(public delegate: Y.Map<any>) {
    }

    get peer(): string {
        return this.delegate.get(YjsConstants.peerKey);
    }

    set peer(peer: string) {
        this.delegate.set(YjsConstants.peerKey, peer);
    }

    get filename(): string {
        return this.delegate.get(YjsConstants.filenameKey);
    }

    set filename(filename: string) {
        this.delegate.set(YjsConstants.filenameKey, filename);
    }

    get selections(): Y.Array<PeerSelection> {
        const selections = this.delegate.get(YjsConstants.selectionsKey);
        if (selections === undefined) {
            console.warn("Proxy: Selections are undefined");
        }
        return selections;
    }

    set selections(selections: Y.Array<PeerSelection>) {
        if (selections === undefined) {
            console.error("Proxy: Settings selections to undefined");
        }
        this.delegate.set(YjsConstants.selectionsKey, selections);
    }

    get text(): Y.Text {
        return this.delegate.get(YjsConstants.textKey);
    }

    set text(buffer: Y.Text) {
        this.delegate.set(YjsConstants.textKey, buffer);
    }

    get saveRequests(): Y.Array<string> {
        return this.delegate.get(YjsConstants.saveRequestsKey);
    }

    set saveRequests(saveRequests: Y.Array<string>) {
        this.delegate.set(YjsConstants.saveRequestsKey, saveRequests);
    }

}
