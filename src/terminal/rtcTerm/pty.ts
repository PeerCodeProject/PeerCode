"use strict";
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const exec = promisify(cpExec);
const formatText = (text: string) => `\r${text.split(/(\r?\n)/g).join("\r")}\r`;

// Settings
const defaultLine = "→ ";
const keys = {
    enter: "\r",
    backspace: "\x7f",
    up: "\x1b[A",
    down: "\x1b[B",
    right: "\x1b[C",
    left: "\x1b[D",
};


const actions = {
    cursorBack: "\x1b[D",
    deleteChar: "\x1b[P",
    clear: "\x1b[2J\x1b[3J\x1b[;H",
};

type TTListener = (data: string) => void;

abstract class AbstractPseudoTerminal implements vscode.Pseudoterminal {
    writeEmitter = new vscode.EventEmitter<string>();
    content = defaultLine;
    history: string[] = [];
    constructor(public workspaceRoot: string) { }
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;


    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        // + "\x1b[31mHello1 world\x1b[0m"/
        this.writeEmitter.fire(this.content);
    }

    writeOutPut(data: string) {
        this.writeEmitter.fire(data);
        this.content = defaultLine;
        this.writeEmitter.fire(`\r${this.content}`);
    }

    close(): void {
        console.log("AbstractPseudoTerminal close");
    }
    invokeListener(listener: TTListener | null, data: string) {
        if (listener) {
            listener(data);
        }
    }

    async handleInput(char: string): Promise<void>;
    async handleInput(char: string): Promise<void> { // default
        this.content += char;
        this.writeEmitter.fire(`\r${this.content}`);
    }

    async execCommand(command: string) {
        this.content = defaultLine + command;
        await this.handleInput("\r");
    }

}

export class HostTerminal extends AbstractPseudoTerminal {


    constructor(workspaceRoot: string,
        private terminalOutPutListener: TTListener) {
        super(workspaceRoot);
    }

    async handleInput(char: string) {
        // console.log("handleInput:", char, Buffer.from(char, "utf8").toJSON().data);
        switch (char) {
            case keys.enter: {
                // preserve the run command line for history
                this.writeEmitter.fire(`\r${this.content}\r\n`);
                // trim off leading default prompt
                const command = this.content.slice(defaultLine.length).trim();
                try {
                    if (!command || command === "") {
                        this.content = defaultLine;
                        this.writeEmitter.fire(this.content);
                        return;
                    }
                    // console.log("command:" + command);
                    this.history.push(command);
                    const { stdout, stderr } = await exec(command, {
                        encoding: "utf8",
                        cwd: this.workspaceRoot,
                    });

                    if (stdout) {
                        const output = formatText(stdout);
                        this.writeEmitter.fire(output);
                        this.invokeListener(this.terminalOutPutListener, output);
                    }

                    if (stderr && stderr.length) {
                        const errOut = formatText(stderr);
                        this.writeEmitter.fire(errOut);
                        this.invokeListener(this.terminalOutPutListener, errOut);

                    }
                } catch (error: unknown) {
                    if (error instanceof Error) {
                        const errorText = `\r${formatText(error.message)}`;
                        this.writeEmitter.fire(errorText);
                        this.invokeListener(this.terminalOutPutListener, errorText);
                    }
                }
                this.content = defaultLine;
                this.writeEmitter.fire(`\r${this.content}`);
                break;
            }
            case keys.backspace:
                if (this.content.length <= defaultLine.length) {
                    break;
                }
                // remove last character
                this.content = this.content.slice(0, this.content.length - 1);
                this.writeEmitter.fire(actions.cursorBack);
                this.writeEmitter.fire(actions.deleteChar);
                break;
            case keys.down:
            case keys.up: {
                if (this.history.length === 0) {
                    break;
                }
                const lastCommand = this.history.pop();
                if (lastCommand) {
                    this.content = defaultLine + lastCommand;
                } else {
                    this.content = defaultLine;
                }
                this.writeEmitter.fire(`\r${this.content}`);
                break;
            }
            case keys.right:
                // this.writeEmitter.fire(actions.cursorBack);
                break;
            case keys.left:
                // this.writeEmitter.fire(actions.cursorBack);
                break;
            default:
                // typing a new character
                this.content += char;
                this.writeEmitter.fire(char);
        }

    }
}



export class PeerTerminal extends AbstractPseudoTerminal {


    constructor(workspaceRoot: string,
        private terminalCommandListener: TTListener) {
        super(workspaceRoot);
    }

    async handleInput(char: string) {
        // console.log("handleInput:", char, Buffer.from(char, "utf8").toJSON().data);
        switch (char) {
            case keys.enter: {
                // preserve the run command line for history
                this.writeEmitter.fire(`\r${this.content}\r\n`);
                // trim off leading default prompt
                const command = this.content.slice(defaultLine.length).trim();
                if (!command || command === "") {
                    this.content = defaultLine;
                    this.writeEmitter.fire(this.content);
                    return;
                }
                // console.log("command:" + command);
                this.history.push(command);
                this.invokeListener(this.terminalCommandListener, command);

                this.content = defaultLine;
                this.writeEmitter.fire(`\r${this.content}`);
                break;
            }
            case keys.backspace:
                if (this.content.length <= defaultLine.length) {
                    break;
                }
                // remove last character
                this.content = this.content.slice(0, this.content.length - 1);
                this.writeEmitter.fire(actions.cursorBack);
                this.writeEmitter.fire(actions.deleteChar);
                break;
            case keys.down:
            case keys.up: {
                if (this.history.length === 0) {
                    break;
                }
                const lastCommand = this.history.pop();
                if (lastCommand) {
                    this.content = defaultLine + lastCommand;
                } else {
                    this.content = defaultLine;
                }
                this.writeEmitter.fire(`\r${this.content}`);
                break;
            }
            case keys.right:
                // this.writeEmitter.fire(actions.cursorBack);
                break;
            case keys.left:
                // this.writeEmitter.fire(actions.cursorBack);
                break;
            default:
                // typing a new character
                this.content += char;
                this.writeEmitter.fire(char);
        }
    }
}



