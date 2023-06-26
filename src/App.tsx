import React, { Component } from "react";
import { withStyles } from "@material-ui/core/styles";

import Content from "./Content";
import Header from "./Header";

import mqtt from "mqtt/dist/mqtt";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import {
  createStorageKeys,
  generateKeyPair,
  getNetworkApi,
  getPeaqKeyPair,
  makePalletQuery,
} from "./utils";
import { generateDidDocument } from "./generate-did";
import { networks } from "./constants";
import { toast } from "react-toastify";
import pkg from "peaq-did-proto-js";
import { hexToU8a } from "@polkadot/util";
const { Document } = pkg;

const styles = (theme: any) => ({
  root: {
    flexGrow: 1,
  },
});

const seed =
  "put impulse gadget fence humble soup mother card yard renew chat quiz";
const name = "bosch-peaq";

const sendTransaction = async (extrinsic: any, type: "did" | "storage", nonce: any) => {
  const hash = await extrinsic.signAndSend(
    getPeaqKeyPair(),
    { nonce },
    (result: any) => {
      console.log(`Current status is ${result.status}`);
    }
  );
  toast.info(
    <>
      Success! Click
      <a
        href={`https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fwsspc1-qa.agung.peaq.network#/extrinsics/decode/${extrinsic.toHex()}`}
        target="_blank"
        rel="noreferrer"
      >
        {" "}
        here{" "}
      </a>
      to see {type} transaction
    </>,
    {
      // 25 seconds
      autoClose: 10000,
    }
  );
  console.log("txhash", hash);
  return hash;
};

const callDIDPallet = async (didDocumentHash: any, address: string) => {
  try {
    const api = await getNetworkApi(networks.PEAQ);

    const onChainNonce: any = (
      await api.rpc.system.accountNextIndex(getPeaqKeyPair().address)
    ).toBn();

    const extrinsic = api.tx.peaqDid.addAttribute(
      address,
      name,
      didDocumentHash,
      ""
    );

    const hash = sendTransaction(extrinsic, "did", onChainNonce);
    return hash;
  } catch (error) {
    console.log("Error storing DID on chain", error);
  }
};

export const callStoragePallet = async (
  itemType: string,
  value: string,
  action: "addItem" | "updateItem"
) => {
  try {
    const api = await getNetworkApi(networks.PEAQ);

    const onChainNonce: any = (
      await api.rpc.system.accountNextIndex(getPeaqKeyPair().address)
    ).toBn();

    const extrinsic = api.tx.peaqStorage[action](itemType, value);

    const hash = sendTransaction(extrinsic, "storage", onChainNonce);
    return hash;
  } catch (error) {
    console.error("Error storing data on chain", error);
  }
};

export const getDIDDocument = async (address: string) => {
  await cryptoWaitReady();

  const keyPair = generateKeyPair(seed);
  const { hashed_key } = createStorageKeys([
    {
      value: address || keyPair.address,
      type: 0,
    },
    { value: name, type: 1 },
  ]);

  const did: any = await makePalletQuery("peaqDid", "attributeStore", [
    hashed_key,
  ]);
  const doc = Document.deserializeBinary(hexToU8a(did.value));

  const didDocument = doc.toObject();
  console.log("DID Document", didDocument);
  return didDocument;
};

export const getStorage = async (itemType: string) => {
  const peaqAddress = getPeaqKeyPair().address;

  const { hashed_key } = createStorageKeys([
    { value: peaqAddress, type: 0 },
    { value: itemType, type: 1 },
  ]);

  const checkIfExists = await makePalletQuery("peaqStorage", "itemStore", [
    hashed_key,
  ]);
  return checkIfExists;
};

class App extends Component<
  {},
  {
    data?: any;
    temperatures?: any;
    humidities?: any;
    pressures?: any;
    lights?: any;
    timeStamps?: {
      didCheck?: number;
      dataUpdate?: number;
    };
  }
