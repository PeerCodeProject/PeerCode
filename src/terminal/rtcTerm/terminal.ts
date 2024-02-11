#!/usr/bin/env node
import { Observable } from "lib0/observable";
import * as vscode from "vscode";

import { HostTerminal, PeerTerminal } from "./pty";

interface ShareTerminalEvents {
  startPeerTerminal: () => void;
  terminalOutData: (data: string) => void;
  peerTerminalCommand: (command: string) => void;
}

export function shareTerminalWithPeers(provider: Observable<string>, workspacePath: string): void {
  const pty = new HostTerminal(workspacePath, (data: string) => {
    provider.emit("terminalOutData", [data]);
  });
  const options = {
    name: "peercode terminal",
    pty: pty,
  };
  const terminal = vscode.window.createTerminal(options);
  terminal.show();

  provider.emit("startPeerTerminal", []);
  provider.on("peerTerminalCommand", async (command: string): Promise<void> => {
    // console.log("peerTerminal command", command);
    await pty.execCommand(command);
    // terminal.sendText(command, true);
  });
}

interface RegisterRemotePeerTerminalEvents {
  RemotePeerTerminal: () => void;
  terminalCommand: (command: string) => void;
  TerminalOutPut: (data: string) => void;
}

export function RegisterRemotePeerTerminalListener(
  provider: Observable<string>,
  workspacePath: string,
): void {
  provider.on("RemotePeerTerminal", () => {
    const pty = new PeerTerminal(workspacePath, (command: string) => {
      provider.emit("terminalCommand", [command]);
    });
    const options = {
      name: "peercode terminal",
      pty: pty,
    };
    const terminal = vscode.window.createTerminal(options);
    terminal.show();
    provider.on("TerminalOutPut", (data: string) => {
      pty.writeOutPut(data);
    });
  });
}
