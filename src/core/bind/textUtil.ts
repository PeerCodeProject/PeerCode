import { Position } from "../dataStructs";
import * as vscode from "vscode";
import { randomInteger } from "../../utils";

function getLineAndCharacter(
  text: string,
  i: number,
  line: number,
  character: number,
): {
  character: number;
  line: number;
} {
  if (text.charAt(i) === "\r") {
    if (!(i + 1 < text.length && text.charAt(i + 1) === "\n")) {
      line++;
      character = 0;
    }
  } else if (text.charAt(i) === "\n") {
    line++;
    character = 0;
  } else {
    character++;
  }
  return { line, character };
}

export function lineAndCharacterToIndex(text: string, position: Position): number {
  let line = 0;
  let character = 0;

  for (let i = 0; i < text.length; i++) {
    if (line === position.row && character === position.column) {
      return i;
    }
    const { line: lineRes, character: charRes } = getLineAndCharacter(text, i, line, character);
    line = lineRes;
    character = charRes;
  }
  return text.length;
}

export function indexToLineAndCharacter(text: string, position: number): Position {
  let line = 0;
  let character = 0;

  for (let i = 0; i < Math.min(text.length, position); i++) {
    const { line: lineRes, character: charRes } = getLineAndCharacter(text, i, line, character);
    line = lineRes;
    character = charRes;
  }
  return new Position(line, character);
}

export function createRange(start: Position, end: Position): vscode.Range {
  return new vscode.Range(
    new vscode.Position(start.row, start.column),
    new vscode.Position(end.row, end.column),
  );
}

export function getRandomColor(): string {
  return `rgba(${randomInteger(0, 255)}, ${randomInteger(0, 255)}, ${randomInteger(0, 255)}, 0.4)`;
}

export function getPosition(position: vscode.Position): Position {
  return new Position(position.line, position.character);
}

export function getVSCodePosition(position: Position): vscode.Position {
  return new vscode.Position(position.row, position.column);
}

export function isCursor(selection: vscode.Selection): boolean {
  return (
    selection.start.character === selection.end.character &&
    selection.start.line === selection.end.line
  );
}
