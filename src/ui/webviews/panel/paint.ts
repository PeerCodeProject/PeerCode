import * as vscode from "vscode";
import {getUri} from "../../../utils";
import {config} from "../../../config";

export class DrawingPanel {
    public static currentPanel: DrawingPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri,
                        private roomname: string, private username: string) {
        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(
            this._panel.webview,
            extensionUri
        );
    }

    public static render(extensionUri: vscode.Uri, roomname: string, username: string) {
        if (DrawingPanel.currentPanel) {
            DrawingPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
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

            DrawingPanel.currentPanel = new DrawingPanel(panel, extensionUri, roomname, username);
        }
    }

    public dispose() {
        DrawingPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(
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
            "toolkit.js", // A toolkit.min.js file is also available
        ]);
        const self = this;
        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width">
            <script type="module" src="${toolkitUri}"></script>
            <script type="module" src="${scriptUri}"></script>
            <script> 
                window.username = "${self.username}";
                window.roomname = "${self.roomname}";
                window.serverUrl = "${config.webrtcServerURL}";
            </script>
            <link href="${styleUri}" rel="stylesheet" type="text/css" />
            <link href="${vscodeStyleUri}" rel="stylesheet" type="text/css" />
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
