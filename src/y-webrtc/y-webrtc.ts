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
import * as math from "lib0/math";
import { createMutex } from "lib0/mutex";

import * as Y from "yjs";
import * as Peer from "simple-peer";

import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { Awareness } from "y-protocols/awareness";
import * as cryptoutils from "./crypto";
import { CryptoKey } from "@peculiar/webcrypto";

const log = logging.createModuleLogger("y-webrtc");

const messageSync = 0;
const messageQueryAwareness = 3;
const messageAwareness = 1;
const messageBcPeerId = 4;
const messageTunneledRequest = 5;
const messageTunneledResponse = 6;

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

type callBack = () => void;

const readMessage = (room: Room, buf: Uint8Array, syncedCallback: callBack): encoding.Encoder | null => {
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
    case messageTunneledRequest: {
      console.log("messageTunneledRequest");
      room.provider.emit("tunneledClientRequest",[decoding.readVarString(decoder)]);
      break;
    }
    case messageTunneledResponse: {
      console.log("messageTunneledResponse");
      room.provider.emit("tunneledServerResponse", [decoding.readVarString(decoder)]);
      break;
    }
    case messageSync: {
      encoding.writeVarUint(encoder, messageSync);
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
    case messageQueryAwareness:
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awareness.getStates().keys())
        )
      );
      sendReply = true;
      break;
    case messageAwareness:
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        room
      );
      break;
    case messageBcPeerId: {
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
        broadcastBcPeerId(room);
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

const readPeerMessage = (peerConn: WebrtcConn, buf: Uint8Array): encoding.Encoder | null => {
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
    this.peer.on("signal", (signal) => {
      log("WebrtcConn signal ", logging.BOLD, remotePeerId);
      publishSignalingMessage(signalingConn, room, {
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
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, doc);
      sendWebrtcConn(this, encoder);
      const awarenessStates = awareness.getStates();
      if (awarenessStates.size > 0) {
        encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
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
    this.peer.on("data", (data) => {
      const answer = readPeerMessage(this, data);
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
  signalingConns.forEach((conn) => {
    // only subscribe if connection is established, otherwise the conn automatically subscribes to all rooms
    if (conn.connected) {
      conn.send({ type: "subscribe", topics: [room.name] });
      if (room.webrtcConns.size < room.provider.maxConns) {
        publishSignalingMessage(conn, room, {
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
    encoding.writeVarUint(encoderPeerIdBc, messageBcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 1);
    encoding.writeVarString(encoderPeerIdBc, room.peerId);
    await broadcastBcMessage(room, encoding.toUint8Array(encoderPeerIdBc));
  }
};

export class Room {
  peerId: string;
  awareness: Awareness;
  synced: boolean;
  webrtcConns: Map<string, WebrtcConn>;
  bcConns: Set<string>;
  mux: (a: callBack, b: callBack | undefined) => void;
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

    this.provider.on("clientRequest", async (data: string) => {
      console.log("clientRequest", data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTunneledRequest);
      encoding.writeVarString(encoder,data);
      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    this.provider.on("serverResponse", async (data: string) => {
      console.log("serverResponse", data);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageTunneledResponse);
      encoding.writeVarString(encoder, data);

      broadcastWebrtcConn(this, encoding.toUint8Array(encoder));
    });

    process.on("exit", this.beforeUnloadHandler);
  }

  connect() {
    this.doc.on("update", this.docUpdateHandler.bind(this));
    this.awareness.on("update", this.awarenessUpdateHandler.bind(this));
    // signal through all available signaling connections
    announceSignalingInfo(this);
    bc.subscribe(this.name, this.bcSubscriber);
    this.bcconnected = true;
    // broadcast peerId via broadcastchannel
    broadcastBcPeerId(this);
    // write sync step 1
    const encoderSync = encoding.createEncoder();
    encoding.writeVarUint(encoderSync, messageSync);
    syncProtocol.writeSyncStep1(encoderSync, this.doc);
    broadcastBcMessage(this, encoding.toUint8Array(encoderSync));
    // broadcast local state
    const encoderState = encoding.createEncoder();
    encoding.writeVarUint(encoderState, messageSync);
    syncProtocol.writeSyncStep2(encoderState, this.doc);
    broadcastBcMessage(this, encoding.toUint8Array(encoderState));
    // write queryAwareness
    const encoderAwarenessQuery = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessQuery, messageQueryAwareness);
    broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessQuery));
    // broadcast local awareness state
    const encoderAwarenessState = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessState, messageAwareness);
    encoding.writeVarUint8Array(
      encoderAwarenessState,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
        this.doc.clientID,
      ])
    );
    broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessState));
  }

  disconnect() {
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
    encoding.writeVarUint(encoderPeerIdBc, messageBcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 0); // remove peerId from other bc peers
    encoding.writeVarString(encoderPeerIdBc, this.peerId);
    broadcastBcMessage(this, encoding.toUint8Array(encoderPeerIdBc));

    bc.unsubscribe(this.name, this.bcSubscriber);
    this.bcconnected = false;
    this.doc.off("update", this.docUpdateHandler.bind(this));
    this.awareness.off("update", this.awarenessUpdateHandler.bind(this));
    this.webrtcConns.forEach((conn) => conn.destroy());
  }

  destroy() {
    this.disconnect();
    process.off("exit", this.beforeUnloadHandler);
  }

  private bcSubscriber(data: ArrayBuffer) {
    cryptoutils.decrypt(new Uint8Array(data), this.key).then((m: Uint8Array) =>
      this.mux(async () => {
        const reply = readMessage(this, m, () => {
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
  private docUpdateHandler(update: Uint8Array) {
    console.log("docUpdateHandler:", messageSync);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    broadcastRoomMessage(this, encoding.toUint8Array(encoder));
  }

  /**
   * Listens to Awareness updates and sends them to remote peers
   *
   */
  private awarenessUpdateHandler = ({ added, updated, removed }: { added: any; updated: any; removed: any; }, _origin: any) => {
    // console.log("_awarenessUpdateHandler origin", _origin, this);
    const changedClients = added.concat(updated).concat(removed);
    const encoderAwareness = encoding.createEncoder();
    encoding.writeVarUint(encoderAwareness, messageAwareness);
    encoding.writeVarUint8Array(
      encoderAwareness,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
    );
    broadcastRoomMessage(this, encoding.toUint8Array(encoderAwareness));
  };

  private beforeUnloadHandler() {
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      "window unload"
    );
    rooms.forEach((room) => {
      room.disconnect();
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

const publishSignalingMessage = (conn: SignalingConn, room: Room, data: any) => {
  if (room.key) {
    cryptoutils.encryptJson(data, room.key).then((data1) => {
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
    this.on("message", (m: any) => {
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
              cryptoutils
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
  // key: PromiseLike<CryptoKey | null>;

  room: Room | null;

  constructor(
    public roomName: string,
    public doc: Y.Doc,
    public signalingUrls: string[],
    public isOwner: boolean
  ) {
    super();
    this.filterBcConns = true;
    this.awareness = new awarenessProtocol.Awareness(doc);
    this.shouldConnect = false;
    this.signalingConns = [];
    this.maxConns = 20 + math.floor(random.rand() * 15);
    this.peerOpts = { wrtc: require("wrtc") };

    this.room = openRoom(doc, this, roomName, null);
    this.connect();
    if (this.shouldConnect) {
      this.room.connect();
    } else {
      this.room.disconnect();
    }

    this.destroy = this.destroy.bind(this);
    doc.on("destroy", this.destroy);
  }

  get connected(): boolean {
    return this.room !== null && this.shouldConnect;
  }

  connect() {
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
      this.room.connect();
    }
  }

  disconnect() {
    this.shouldConnect = false;
    this.signalingConns.forEach((conn) => {
      conn.providers.delete(this);
      if (conn.providers.size === 0) {
        conn.destroy();
        signalingConns.delete(conn.url);
      }
    });
    if (this.room) {
      this.room.disconnect();
    }
  }

  destroy() {
    this.doc.off("destroy", this.destroy);
    // need to wait for key before deleting room
    // this.key.then(() => {
    this.room?.destroy();
    rooms.delete(this.roomName);
    // });
    super.destroy();
  }
}
