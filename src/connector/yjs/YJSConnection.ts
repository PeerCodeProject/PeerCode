import { Doc } from "yjs";

import { YjsBinder } from "../../core/bind/binder";
import FileShareManager from "../../core/bind/fileShareManager";
import { FileSystemManager } from "../../core/fs/fileSystemManager";
import { PeerManager } from "../../peer/peer";
import { Session } from "../../session/session";
import { IConnection } from "../connection";
import { YjsProviderWrapper } from "./provider";

export class YjsConnection implements IConnection {

    private readonly session: Session;
    constructor(private provider: YjsProviderWrapper, private doc: Doc,
        private username: string, private room: string,
        private isOwner: boolean) {
        this.session = this.createNewSession();
    }

    private createNewSession(): Session {
        const peerManager = new PeerManager();
        const fileSystemManager = FileSystemManager.getInstace();
        const yjsBinder = new YjsBinder(this.doc, this.username, peerManager);
        const fileShareManager = new FileShareManager(yjsBinder, fileSystemManager);
        yjsBinder.setRemoteFileListener(fileShareManager);
        return new Session(this.room, this.username, peerManager,
             fileShareManager, this.provider, this.isOwner);
    }

    getSession(): Session {
        return this.session;
    }

}
