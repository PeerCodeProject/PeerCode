import { Doc } from 'yjs';

import { YjsBinder } from '../../core/bind/binder';
import FileShareManager from '../../core/bind/fileShareManager';
import { FileSystemManager } from '../../core/fs/fileSystemManager';
import { PeerManager } from '../../peer/peer';
import { Session } from '../../session/session';
import { IConnection } from '../conn';

export class YjsConnection implements IConnection {

    private readonly session: Session;
    constructor(private doc: Doc, private username: string, private room: string) {
        this.session = this.createNewSession();
    }

    private createNewSession(): Session {
        let peerManager = new PeerManager();
        let fileSystemManager = FileSystemManager.getInstace();
        let yjsBinder = new YjsBinder(this.doc, this.username, peerManager);
        let fileShareManager = new FileShareManager(yjsBinder, fileSystemManager);
        yjsBinder.setRemoteFileListener(fileShareManager);
        return new Session(this.room, peerManager, fileShareManager);
    }

    getSession(): Session {
        return this.session;
    }

}
