// import didProto from "peaq-did-proto-js";
import { u8aToHex } from "@polkadot/util";
import { v4 as uuidv4 } from "uuid";
import { getPeaqKeyPair } from "./utils";

import didProto from 'peaq-did-proto-js';

const {
  Document,
  VerificationMethod,
  VerificationType,
  Signature,
} = didProto;
const getDidString = (address: any) => `did:peaq:${address}`;

const createVerificationMethod = (address: any) => {
  const id = uuidv4();
  const verificationMethod = new VerificationMethod();

  verificationMethod.setId(id);
  verificationMethod.setType(VerificationType.ED25519VERIFICATIONKEY2020);
  verificationMethod.setController(getDidString(address));
  verificationMethod.setPublickeymultibase(`z${address}`);

  return { verificationMethod, verificationId: id };
};

const createSignature = (address: any) => {
  const peaqKeyPair = getPeaqKeyPair();
  const signed = peaqKeyPair.sign(address);
  const signature = new Signature();

  signature.setType(VerificationType.ED25519VERIFICATIONKEY2020);
  signature.setIssuer(peaqKeyPair.address);
  signature.setHash(u8aToHex(signed));

  return signature;
};

export const generateDidDocument = (controllerAddress: any, userAddress: any) => {
  const document = new Document();
  document.setId(getDidString(userAddress));
  document.setController(getDidString(controllerAddress));

  const { verificationId, verificationMethod } =
    createVerificationMethod(userAddress);
  document.addVerificationmethods(verificationMethod);

  const signature = createSignature(userAddress);
  document.setSignature(signature);
  document.addAuthentications(verificationId);
  const bytes = document.serializeBinary();
  return u8aToHex(bytes);
};