> {
  client: any = null;
  constructor(props: any) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
    this.client.on("connect", () => {
      console.log("connected");
      this.client.subscribe("peaqtelemetry");
      this.client.subscribe("deviceID");
    });
    this.client.on("message", (topic: any, message: string) => {
      console.log("topic", topic, message.toString());
      if (topic === "peaqtelemetry") {
        this.handleJsonMessage(JSON.parse(message.toString()));
      }

      if (topic === "deviceID") {
        const data = JSON.parse(message.toString());

        this.setState({
          data: { ...this.state.data, deviceID: data?.deviceID },
          timeStamps: { ...this.state.timeStamps, didCheck: Date.now() },
        });
        this.handleDid(data.deviceID);
      }
    });
  }

  handleJsonMessage = (json: any) => {
    const state: any = { ...this.state };
    const temperature = json.temperature || state.data?.temperature || 0;
    const humidity = json.humidity || state.data?.humidity || 0;
    const lux = json.lux || state.data?.lux || 0;
    const pressure = json.pressure || state.data?.pressure || 0;

    const temperatures = state.temperatures || [];
    const humidities = state.humidities || [];
    const lights = state.lights || [];
    const pressures = state.pressures || [];
    const time = Date.now();
    temperatures.push([time, json.temperature || 0]);
    humidities.push([time, json.humidity || 0]);
    lights.push([time, json.lux || 0]);
    pressures.push([time, json.pressure || 0]);

    this.storeDataOnChain(json?.deviceID, {
      temperature,
      humidity,
      lux,
      pressure,
    });

    this.setState({
      data: {
        temperature,
        humidity,
        lux,
        pressure,
        deviceID: json.deviceID || state.deviceID,
      },
      temperatures,
      humidities,
      pressures,
      lights,
    });
  };

  handleDid = async (deviceID: string) => {
    if (this.state.timeStamps?.didCheck) {
      const now = Date.now();
      const diff = now - +this.state.timeStamps?.didCheck;
      // Check if 1 minute has passed
      if (diff < 120000) {
        // toast.info('DID already checked');
        return;
      }
    }

    if (!deviceID) {
      toast.error("No device ID provided");
      return;
    }

    await cryptoWaitReady();

    const checkDID: any = await getDIDDocument(deviceID);
    if (checkDID && checkDID?.id) {
      toast.info("DID already stored on chain");
      return;
    }

    const pair = generateKeyPair(seed);

    const did = generateDidDocument(pair.address, deviceID);

    toast.promise(callDIDPallet(did, deviceID), {
      pending: "Storing DID on chain...",
      success: "DID stored on chain",
      error: "Error storing DID on chain",
    });
  };

  storeDataOnChain = async (deviceID: string, data: any) => {
    if (this.state.timeStamps?.dataUpdate) {
      const now = Date.now();
      const diff = now - +this.state.timeStamps?.dataUpdate;
      // Check if 30 has passed
      if (diff < 60000) {
        // toast.info('Data already stored');
        return;
      }
    }
    this.setState({
      timeStamps: { ...this.state.timeStamps, dataUpdate: Date.now() },
    });

    if (!deviceID) {
      toast.error("No device ID provided");
      return;
    }

    await cryptoWaitReady();
    const checkData: any = await getStorage(`xdk-${deviceID}`);
    if (checkData) {
      const updateData = callStoragePallet(
        `xdk-${deviceID}`,
        JSON.stringify(data),
        "updateItem"
      );
      toast.promise(updateData, {
        pending: "Updating device data on chain...",
        success: "Device data updated on chain",
        error: "Error updating device data on chain",
      });
    } else {
      const addData = callStoragePallet(
        `xdk-${deviceID}`,
        JSON.stringify(data),
        "addItem"
      );
      toast.promise(addData, {
        pending: "Storing device data on chain...",
        success: "Device data stored on chain",
        error: "Error storing device data on chain",
      });
    }
  };

  componentWillUnmount() {
    if (this.client) {
      this.client.end();
    }
  }

  render() {
    const { classes } = this.props as any;
    const data = this.state.data || {};
    const temperatures = this.state.temperatures || [];
    const humidities = this.state.humidities || [];
    const lights = this.state.lights || [];
    const pressures = this.state.pressures || [];
    return (
      <div className={classes.root}>
        <Header data={data} />
        <Content
          temperatures={temperatures}
          lights={lights}
          pressures={pressures}
          humidities={humidities}
        />
      </div>
    );
  }
}
export default withStyles(styles)(App);
