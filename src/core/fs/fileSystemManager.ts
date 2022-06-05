import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class FileSystemManager {
    private static intastance: FileSystemManager | null = null;

    public static getInstace() {
        if (!this.intastance) {
            this.intastance = new FileSystemManager();
        }
        return this.intastance;
    }

    workspacePath: string;
    constructor() {
        const wspath = getWorkspacePath();
        if (wspath) {
            this.workspacePath = wspath;
        } else {
            throw new Error("open workspace");
        }

    }

    public addFile(filePath: string): vscode.Uri | null {
        const pathToFile = path.join(this.workspacePath, filePath);
        if (!makeFileSync(pathToFile)) {
            return null;
        }
        return vscode.Uri.file(pathToFile);
    }

    public getFileUri(filePath: string): vscode.Uri {
        const pathToFile = path.join(this.workspacePath, filePath);
        return vscode.Uri.file(pathToFile);
    }

    public deleteFile(file: vscode.Uri) {
        const pathToFile = file.fsPath;
        fs.unlinkSync(pathToFile);
    }

}

export function makeDirSync(dir: string) {
    if (fs.existsSync(dir)) {
        return false;
    }
    fs.mkdirSync(dir, { recursive: true });
    return true;
}

export function makeFileSync(filename: string) {
    if (fs.existsSync(filename)) {
        return false;
    }
    makeDirSync(path.join(path.dirname(filename)));
    fs.createWriteStream(filename).close();
    return true;
}

export function getWorkspacePath(): string | null {
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            return folder.uri.fsPath;
        }
    }
    return null;
}

export async function getAllFiles(wsPath: string): Promise<vscode.Uri[]> {
    const pattern = new vscode.RelativePattern(wsPath, "**/*");
    return vscode.workspace.findFiles(pattern);
}

export function getFileKeyFromUri(uri: vscode.Uri) {
    let url = uri.fsPath;
    const wspath = getWorkspacePath();
    if (wspath) {
        url = uri.fsPath.split(wspath)[1];
    }

    url = url.replace(/\\/g, "/");
    if (url[0] === "/") {
        url = url.slice(1);
    }
    return url;
}
