import * as vscode from 'vscode';

export class WebRtcTerminalProfile extends vscode.TerminalProfile {
    constructor(private name: string, options: vscode.TerminalOptions | vscode.ExtensionTerminalOptions) {
        super(options);
    }
}

export class WebRtcTerminalProfileProvider implements vscode.TerminalProfileProvider{
    provideTerminalProfile(token: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalProfile> {
        return this.getTerminalProfile('Method not implemented.');
    }

    public getTerminalProfile(name: string): vscode.TerminalProfile {
        // options1: vscode.TerminalOptions;
        // options2: vscode.ExtensionTerminalOptions;
            
        return new WebRtcTerminalProfile(name);
    }
}