import * as vscode from 'vscode';
import { SessionManager } from './session/SessionManager';
import { YjsConnector } from './connector/YJSConnector';
import { initGlobal } from './utils';
const SIGNALING_SERVERURL = "ws://localhost:4444";

var sessionManager: SessionManager;

export async function activate(context: vscode.ExtensionContext) {

	console.log('"peercode" is now active!');
	console.log("absolutePath", context.asAbsolutePath("bla"));
	console.log('extensionPath', context.extensionPath);
	console.log('extensionUri', context.extensionUri);

	initGlobal();
	init(context);
	registerCommands(context);
	await sessionManager.createSession();
}


export function deactivate() {
	// @ts-ignore
}

function registerCommands(context: vscode.ExtensionContext) {
	const disposables = [
		vscode.commands.registerCommand('peercode.StartSession', async () => {
			await sessionManager.createSession().catch(err => {
				console.log("Error in StartSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		}),

		vscode.commands.registerCommand('peercode.JoinSession', async () => {
			await sessionManager.createSession().catch(err => {
				console.log("Error in JoinSession", err);
				vscode.window.showErrorMessage(err.message);
			});
		})
	];

	context.subscriptions.push(...disposables);
}

function init(context: vscode.ExtensionContext) {
	sessionManager = new SessionManager(new YjsConnector(SIGNALING_SERVERURL));
}

