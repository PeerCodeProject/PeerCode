import * as vscode from 'vscode';
import { SessionManager } from './session/SessionManager';
import { initGlobal } from './utils';
import { ConnectorFactory } from './connector/ConnectorFactory';
import { config } from './config';

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
	const connFactory = new ConnectorFactory(config);
	sessionManager = new SessionManager(connFactory.create());
}

