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

const signalingConns = new Map<string, SignalingConn>();


const rooms = new Map<string, Room>();

const checkIsSynced = (room: Room) => {
  let synced = true;
  room.webrtcConns.forEach((peer) => {
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

const readMessage = async (room: Room, buf: Uint8Array, syncedCallback: CallBack): Promise<encoding.Encoder | null> => {
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
      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        doc,
        room
      );
      if (
        syncMessageType === syncProtocol.messageYjsSyncStep2 &&
        !room.synced
      ) {
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
          Array.from(awareness.getStates().keys())
        )
      );
      sendReply = true;
      break;
    case messageTypes.Awareness:
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        room
      );
      break;
    case messageTypes.BcPeerId: {
      const add = decoding.readUint8(decoder) === 1;
      const peerName = decoding.readVarString(decoder);
      if (
        peerName !== room.peerId &&
        ((room.bcConns.has(peerName) && !add) ||
          (!room.bcConns.has(peerName) && add))
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

const readPeerMessage = async (peerConn: WebrtcConn, buf: Uint8Array): Promise<encoding.Encoder | null> => {
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
    logging.UNCOLOR
  );
  return readMessage(room, buf, () => {
    peerConn.synced = true;
    log(
      "synced ",
      logging.BOLD,
      room.name,
      logging.UNBOLD,
      " with ",
      logging.BOLD,
      peerConn.remotePeerId
    );
    checkIsSynced(room);
  });
};

const sendWebrtcConn = (webrtcConn: WebrtcConn, encoder: encoding.Encoder) => {
  log(
    "send message to ",
    logging.BOLD,
    webrtcConn.remotePeerId,
    logging.UNBOLD,
    logging.GREY,
    " (",
    webrtcConn.room.name,
    ")",
    logging.UNCOLOR
  );
  try {
    webrtcConn.peer.send(encoding.toUint8Array(encoder));
  } catch (e) {
    console.log("cannot send message to peer", e);
  }
};

const broadcastWebrtcConn = (room: Room, m: Uint8Array) => {
  log("broadcast message in ", logging.BOLD, room.name, logging.UNBOLD);
  room.webrtcConns.forEach((conn) => {
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

  constructor(signalingConn: SignalingConn, initiator: boolean, remotePeerId: string, room: Room) {
    log("establishing connection to ", logging.BOLD, remotePeerId);
    this.room = room;
    this.remotePeerId = remotePeerId;
    this.closed = false;
    this.connected = false;
    this.synced = false;
    this.peer = new Peer({ initiator, ...room.provider.peerOpts });
    this.peer.on("signal", async (signal) => {
      log("WebrtcConn signal ", logging.BOLD, remotePeerId);
      await publishSignalingMessage(signalingConn, room, {
        to: remotePeerId,
        from: room.peerId,
        type: "signal",
        signal,
      });
    });
    this.peer.on("connect", () => {
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
          awarenessProtocol.encodeAwarenessUpdate(
            awareness,
            Array.from(awarenessStates.keys())
          )
        );
        sendWebrtcConn(this, encoder);
      }
    });
    this.peer.on("close", () => {
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
    this.peer.on("error", (err) => {
      log("WebrtcConn Error in connection to ", logging.BOLD, remotePeerId, ": ", err);
      announceSignalingInfo(room);
    });
    this.peer.on("data", async (data) => {
      const answer = await readPeerMessage(this, data);
      if (answer !== null) {
        sendWebrtcConn(this, answer);
      }
    });
  }

  destroy() {
    this.peer.destroy();
  }
}

const broadcastBcMessage = (room: Room, m: Uint8Array) =>
  cryptoutils
    .encrypt(m, room.key)
    .then((data) => room.mux(() => bc.publish(room.name, data), undefined));

const broadcastRoomMessage = async (room: Room, m: Uint8Array) => {
  // console.log("broadcastRoomMessage room:", room);
  if (room.bcconnected) {
    await broadcastBcMessage(room, m);
  }
  broadcastWebrtcConn(room, m);
};

const announceSignalingInfo = (room: Room) => {
  signalingConns.forEach(async (conn) => {
    // only subscribe if connection is established, otherwise the conn automatically subscribes to all rooms
    if (conn.connected) {
      conn.send({ type: "subscribe", topics: [room.name] });
      if (room.webrtcConns.size < room.provider.maxConns) {
        await publishSignalingMessage(conn, room, {
          type: "announce",
          from: room.peerId,
        });
      }
    }
  });
};

const broadcastBcPeerId = async (room: Room) => {
  if (room.provider.filterBcConns) {
    // broadcast peerId via broadcastchannel
    const encoderPeerIdBc = encoding.createEncoder();
    encoding.writeVarUint(encoderPeerIdBc, messageTypes.BcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 1);
    encoding.writeVarString(encoderPeerIdBc, room.peerId);
    await broadcastBcMessage(room, encoding.toUint8Array(encoderPeerIdBc));
  }
};

function broadcastStringData(data: string, messageCode: number, originThis: Room) {
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


  constructor(public doc: Y.Doc, public provider: WebrtcProvider, public name: string, public key: CryptoKey | null) {
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

    this.provider.on("clientRequest", async (port: number, data: string) => {
      console.log("clientRequest", port, data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTypes.TunneledRequest);
      encoding.writeUint16(encoder, port);
      encoding.writeVarString(encoder, data);
      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    this.provider.on("serverResponse", async (port: number, data: string) => {
      console.log("serverResponse", port, data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTypes.TunneledResponse);
      encoding.writeUint16(encoder, port);
      encoding.writeVarString(encoder, data);
      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    this.provider.on("startSharingPort", async (data: number) => {
      console.log("startSharingPort", data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTypes.SharePort);
      encoding.writeUint16(encoder, data);
      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    this.provider.on("runDockerRemote", async (data: string) => {
      console.log("runDockerRemote", data);
      broadcastStringData(data, messageTypes.RunDocker, this);
    });
    this.provider.on("terminalOutData", async (data: string) => {
      console.log("terminalOutData", data);
      broadcastStringData(data, messageTypes.TerminalOutData, this);
    });
    this.provider.on("startPeerTerminal", async (data: string) => {
      console.log("startPeerTerminal", data);
      broadcastStringData(data, messageTypes.StartPeerTerminal, this);
    });
    this.provider.on("terminalCommand", async (data: string) => {
      console.log("terminalCommand", data);
      broadcastStringData(data, messageTypes.TerminalCommand, this);
    });

    process.on("exit", this.beforeUnloadHandler);
  }

  async connect() {
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
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
        this.doc.clientID,
      ])
    );
    await broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessState));
  }

  async disconnect() {
    // signal through all available signaling connections
    signalingConns.forEach((conn) => {
      if (conn.connected) {
        conn.send({ type: "unsubscribe", topics: [this.name] });
      }
    });
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      "disconnect"
    );
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
    this.webrtcConns.forEach((conn) => conn.destroy());
  }

  async destroy() {
    await this.disconnect();
    process.off("exit", this.beforeUnloadHandler);
  }

  private async bcSubscriber(data: ArrayBuffer) {
    await cryptoutils.decrypt(new Uint8Array(data), this.key).then((m: Uint8Array) =>
      this.mux(async () => {
        const reply = await readMessage(this, m, () => {
          // console.log("read message _bcSubscriber");
        });
        if (reply) {
          await broadcastBcMessage(this, encoding.toUint8Array(reply));
        }
      }, undefined)
    );
  }

  /**
  * Listens to Yjs updates and sends them to remote peers
  *
  */
  private async docUpdateHandler(update: Uint8Array) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageTypes.Sync);
    syncProtocol.writeUpdate(encoder, update);
    await broadcastRoomMessage(this, encoding.toUint8Array(encoder));
  }

  /**
   * Listens to Awareness updates and sends them to remote peers
   *
   */
  private awarenessUpdateHandler = async ({ added, updated, removed }: { added: Array<number>; updated: Array<number>; removed: Array<number> }) => {
    const changedClients = added.concat(updated).concat(removed);
    const encoderAwareness = encoding.createEncoder();
    encoding.writeVarUint(encoderAwareness, messageTypes.Awareness);
    encoding.writeVarUint8Array(
      encoderAwareness,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
    );
    await broadcastRoomMessage(this, encoding.toUint8Array(encoderAwareness));
  };

  private beforeUnloadHandler() {
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      "window unload"
    );
    rooms.forEach(async (room) => {
      await room.disconnect();
    });
  }
}


const openRoom = (doc: Y.Doc, provider: WebrtcProvider, name: string, key: CryptoKey | null): Room => {
  // there must only be one room
  if (rooms.has(name)) {
    throw error.create(`A Yjs Doc connected to room "${name}" already exists!`);
  }
  const room = new Room(doc, provider, name, key);
  rooms.set(name, room);
  return room;
};

const publishSignalingMessage = async (conn: SignalingConn, room: Room, data: any) => {
  if (room.key) {
    await cryptoutils.encryptJson(data, room.key).then((data1) => {
      conn.send({
        type: "publish",
        topic: room.name,
        data: buffer.toBase64(data1),
      });
    });
  } else {
    conn.send({ type: "publish", topic: room.name, data });
  }
};

export class SignalingConn extends ws.WebsocketClient {
  providers = new Set<WebrtcProvider>();
  constructor(url: string) {
    super(url);

    this.on("connect", () => {
      log(`connected (${url})`);
      const topics = Array.from(rooms.keys());
      this.send({ type: "subscribe", topics });
      rooms.forEach((room) =>
        publishSignalingMessage(this, room, {
          type: "announce",
          from: room.peerId,
        })
      );
    });
    this.on("message", async (m: any) => {
      switch (m.type) {
        case "publish": {
          // console.log("on message publish", JSON.stringify(m));
          const roomName = m.topic;
          const room = rooms.get(roomName);
          if (!room || typeof roomName !== "string") {
            return;
          }
          const execMessage = (data: any) => {
            const webrtcConns = room.webrtcConns;
            const peerId = room.peerId;
            if (
              !data || data.from === peerId ||
              (data.to !== undefined && data.to !== peerId) ||
              room.bcConns.has(data.from)
            ) {
              // ignore messages that are not addressed to this conn, or from clients that are connected via broadcastchannel
              return;
            }
            const emitPeerChange = webrtcConns.has(data.from)
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
                if (webrtcConns.size < room.provider.maxConns) {
                  map.setIfUndefined(
                    webrtcConns,
                    data.from,
                    () => new WebrtcConn(this, true, data.from, room)
                  );
                  emitPeerChange();
                }
                break;
              case "signal":
                if (data.to === peerId) {
                  console.log("signal", data, peerId);
                  map
                    .setIfUndefined(
                      webrtcConns,
                      data.from,
                      () => new WebrtcConn(this, false, data.from, room)
                    )
                    .peer.signal(data.signal);
                  emitPeerChange();
                }
                break;
            }
          };
          if (room.key) {
            if (typeof m.data === "string") {
              await cryptoutils
                .decryptJson(buffer.fromBase64(m.data), room.key)
                .then(execMessage);
            }
          } else {
            execMessage(m.data);
          }
          break;
        }
        case "pong": {
          // console.log("on message pong");
          break;
        }
        default: {
          console.warn(`unknown message type ${m.type}`, JSON.stringify(m));
          break;
        }
      }
    });
    this.on("disconnect", () => log(`disconnect (${url})`));
  }
}

