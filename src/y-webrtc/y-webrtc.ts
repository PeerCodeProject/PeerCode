// Original source code is at -> https://github.com/yjs/y-webrtc
import * as ws from "lib0/websocket";
import * as map from "lib0/map";
import * as error from "lib0/error";
import * as random from "lib0/random";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { Observable } from "lib0/observable";
import * as logging from "lib0/logging";
import * as bc from "lib0/broadcastchannel";
import * as buffer from "lib0/buffer";
import { createMutex } from "lib0/mutex";

import * as Y from "yjs";
import * as Peer from "simple-peer";

import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { Awareness } from "y-protocols/awareness";
import * as cryptoutils from "./crypto";
import { CryptoKey } from "@peculiar/webcrypto";
import { ICE_SERVERS } from "./wrtc-const";
import * as wrtc from "@roamhq/wrtc";

const log = logging.createModuleLogger("y-webrtc");
const messageTypes = {
  Sync: 0,
  QueryAwareness: 3,
  Awareness: 1,
  BcPeerId: 4,
  TunneledRequest: 5,
  TunneledResponse: 6,
  SharePort: 7,
  RunDocker: 8,
  TerminalOutData: 9,
  StartPeerTerminal: 10,
  TerminalCommand: 11,
};

const MAX_CONNECTIONS = 20;

const signalingConns = new Map<string, SignalingConnections>();

const rooms = new Map<string, Room>();

const checkIsSynced = (room: Room): void => {
  let synced = true;
  room.webrtcConns.forEach(peer => {
    if (!peer.synced) {
      synced = false;
    }
  });
  if ((!synced && room.synced) || (synced && !room.synced)) {
    room.synced = synced;
    room.provider.emit("synced", [{ synced }]);
    log("synced ", logging.BOLD, room.name, logging.UNBOLD, " with all peers");
  }
};

type CallBack = () => void;

const readMessage = async (
  room: Room,
  buf: Uint8Array,
  syncedCallback: CallBack,
): Promise<encoding.Encoder | null> => {
  const decoder = decoding.createDecoder(buf);
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder);
  if (room === undefined) {
    return null;
  }
  const awareness = room.awareness;
  const doc = room.doc;
  let sendReply = false;
  switch (messageType) {
    case messageTypes.TunneledRequest: {
      console.log("messageTunneledRequest");
      const port = decoding.readUint16(decoder);
      const data = decoding.readVarString(decoder);
      room.provider.emit("tunneledClientRequest", [port, data]);
      break;
    }
    case messageTypes.TunneledResponse: {
      console.log("messageTunneledResponse");
      const port = decoding.readUint16(decoder);
      const data = decoding.readVarString(decoder);
      room.provider.emit("tunneledServerResponse", [port, data]);
      break;
    }
    case messageTypes.SharePort: {
      console.log("messageSharePort");
      room.provider.emit("sharePort", [decoding.readUint16(decoder)]);
      break;
    }
    case messageTypes.RunDocker: {
      console.log("messageRunDocker");
      room.provider.emit("runDocker", [decoding.readVarString(decoder)]);
      break;
    }
    case messageTypes.TerminalOutData: {
      console.log("messageTerminalOutData");
      room.provider.emit("TerminalOutPut", [decoding.readVarString(decoder)]);
      break;
    }
    case messageTypes.StartPeerTerminal: {
      console.log("messageStartPeerTerminal");
      room.provider.emit("RemotePeerTerminal", [decoding.readVarString(decoder)]);
      break;
    }
    case messageTypes.TerminalCommand: {
      console.log("messageTerminalCommand");
      room.provider.emit("peerTerminalCommand", [decoding.readVarString(decoder)]);
      break;
    }
    case messageTypes.Sync: {
      encoding.writeVarUint(encoder, messageTypes.Sync);
      const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, room);
      if (syncMessageType === syncProtocol.messageYjsSyncStep2 && !room.synced) {
        syncedCallback();
      }
      if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
        sendReply = true;
      }
      break;
    }
    case messageTypes.QueryAwareness:
      encoding.writeVarUint(encoder, messageTypes.Awareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awareness.getStates().keys()),
        ),
      );
      sendReply = true;
      break;
    case messageTypes.Awareness:
      awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), room);
      break;
    case messageTypes.BcPeerId: {
      const add = decoding.readUint8(decoder) === 1;
      const peerName = decoding.readVarString(decoder);
      if (
        peerName !== room.peerId &&
        ((room.bcConns.has(peerName) && !add) || (!room.bcConns.has(peerName) && add))
      ) {
        const removed = [];
        const added = [];
        if (add) {
          room.bcConns.add(peerName);
          added.push(peerName);
        } else {
          room.bcConns.delete(peerName);
          removed.push(peerName);
        }
        room.provider.emit("peers", [
          {
            added,
            removed,
            webrtcPeers: Array.from(room.webrtcConns.keys()),
            bcPeers: Array.from(room.bcConns),
          },
        ]);
        await broadcastBcPeerId(room);
      }
      break;
    }
    default:
      console.error("Unable to compute message");
      return encoder;
  }
  if (!sendReply) {
    // nothing has been written, no answer created
    return null;
  }
  return encoder;
};

