import * as vscode from "vscode";

import { Peer } from "../../peer/peer";
import { Session } from "../../session/session";

export type TreeNode = vscode.TreeItem;

export class SessionsTreeNode extends vscode.TreeItem implements TreeNode {
  constructor(hasConnections: boolean) {
    const state = hasConnections
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    super("Session", state);

    this.contextValue = "sessions";
  }
}

export class PeerTreeNode extends vscode.TreeItem implements TreeNode {
  constructor(peerName: Peer) {
    super(peerName.peerName);

    this.contextValue = "peer";
  }
}

export class SessionTreeNode extends vscode.TreeItem implements TreeNode {
  constructor(public session: Session) {
    const state =
      session.getSessionPeers().length === 0
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded;
    super(session.getRoomName(), state);

    this.contextValue = "session";
  }
}
