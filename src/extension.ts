import * as vscode from "vscode";

import { Config } from "./config";
import { ConnFactory } from "./connector/connFactory";
import { FileSharer } from "./core/fs/fileSharer";
import { getWorkspacePath } from "./core/fs/fileSystemManager";
import { SessManager } from "./session/sessManager";
import { PeerCodeSessionTreeDataProvider } from "./ui/tree/peerCodeTreeDataProvider";
import { initGlobal } from "./utils";
import { SessionTreeNode } from "./ui/tree/treeNodes";
import { ApplicationFacade } from './facade';
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
		vscode.commands.registerCommand("peercode.NewSession", async () => {
			await facade.startSession().catch(async err => {
				console.log("Error in NewSession", err);
				await vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand("peercode.JoinSession", async () => {
			await facade.joinSession().catch(async err => {
				console.log("Error in JoinSession", err);
				await vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand("peercode.paint", (session: SessionTreeNode) => {
			facade.renderPaint(context.extensionUri, session.session);
		}),

		vscode.commands.registerCommand("peercode.runDocker", async (session: SessionTreeNode) => {
			await facade.runDocker(session.session, workspacePath);
		}),

		vscode.commands.registerCommand("peercode.sharePort", async (session: SessionTreeNode) => {
			await facade.sharePort(session.session);
		}),
		vscode.commands.registerCommand("peercode.shareTerminal", async (session: SessionTreeNode) => {
			await facade.shareTerminal(session.session, workspacePath? workspacePath : "/");
		}),
	];

	context.subscriptions.push(...disposables);
}

function init(context: vscode.ExtensionContext) {
	const config = new Config();
	const connFactory = new ConnFactory(config);
	const workspacePath = getWorkspacePath();
	const fileSharer = new FileSharer(workspacePath);

	const sessionManager = new SessManager(connFactory.create());
	const facade = new ApplicationFacade(config, sessionManager, fileSharer, new DockerService(fileSharer));

	const treeProvider = new PeerCodeSessionTreeDataProvider(sessionManager);
	sessionManager.registerListener(treeProvider);

	vscode.window.registerTreeDataProvider("peercode.session", treeProvider);

	registerCommands(context, facade, workspacePath);

}