const readPeerMessage = (
  peerConn: WebrtcConn,
  buf: Uint8Array,
): Promise<encoding.Encoder | null> => {
  const room = peerConn.room;
  log(
    "received message from ",
    logging.BOLD,
    peerConn.remotePeerId,
    logging.GREY,
    " (",
    room.name,
    ")",
    logging.UNBOLD,
    logging.UNCOLOR,
  );
  return readMessage(room, buf, (): void => {
    peerConn.synced = true;
    log(
      "synced ",
      logging.BOLD,
      room.name,
      logging.UNBOLD,
      " with ",
      logging.BOLD,
      peerConn.remotePeerId,
    );
    checkIsSynced(room);
  });
};

const sendWebrtcConn = (webrtcConn: WebrtcConn, encoder: encoding.Encoder): void => {
  log(
    "send message to ",
    logging.BOLD,
    webrtcConn.remotePeerId,
    logging.UNBOLD,
    logging.GREY,
    " (",
    webrtcConn.room.name,
    ")",
    logging.UNCOLOR,
  );
  try {
    webrtcConn.peer.send(encoding.toUint8Array(encoder));
  } catch (e) {
    console.log("cannot send message to peer", e);
  }
};

const broadcastWebrtcConn = (room: Room, m: Uint8Array): void => {
  log("broadcast message in ", logging.BOLD, room.name, logging.UNBOLD);
  room.webrtcConns.forEach(conn => {
    try {
      if (conn.peer.connected) {
        conn.peer.send(m);
      } else {
        console.warn("room is not connected:" + room.name);
      }
    } catch (e) {
      console.log("error in broadcastWebrtcConn ", e);
    }
  });
};

export class WebrtcConn {
  room: Room;
  remotePeerId: string;
  closed: boolean;
  connected: boolean;
  synced: boolean;
  peer: Peer.Instance;

