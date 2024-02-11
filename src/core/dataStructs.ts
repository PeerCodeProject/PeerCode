export class Position {
  constructor(
    public row: number,
    public column: number,
  ) {}
}

export class Selection {
  constructor(
    public id: string,
    public start: Position,
    public end: Position,
    public reversed: boolean,
    public isCursor: boolean,
  ) {}
}

export enum TextChangeType {
  INSERT,
  UPDATE,
  DELETE, // eslint-disable-line
}

export class TextChange {
  constructor(
    public type: TextChangeType,
    public start: Position,
    public end: Position,
    public text: string,
  ) {}
}

export class PeerSelection {
  constructor(
    public peer: string,
    public selection: Selection,
  ) {}
}