export class WebrtcProvider extends Observable<string> {

  awareness: Awareness;
  maxConns: number;
  filterBcConns: boolean;
  shouldConnect: boolean;
  signalingConns: SignalingConn[];
  peerOpts: Peer.Options;
  key: CryptoKey | null = null;
  room: Room | null = null;

  constructor(
    public roomName: string,
    public doc: Y.Doc,
    public signalingUrls: string[],
    public isOwner: boolean,
    private password: string | null = null
  ) {
    super();
    this.filterBcConns = true;
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.shouldConnect = false;
    this.signalingConns = [];
    this.maxConns = MAX_CONNECTIONS;
    this.peerOpts = {
      wrtc: require("@roamhq/wrtc"),
      config: {
        iceServers: ICE_SERVERS
      }
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

  async connect() {
    if (this.password) {
      this.key = await cryptoutils.deriveKey(this.password, this.roomName);
    }

    this.room = openRoom(this.doc, this, this.roomName, this.key);

    this.shouldConnect = true;
    this.signalingUrls.forEach((url) => {
      const signalingConn = map.setIfUndefined(
        signalingConns,
        url,
        () => new SignalingConn(url)
      );
      this.signalingConns.push(signalingConn);
      signalingConn.providers.add(this);
    });
    if (this.room) {
      await this.room.connect();
    }
  }

  async disconnect() {
    this.shouldConnect = false;
    this.signalingConns.forEach((conn) => {
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

  async destroy() {
    this.doc.off("destroy", this.destroy);
    // need to wait for key before deleting room
    // this.key.then(() => {
    await this.room?.destroy();
    rooms.delete(this.roomName);
    // });
    super.destroy();
  }
}