  constructor(
    signalingConn: SignalingConnections,
    initiator: boolean,
    remotePeerId: string,
    room: Room,
  ) {
    log("establishing connection to ", logging.BOLD, remotePeerId);
    this.room = room;
    this.remotePeerId = remotePeerId;
    this.closed = false;
    this.connected = false;
    this.synced = false;
    this.peer = new Peer({ initiator, ...room.provider.peerOpts });
    this.peer.on("signal", async signal => {
      log("WebrtcConn signal ", logging.BOLD, remotePeerId);
      await publishSignalingMessage(signalingConn, room, {
        to: remotePeerId,
        from: room.peerId,
        type: "signal",
        signal,
      });
    });
    this.peer.on("connect", (): void => {
      log("WebrtcConn connected to ", logging.BOLD, remotePeerId);
      this.connected = true;
      // send sync step 1
      const doc = room.provider.doc;
      const awareness = room.awareness;
      let encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTypes.Sync);
      syncProtocol.writeSyncStep1(encoder, doc);
      sendWebrtcConn(this, encoder);
      const awarenessStates = awareness.getStates();
      if (awarenessStates.size > 0) {
        encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageTypes.Awareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())),
        );
        sendWebrtcConn(this, encoder);
      }
    });
    this.peer.on("close", (): void => {
      log("WebrtcConn close ", logging.BOLD, remotePeerId);
      this.connected = false;
      this.closed = true;
      if (room.webrtcConns.has(this.remotePeerId)) {
        room.webrtcConns.delete(this.remotePeerId);
        room.provider.emit("peers", [
          {
            removed: [this.remotePeerId],
            added: [],
            webrtcPeers: Array.from(room.webrtcConns.keys()),
            bcPeers: Array.from(room.bcConns),
          },
        ]);
      }
      checkIsSynced(room);
      this.peer.destroy();
      log("closed connection to ", logging.BOLD, remotePeerId);
      announceSignalingInfo(room);
    });
    this.peer.on("error", err => {
      log("WebrtcConn Error in connection to ", logging.BOLD, remotePeerId, ": ", err);
      announceSignalingInfo(room);
    });
    this.peer.on("data", async data => {
      const answer = await readPeerMessage(this, data);
      if (answer !== null) {
        sendWebrtcConn(this, answer);
      }
    });
  }

  destroy(): void {
    this.peer.destroy();
  }
}

const broadcastBcMessage = (room: Room, m: Uint8Array): Promise<void> =>
  cryptoutils
    .encrypt(m, room.key)
    .then(data => room.mux(() => bc.publish(room.name, data), undefined));

const broadcastRoomMessage = async (room: Room, m: Uint8Array): Promise<void> => {
  // console.log("broadcastRoomMessage room:", room);
  if (room.bcconnected) {
    await broadcastBcMessage(room, m);
  }
  broadcastWebrtcConn(room, m);
};

const announceSignalingInfo = (room: Room): void => {
  signalingConns.forEach(async conn => {
    // only subscribe if connection is established, otherwise the conn automatically subscribes to all rooms
    if (conn.connected) {
      conn.send({ type: "subscribe", topics: [room.name] });
      if (room.webrtcConns.size < room.provider.maxConnections) {
        await publishSignalingMessage(conn, room, {
          type: "announce",
          from: room.peerId,
        });
      }
    }
  });
};

const broadcastBcPeerId = async (room: Room): Promise<void> => {
  if (room.provider.filterBcConnections) {
    // broadcast peerId via broadcastchannel
    const encoderPeerIdBc = encoding.createEncoder();
    encoding.writeVarUint(encoderPeerIdBc, messageTypes.BcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 1);
    encoding.writeVarString(encoderPeerIdBc, room.peerId);
    await broadcastBcMessage(room, encoding.toUint8Array(encoderPeerIdBc));
  }
};

function broadcastStringData(data: string, messageCode: number, originThis: Room): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageCode);
  encoding.writeVarString(encoder, data);
  broadcastWebrtcConn(originThis, encoding.toUint8Array(encoder));
}

export class Room {
  peerId: string;
  awareness: Awareness;
  synced: boolean;
  webrtcConns: Map<string, WebrtcConn>;
  bcConns: Set<string>;
  mux: (a: CallBack, b: CallBack | undefined) => void;
  bcconnected: boolean;

