import * as vscode from "vscode";

import { config } from "./config";
import { ConnectorFactory } from "./connector/connectorFactory";
import { FileSharer } from "./core/fs/fileSharer";
import { getWorkspacePath } from "./core/fs/fileSystemManager";
import { SessionManager } from "./session/sessionManager";
import { PeerCodeSessionTreeDataProvider } from "./ui/tree/peerCodeTreeDataProvider";
import { initGlobal } from "./utils";
import { SessionTreeNode } from "./ui/tree/treeNodes";


export async function activate(context: vscode.ExtensionContext) {

	console.log("\"peercode\" is now active!");
	console.log("absolutePath", context.asAbsolutePath("bla"));
	console.log("extensionPath", context.extensionPath);
	console.log("extensionUri", context.extensionUri);

	initGlobal();
	init(context);
	// await sessionManager.createSession();
	console.log("peercode eneded activation");
}


export function deactivate() {
	// @ts-ignore
}

function registerCommands(context: vscode.ExtensionContext, sessionManager: SessionManager) {

	const disposables = [
		vscode.commands.registerCommand("peercode.StartSession", async () => {
			await sessionManager.startSession().catch(err => {
				console.log("Error in StartSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand("peercode.JoinSession", async () => {
			await sessionManager.joinSession().catch(err => {
				console.log("Error in JoinSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand("peercode.paint", (session: SessionTreeNode) => {
			sessionManager.renderPaint(context.extensionUri, session.session);
		})
	];

	context.subscriptions.push(...disposables);
}

function init(context: vscode.ExtensionContext) {
	const connFactory = new ConnectorFactory(config);
	let fileSharer = new FileSharer(getWorkspacePath());

	let sessionManager = new SessionManager(connFactory.create(), fileSharer);

	const treeProvider = new PeerCodeSessionTreeDataProvider(sessionManager);
	sessionManager.registerListener(treeProvider);

	vscode.window.registerTreeDataProvider("peercode.session", treeProvider);

	registerCommands(context, sessionManager);

}

