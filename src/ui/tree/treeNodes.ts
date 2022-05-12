import * as vscode from 'vscode';

import { Peer } from '../../peer/peer';
import { Session } from '../../session/session';

export interface TreeNode extends vscode.TreeItem { }

export class SessionsTreeNode extends vscode.TreeItem implements TreeNode {
    constructor(hasConnections: boolean) {
        let state = hasConnections ?
            vscode.TreeItemCollapsibleState.Expanded :
            vscode.TreeItemCollapsibleState.None;
        super("Session", state);

        this.contextValue = "sessions";
    }

}

export class PeerTreeNode extends vscode.TreeItem implements TreeNode {
    constructor(peerName: Peer) {
        super(peerName.peername);

        this.contextValue = "peer";
    }

}


export class SessionTreeNode extends vscode.TreeItem implements TreeNode {
    constructor(public session: Session) {
        let state = session.getPeerManager().getPeers().length === 0 ?
            vscode.TreeItemCollapsibleState.None :
            vscode.TreeItemCollapsibleState.Expanded;
        super(session.getRoomName(), state);

        this.contextValue = "session";
    }

}