  constructor(
    public doc: Y.Doc,
    public provider: WebrtcProvider,
    public name: string,
    public key: CryptoKey | null,
  ) {
    /**
     * Do not assume that peerId is unique. This is only meant for sending signaling messages.
     */
    this.peerId = random.uuidv4();
    this.awareness = provider.awareness;
    this.synced = false;

    this.webrtcConns = new Map<string, WebrtcConn>();

    this.bcConns = new Set<string>();
    this.mux = createMutex();
    this.bcconnected = false;
    this.bcSubscriber = this.bcSubscriber.bind(this);

    this.provider.on("clientRequest", (port: number, data: string): void => {
      console.log("clientRequest", port, data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTypes.TunneledRequest);
      encoding.writeUint16(encoder, port);
      encoding.writeVarString(encoder, data);
      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    this.provider.on("serverResponse", (port: number, data: string): void => {
      console.log("serverResponse", port, data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTypes.TunneledResponse);
      encoding.writeUint16(encoder, port);
      encoding.writeVarString(encoder, data);
      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    this.provider.on("startSharingPort", (data: number): void => {
      console.log("startSharingPort", data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTypes.SharePort);
      encoding.writeUint16(encoder, data);
      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    this.provider.on("runDockerRemote", (data: string): void => {
      console.log("runDockerRemote", data);
      broadcastStringData(data, messageTypes.RunDocker, this);
    });
    this.provider.on("terminalOutData", (data: string): void => {
      console.log("terminalOutData", data);
      broadcastStringData(data, messageTypes.TerminalOutData, this);
    });
    this.provider.on("startPeerTerminal", (data: string): void => {
      console.log("startPeerTerminal", data);
      broadcastStringData(data, messageTypes.StartPeerTerminal, this);
    });
    this.provider.on("terminalCommand", (data: string): void => {
      console.log("terminalCommand", data);
      broadcastStringData(data, messageTypes.TerminalCommand, this);
    });

    process.on("exit", this.beforeUnloadHandler);
  }

  async connect(): Promise<void> {
    this.doc.on("update", this.docUpdateHandler.bind(this));
    this.awareness.on("update", this.awarenessUpdateHandler.bind(this));
    // signal through all available signaling connections
    announceSignalingInfo(this);
    bc.subscribe(this.name, this.bcSubscriber);
    this.bcconnected = true;
    // broadcast peerId via broadcastchannel
    await broadcastBcPeerId(this);
    // write sync step 1
    const encoderSync = encoding.createEncoder();
    encoding.writeVarUint(encoderSync, messageTypes.Sync);
    syncProtocol.writeSyncStep1(encoderSync, this.doc);
    await broadcastBcMessage(this, encoding.toUint8Array(encoderSync));
    // broadcast local state
    const encoderState = encoding.createEncoder();
    encoding.writeVarUint(encoderState, messageTypes.Sync);
    syncProtocol.writeSyncStep2(encoderState, this.doc);
    await broadcastBcMessage(this, encoding.toUint8Array(encoderState));
    // write queryAwareness
    const encoderAwarenessQuery = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessQuery, messageTypes.QueryAwareness);
    await broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessQuery));
    // broadcast local awareness state
    const encoderAwarenessState = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessState, messageTypes.Awareness);
    encoding.writeVarUint8Array(
      encoderAwarenessState,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
    );
    await broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessState));
  }

  async disconnect(): Promise<void> {
    // signal through all available signaling connections
    signalingConns.forEach(conn => {
      if (conn.connected) {
        conn.send({ type: "unsubscribe", topics: [this.name] });
      }
    });
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "disconnect");
    // broadcast peerId removal via broadcastchannel
    const encoderPeerIdBc = encoding.createEncoder();
    encoding.writeVarUint(encoderPeerIdBc, messageTypes.BcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 0); // remove peerId from other bc peers
    encoding.writeVarString(encoderPeerIdBc, this.peerId);
    await broadcastBcMessage(this, encoding.toUint8Array(encoderPeerIdBc));

