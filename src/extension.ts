import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	console.log('"peercode" is now active!');

	let disposable = vscode.commands.registerCommand('peercode.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from PeerCode!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
