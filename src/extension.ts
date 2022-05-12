import * as vscode from 'vscode';
import { SessionManager } from './session/SessionManager';
import { initGlobal } from './utils';
import { ConnectorFactory } from './connector/ConnectorFactory';
import { config } from './config';
import { PeerCodeSessionTreeDataProvider } from './ui/tree/peerCodeTreeDataProvider';


export async function activate(context: vscode.ExtensionContext) {

	console.log('"peercode" is now active!');
	console.log("absolutePath", context.asAbsolutePath("bla"));
	console.log('extensionPath', context.extensionPath);
	console.log('extensionUri', context.extensionUri);

	initGlobal();
	init(context);
	// await sessionManager.createSession();
	console.log('peercode eneded activation');
}


export function deactivate() {
	// @ts-ignore
}

function registerCommands(context: vscode.ExtensionContext, sessionManager: SessionManager) {
	
	const disposables = [
		vscode.commands.registerCommand('peercode.StartSession', async () => {
			await sessionManager.createSession().catch(err => {
				console.log("Error in StartSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand('peercode.JoinSession', async () => {
			await sessionManager.joinSession().catch(err => {
				console.log("Error in JoinSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		})
	];

	context.subscriptions.push(...disposables);
}

function init(context: vscode.ExtensionContext) {
	const connFactory = new ConnectorFactory(config);
	let sessionManager = new SessionManager(connFactory.create());

	const treeProvider = new PeerCodeSessionTreeDataProvider();
	vscode.window.registerTreeDataProvider("peercode.session", treeProvider);

	registerCommands(context, sessionManager);

}