    bc.unsubscribe(this.name, this.bcSubscriber);
    this.bcconnected = false;
    this.doc.off("update", this.docUpdateHandler.bind(this));
    this.awareness.off("update", this.awarenessUpdateHandler.bind(this));
    this.webrtcConns.forEach(conn => conn.destroy());
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    process.off("exit", this.beforeUnloadHandler);
  }

  private async bcSubscriber(data: ArrayBuffer): Promise<void> {
    await cryptoutils.decrypt(new Uint8Array(data), this.key).then((m: Uint8Array) =>
      this.mux(async () => {
        const reply = await readMessage(this, m, () => {
          // console.log("read message _bcSubscriber");
        });
        if (reply) {
          await broadcastBcMessage(this, encoding.toUint8Array(reply));
        }
      }, undefined),
    );
  }

  /**
   * Listens to Yjs updates and sends them to remote peers
   *
   */
  private async docUpdateHandler(update: Uint8Array): Promise<void> {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageTypes.Sync);
    syncProtocol.writeUpdate(encoder, update);
    await broadcastRoomMessage(this, encoding.toUint8Array(encoder));
  }

  /**
   * Listens to Awareness updates and sends them to remote peers
   *
   */
  private awarenessUpdateHandler = async ({
    added,
    updated,
    removed,
  }: {
    added: Array<number>;
    updated: Array<number>;
    removed: Array<number>;
  }): Promise<void> => {
    const changedClients = added.concat(updated).concat(removed);
    const encoderAwareness = encoding.createEncoder();
    encoding.writeVarUint(encoderAwareness, messageTypes.Awareness);
    encoding.writeVarUint8Array(
      encoderAwareness,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
    );
    await broadcastRoomMessage(this, encoding.toUint8Array(encoderAwareness));
  };

  private beforeUnloadHandler(): void {
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "window unload");
    rooms.forEach(async room => {
      await room.disconnect();
    });
  }
}

const openRoom = (
  doc: Y.Doc,
  provider: WebrtcProvider,
  name: string,
  key: CryptoKey | null,
): Room => {
  // there must only be one room
  if (rooms.has(name)) {
    throw error.create(`A Yjs Doc connected to room "${name}" already exists!`);
  }
  const room = new Room(doc, provider, name, key);
  rooms.set(name, room);
  return room;
};

const publishSignalingMessage = async (
  conn: SignalingConnections,
  room: Room,
  data: unknown,
): Promise<void> => {
  if (room.key) {
    await cryptoutils.encryptJson(data as cryptoutils.EncryptTypes, room.key).then(encryptJson => {
      conn.send({
        type: "publish",
        topic: room.name,
        data: buffer.toBase64(encryptJson),
      });
    });
  } else {
    conn.send({ type: "publish", topic: room.name, data });
  }
};

async function handleMessage(signalingConn: SignalingConnections, message: any): Promise<void> {
  switch (message.type) {
    case "publish": {
      // console.log("on message publish", JSON.stringify(message));
      const roomName = message.topic;
      const room = rooms.get(roomName);
      if (!room || typeof roomName !== "string") {
        return;
      }
      const execMessage = (data: any): void => {
        const webrtcConnections = room.webrtcConns;
        const peerId = room.peerId;
        if (
          !data ||
          data.from === peerId ||
          (data.to !== undefined && data.to !== peerId) ||
          room.bcConns.has(data.from)
        ) {
          // ignore messages that are not addressed to this conn, or from clients that are connected via broadcastchannel
          return;
        }
        const emitPeerChange = webrtcConnections.has(data.from)
          ? () => {
              console.debug("emit peer change - do nothing");
            }
          : () =>
              room.provider.emit("peers", [
                {
                  removed: [],
                  added: [data.from],
                  webrtcPeers: Array.from(room.webrtcConns.keys()),
                  bcPeers: Array.from(room.bcConns),
                },
              ]);
        switch (data.type) {
          case "announce":
            console.log("announce", data);
            if (webrtcConnections.size < room.provider.maxConnections) {
              map.setIfUndefined(
                webrtcConnections,
                data.from,
                () => new WebrtcConn(signalingConn, true, data.from, room),
              );
              emitPeerChange();
            }
            break;
          case "signal":
            if (data.to === peerId) {
              console.log("signal", data, peerId);
              map
                .setIfUndefined(
                  webrtcConnections,
                  data.from,
                  () => new WebrtcConn(signalingConn, false, data.from, room),
                )
                .peer.signal(data.signal);
              emitPeerChange();
            }
            break;
        }
      };
      if (room.key) {
        if (typeof message.data === "string") {
          await cryptoutils
            .decryptJson(buffer.fromBase64(message.data), room.key)
            .then(execMessage);
        }
      } else {
        execMessage(message.data);
      }
      break;
    }
    case "pong": {
      // console.log("on message pong");
      break;
    }
    default: {
      console.warn(`unknown message type ${message.type}`, JSON.stringify(message));
      break;
    }
  }
}

