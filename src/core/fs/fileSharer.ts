import { Session } from "../../session/session";

import { getAllFiles } from "./fileSystemManager";

export class FileSharer {

    constructor(public workspacePath: string | null) {
    }

    async shareWorkspace(sess: Session) {
        let files = await getAllFiles(this.workspacePath!);
        console.log("files to Share: " + files);
        for (let file of files) {
            sess.shareLocalFile(file);
        }
    }
}

