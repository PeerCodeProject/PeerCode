import * as vscode from 'vscode';

import { Sess } from '../../session/sess';
import { getAllFiles } from './fileSystemManager';

export class FileSharer {

    constructor(public workspacePath: string | null) {
    }

    async shareWorkspace(sess: Sess) {
        if (!this.workspacePath) {
            console.error("open workspace!");
            return;
        }
        const files = await getAllFiles(this.workspacePath);
        console.log("files to Share: " + files);
        for (const file of files) {
            sess.shareLocalFile(file);
        }
    }

    shareFile(sess: Sess, filePath: vscode.Uri) {
        sess.shareLocalFile(filePath);
    }
}