export class SignalingConnections extends ws.WebsocketClient {
  providers = new Set<WebrtcProvider>();
  constructor(url: string) {
    super(url);

    this.on("connect", () => {
      log(`connected (${url})`);
      const topics = Array.from(rooms.keys());
      this.send({ type: "subscribe", topics });
      rooms.forEach(room =>
        publishSignalingMessage(this, room, {
          type: "announce",
          from: room.peerId,
        }),
      );
    });
    this.on("message", async (m: any): Promise<void> => {
      if (typeof m !== "object" || m === null) {
        console.warn("unexpected message", m);
        return;
      }
      await handleMessage(this, m);
    });
    this.on("disconnect", () => log(`disconnect (${url})`));
  }
}

export interface WebRtcEvents {
  clientRequest: (port: number, data: string) => void;
  serverResponse: (port: number, data: string) => void;
  startSharingPort: (data: number) => void;
  runDockerRemote: (data: string) => void;
  terminalOutData: (data: string) => void;
  startPeerTerminal: (data: string) => void;
  terminalCommand: (data: string) => void;
  tunneledClientRequest: (port: number, data: string) => void;
  tunneledServerResponse: (port: number, data: string) => void;
  peers: (data: {
    added: string[];
    removed: string[];
    webrtcPeers: string[];
    bcPeers: string[];
  }) => void;
  RemotePeerTerminal: (data: string) => void;
  peerTerminalCommand: (data: string) => void;
  synced: (data: { synced: boolean }) => void;
  runDocker: (data: string) => void;
  TerminalOutPut: (data: string) => void;
  sharePort: (data: number) => void;
}

export class WebrtcProvider extends Observable<string> {
  awareness: Awareness;
  maxConnections: number;
  filterBcConnections: boolean;
  shouldConnect: boolean;
  signalingConnections: SignalingConnections[];
  peerOpts: Peer.Options;
  key: CryptoKey | null = null;
  room: Room | null = null;

  constructor(
    public roomName: string,
    public doc: Y.Doc,
    public signalingUrls: string[],
    public isOwner: boolean,
    private password: string | null = null,
  ) {
    super();
    this.filterBcConnections = true;
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.shouldConnect = false;
    this.signalingConnections = [];
    this.maxConnections = MAX_CONNECTIONS;
    this.peerOpts = {
      wrtc: wrtc,
      config: {
        iceServers: ICE_SERVERS,
      },
    };

    // this.connect();
    // if (this.shouldConnect) {
    //   this.room.connect();
    // } else {
    //   this.room.disconnect();
    // }

    this.destroy = this.destroy.bind(this);
    doc.on("destroy", this.destroy);
  }

  get connected(): boolean {
    return this.room !== null && this.shouldConnect;
  }

  async connect(): Promise<void> {
    if (this.password) {
      this.key = await cryptoutils.deriveKey(this.password, this.roomName);
    }

    this.room = openRoom(this.doc, this, this.roomName, this.key);

    this.shouldConnect = true;
    this.signalingUrls.forEach(url => {
      const signalingConn = map.setIfUndefined(
        signalingConns,
        url,
        () => new SignalingConnections(url),
      );
      this.signalingConnections.push(signalingConn);
      signalingConn.providers.add(this);
    });
    if (this.room) {
      await this.room.connect();
    }
  }

  async disconnect(): Promise<void> {
    this.shouldConnect = false;
    this.signalingConnections.forEach(conn => {
      conn.providers.delete(this);
      if (conn.providers.size === 0) {
        conn.destroy();
        signalingConns.delete(conn.url);
      }
    });
    if (this.room) {
      await this.room.disconnect();
    }
  }

  async destroy(): Promise<void> {
    this.doc.off("destroy", this.destroy);
    // need to wait for key before deleting room
    // this.key.then(() => {
    await this.room?.destroy();
    rooms.delete(this.roomName);
    // });
    super.destroy();
  }
}
