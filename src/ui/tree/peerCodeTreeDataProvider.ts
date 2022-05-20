import * as vscode from 'vscode';
import { TreeNode, SessionTreeNode, SessionsTreeNode, PeerTreeNode } from './treeNodes';
import { Session, SessionListener } from '../../session/session';
import { SessionManager } from '../../session/sessionManager';
import { Peer, PeerConnectionListener } from '../../peer/peer';

type EmmitedEventType = void | TreeNode | TreeNode[] | null | undefined;

export class PeerCodeSessionTreeDataProvider implements vscode.TreeDataProvider<TreeNode>,
    SessionListener, PeerConnectionListener {

    private _onDidChangeTreeData: vscode.EventEmitter<EmmitedEventType> = new vscode.EventEmitter<EmmitedEventType>();

    constructor(private manager: SessionManager) { }
    onPeerAdded(peer: Peer): void {
        this._onDidChangeTreeData.fire();
    }
    onPeerRemoved(peer: Peer): void {
        this._onDidChangeTreeData.fire();
    }
    onAddSession(session: Session): void {
        session.getPeerManager().regiterListener(this);
        this._onDidChangeTreeData.fire();
    }
    onRemoveSession(session: Session): void {
        this._onDidChangeTreeData.fire();
    }


    onDidChangeTreeData: vscode.Event<EmmitedEventType> = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TreeNode): vscode.ProviderResult<TreeNode[]> {
        let result: TreeNode[] = [];
        if (!element) {
            result.push(new SessionsTreeNode(this.manager.getSessions().length > 0));
            return Promise.resolve(result);
        }
        if (element instanceof SessionsTreeNode) {
            result = this.getSessions();
        } else if (element instanceof SessionTreeNode) {
            result = this.getPeers(element.session);
        }
        return Promise.resolve(result);
    }


    private getPeers(session: Session) {
        return session.getSessionPeers().map(peer => new PeerTreeNode(peer));
    }

    private getSessions() {
        return this.manager.getSessions()
            .map(connection => new SessionTreeNode(connection));
    }
}