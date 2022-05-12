import * as vscode from 'vscode';


export interface TreeNode extends vscode.TreeItem { }

export class SessionsTreeNode extends vscode.TreeItem implements TreeNode {
    constructor() {
        super("Session");

        this.contextValue = "sessions";
    }

}

export class SessionTreeNode extends vscode.TreeItem implements TreeNode {
    constructor(roomname: string) {
        super(roomname);
        
        this.contextValue = "session";

    }

}
