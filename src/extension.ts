import * as vscode from "vscode";

import { Config } from "./config";
import { ConnectorFactory } from "./connector/connectorFactory";
import { FileSharer } from "./core/fs/fileSharer";
import { getWorkspacePath } from "./core/fs/fileSystemManager";
import { SessionManager } from "./session/sessionManager";
import { PeerCodeSessionTreeDataProvider } from "./ui/tree/peerCodeTreeDataProvider";
import { initGlobal } from "./utils";
import { SessionTreeNode } from "./ui/tree/treeNodes";
import { ApplicationFacade } from './facade';


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
	console.debug("peercode deactivate");
}

function registerCommands(context: vscode.ExtensionContext, facade: ApplicationFacade) {

	const disposables = [
		vscode.commands.registerCommand("peercode.StartSession", async () => {
			await facade.startSession().catch(err => {
				console.log("Error in StartSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand("peercode.JoinSession", async () => {
			await facade.joinSession().catch(err => {
				console.log("Error in JoinSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand("peercode.paint", (session: SessionTreeNode) => {
			facade.renderPaint(context.extensionUri, session.session);
		})
	];

	context.subscriptions.push(...disposables);
}

function init(context: vscode.ExtensionContext) {
	const config = new Config();
	const connFactory = new ConnectorFactory(config);
	const fileSharer = new FileSharer(getWorkspacePath());

	const sessionManager = new SessionManager(connFactory.create());
	const facade = new ApplicationFacade(config, sessionManager, fileSharer);
	const treeProvider = new PeerCodeSessionTreeDataProvider(sessionManager);
	sessionManager.registerListener(treeProvider);

	vscode.window.registerTreeDataProvider("peercode.session", treeProvider);

	registerCommands(context, facade);

}

