import * as vscode from 'vscode';
import { TreeNode, SessionTreeNode, SessionsTreeNode } from './treeNodes';
import { Session } from '../../session/Session';

type EmmitedEventType = void | TreeNode | TreeNode[] | null | undefined;

export class PeerCodeSessionTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {

    private _onDidChangeTreeData: vscode.EventEmitter<EmmitedEventType> = new vscode.EventEmitter<EmmitedEventType>();

    constructor() {

    }

    onChange() {
        this._onDidChangeTreeData.fire();
    }

    onDidChangeTreeData?: vscode.Event<EmmitedEventType> | undefined;

    getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TreeNode | undefined): vscode.ProviderResult<TreeNode[]> {
       return [new SessionsTreeNode()];
    }

}