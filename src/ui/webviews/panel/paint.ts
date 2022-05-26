import * as vscode from "vscode";
import {getUri} from "../../../utils";
import {IConfig} from "../../../config";

export class DrawingPanel {
    public static currentPanel: DrawingPanel | undefined;
    private _disposables: vscode.Disposable[] = [];

    private constructor(private readonly  panel: vscode.WebviewPanel, extensionUri: vscode.Uri,
                        private readonly config: IConfig, private roomname: string, private username: string) {
        this.panel.onDidDispose(this.dispose, null, this._disposables);
        this.panel.webview.html = this.getWebviewContent(
            this.panel.webview,
            extensionUri
        );
    }

    public static render(extensionUri: vscode.Uri, config: IConfig, roomname: string, username: string) {
        if (DrawingPanel.currentPanel) {
            DrawingPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel(
                "super paint",
                "paint: " + roomname,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            DrawingPanel.currentPanel = new DrawingPanel(panel, extensionUri, config, roomname, username);
        }
    }

    public dispose() {
        DrawingPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri
    ) {
        // const mainUri = getUri(webview, extensionUri, ["webview-ui", "main.js"]);
        const scriptUri = getUri(webview, extensionUri, [
            "webview-ui",
            "script.js",
        ]);
        const styleUri = getUri(webview, extensionUri, [
            "webview-ui",
            "style.css",
        ]);
        const vscodeStyleUri = getUri(webview, extensionUri, [
            "webview-ui",
            "vscode.css",
        ]);
        const toolkitUri = getUri(webview, extensionUri, [
            "node_modules",
            "@vscode",
            "webview-ui-toolkit",
            "dist",
            "toolkit.js", 
        ]);
        const perfectFreeHandLib = getUri(webview, extensionUri, [
            "node_modules",
            "perfect-freehand",
            "esm",
            "index.js"
        ]);
        //    <script type="module" src="${perfectFreeHandLib}" ></script>

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width">
          <script  type="module" src="${toolkitUri}"></script>
           <link href="${styleUri}" rel="stylesheet" type="text/css" />
            <link href="${vscodeStyleUri}" rel="stylesheet" type="text/css" />
            <script> 
                window.username = "${this.username}";
                window.roomname = "${this.roomname}";
                window.serverUrl = "${this.config.getParamSting("webrtcServerURL")}";
                window.drawFreeHandLib = "${perfectFreeHandLib}";

            </script>
           <script type="module" src="${scriptUri}"></script>
            <title>paint</title>
        </head>
        <body>
        <div id="controllers">
            <div id="color-pallet">
            <label for="favcolor">Select Color:</label>
            <input type="color" id="favcolor" name="favcolor" value="#ff0000" width="10">
            </div>
            <button id="clear-canvas"  >Clear Canvas</button>
        </div>

        <div id="paint">
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" ></svg>
        </div>
        </body>
       
      </html>
    `;
    }


}
