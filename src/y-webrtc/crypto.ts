import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as string from "lib0/string";
import { Crypto, CryptoKey } from "@peculiar/webcrypto";

const crypto = new Crypto();

export const deriveKey = async (secret: string, roomName: string): Promise<CryptoKey> => {
  const secretBuffer = string.encodeUtf8(secret).buffer;
  const salt = string.encodeUtf8(roomName).buffer;
  const keyMaterial = await crypto.subtle.importKey("raw", secretBuffer, "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
};

export const encrypt = async (data: Uint8Array, key: CryptoKey | null): Promise<Uint8Array> => {
  if (!key) {
    return Promise.resolve(data);
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    data,
  );
  const encryptedDataEncoder = encoding.createEncoder();
  encoding.writeVarString(encryptedDataEncoder, "AES-GCM");
  encoding.writeVarUint8Array(encryptedDataEncoder, iv);
  encoding.writeVarUint8Array(encryptedDataEncoder, new Uint8Array(cipher));
  return encoding.toUint8Array(encryptedDataEncoder);
};

export type EncryptTypes =
  | undefined
  | null
  | number
  | bigint
  | boolean
  | string
  | {
      [x: string]: any;
    }
  | Array<any>
  | Uint8Array;

export const encryptJson = (data: EncryptTypes, key: CryptoKey | null): PromiseLike<Uint8Array> => {
  const dataEncoder = encoding.createEncoder();
  encoding.writeAny(dataEncoder, data);
  return encrypt(encoding.toUint8Array(dataEncoder), key);
};

export const decrypt = async (data: Uint8Array, key: CryptoKey | null): Promise<Uint8Array> => {
  if (!key) {
    return Promise.resolve(data);
  }
  const dataDecoder = decoding.createDecoder(data);
  const algorithm = decoding.readVarString(dataDecoder);
  if (algorithm !== "AES-GCM") {
    return Promise.reject(new Error("Unknown encryption algorithm"));
  }
  const iv = decoding.readVarUint8Array(dataDecoder);
  const cipher = decoding.readVarUint8Array(dataDecoder);
  const data1 = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    cipher,
  );
  return new Uint8Array(data1);
};

export const decryptJson = (data: Uint8Array, key: CryptoKey | null): Promise<Uint8Array> =>
  decrypt(data, key).then(decryptedValue =>
    decoding.readAny(decoding.createDecoder(new Uint8Array(decryptedValue))),
  );
