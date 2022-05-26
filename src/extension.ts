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
import { DockerRunner, getAllFiles } from "./runner/docker";
import { DockerService } from "./runner/dockerService";


export async function activate(context: vscode.ExtensionContext) {

	console.log("\"peercode\" is now active!");
	
	console.log("absolutePath", context.asAbsolutePath("bla"));
	// console.log("extensionPath", context.extensionPath);
	// console.log("extensionUri", context.extensionUri);

	initGlobal();
	init(context);
	console.log("peercode eneded activation");
}


export function deactivate() {
	console.debug("peercode deactivate");
}

function registerCommands(context: vscode.ExtensionContext, facade: ApplicationFacade, workspacePath: string | null) {

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
		}),

		vscode.commands.registerCommand("peercode.runDocker", (session: SessionTreeNode) => {
			facade.runDocker(session.session, workspacePath);
		})
	];

	context.subscriptions.push(...disposables);
}

function init(context: vscode.ExtensionContext) {
	const config = new Config();
	const connFactory = new ConnectorFactory(config);
	const workspacePath = getWorkspacePath();
	const fileSharer = new FileSharer(workspacePath);

	const sessionManager = new SessionManager(connFactory.create());
	const facade = new ApplicationFacade(config, sessionManager, fileSharer, new DockerService());

	const treeProvider = new PeerCodeSessionTreeDataProvider(sessionManager);
	sessionManager.registerListener(treeProvider);

	vscode.window.registerTreeDataProvider("peercode.session", treeProvider);

	registerCommands(context, facade, workspacePath);

}

