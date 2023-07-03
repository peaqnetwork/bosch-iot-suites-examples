import { Keyring, decodeAddress } from "@polkadot/keyring";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { PEAQ_MNEMONIC, networks } from "./constants";
import { u8aConcat, u8aToU8a } from "@polkadot/util";
import { blake2AsHex } from "@polkadot/util-crypto";
import { KeyringPair } from "@polkadot/keyring/types";

declare global {
  interface Window {
    PEAQ: ApiPromise;
  }
}

let peaqKeyPair: any = null;
const peaqMnemonic = PEAQ_MNEMONIC;

export const generateKeyPair = (mnemonic:any) => {
  const keyring = new Keyring({ type: "sr25519" });
  const pair = keyring.addFromUri(mnemonic);
  return pair;
};

export const getPeaqKeyPair = (): KeyringPair => {
  if (peaqKeyPair) return peaqKeyPair;
  const keyPair = new Keyring({ type: "sr25519" }).addFromUri(peaqMnemonic);
  peaqKeyPair = keyPair;
  return keyPair;
};

export const getNetworkApi = async (network: any) => {
  try {
    if (window.PEAQ) return window.PEAQ;
    const api = new ApiPromise({
      provider: new WsProvider(network.ws),
    });
    await api.isReadyOrError;
    window.PEAQ = api;
    return api;
  } catch (error) {
    console.error("getNetworkApi error", error);
    throw error;
  }
};

export const makePalletQuery = async (
  palletName:string,
  storeName: string,
  args: any,
  ) => {
    try {
      const api = await getNetworkApi(networks.PEAQ);
      const data = await api.query[palletName][storeName](...args);
      api.disconnect();
      return data.toHuman();
    } catch (error) {
      console.error(`Error ${makePalletQuery.name} - `, error);
      return error;
    }
};

export const createStorageKeys = (args: any) => {
  // console.log("args", args);
  // decode address to byte array
  const keysByteArray = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].type === 0) {
      const decoded_address = decodeAddress(args[i].value, false, 42);
      keysByteArray.push(decoded_address);
    }
    if (args[i].type === 1) {
      const hash_name = u8aToU8a(args[i].value);
      keysByteArray.push(hash_name);
    }
  }
  const key = u8aConcat(...keysByteArray);
  // encode the key using blake2b
  const hashed_key = blake2AsHex(key, 256);
  console.log("hashed_key", hashed_key);
  return { hashed_key };
};
