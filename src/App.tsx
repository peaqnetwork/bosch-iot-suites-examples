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

// let toas

const seed =
  "put impulse gadget fence humble soup mother card yard renew chat quiz";
const name = "bosch-peaq";

const callDIDPallet = async (
  pair: any,
  didDocumentHash: any,
  address: string
) => {
  try {
    const api = await getNetworkApi(networks.PEAQ);

    const extrinsic = api.tx.peaqDid.addAttribute(
      address,
      name,
      didDocumentHash,
      ""
    );
    const hash = await extrinsic.signAndSend(
      pair,
      { nonce: -1 },
      (result: any) => {
        console.log(
          "===await SUB_API.tx.peaqDid.addAttribute==result===",
          result
        );
        // Show toast on status change and stop at inBlock status
        toast.info(`Current status: ${result.status.type}`, {
          toastId: "didStatus",
          autoClose: false,
        });

        if (result.status.isInBlock) {
          toast.update("didStatus", {
            render: (
              <>
                Success! Click
                <a
                  href={`https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fwsspc1-qa.agung.peaq.network#/extrinsics/decode/${extrinsic.toHex()}`}
                >
                  here{" "}
                </a>
                to see the transaction
              </>
            ),
            type: toast.TYPE.SUCCESS,
            autoClose: false,
          });
        }
      }
    );
    console.log("===await SUB_API.tx.peaqDid.addAttribute==hash===", hash);
    return hash;
  } catch (error) {
    console.log("===await SUB_API.tx.peaqDid.addAttribute==error===", error);
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

class App extends Component<
  {},
  {
    deviceID: string;
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
    this.state = {
      deviceID: "",
    };
  }

  componentDidMount() {
    this.client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
    this.client.on("connect", () => {
      console.log("connected");
      this.client.subscribe("peaqtelemetry");
      this.client.subscribe("deviceID");
    });
    this.client.on("message", (topic: any, message: string) => {
      if (topic === "peaqtelemetry") {
        console.log("telemetry", message.toString());
        this.handleJsonMessage(JSON.parse(message.toString()));
      }
      console.log("topic", topic);

      if (topic === "deviceID") {
        const deviceID = message.toString();
        console.log("deviceID", deviceID);

        this.setState({
          deviceID,
          timeStamps: { ...this.state.timeStamps, didCheck: Date.now() },
        });
        this.handleDid(deviceID);
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

    this.setState({
      data: { temperature, humidity, lux, pressure },
      deviceID: json.deviceID,
      temperatures,
      humidities,
      pressures,
      lights,
    });
  };

  handleDid = async (deviceID: string) => {
    if (!deviceID) {
      toast.error("No device ID provided");
      return;
    }
    if (this.state.timeStamps?.didCheck) {
      const now = Date.now();
      const diff = now - +this.state.timeStamps?.didCheck;
      // Check if 1 minute has passed
      if (diff < 60000) {
        // toast.info('DID already checked');
        return;
      }
    }

    await cryptoWaitReady();

    const checkDID: any = await getDIDDocument(deviceID);
    if (checkDID && checkDID?.id) {
      toast.info("DID already stored on chain");
      return;
    }

    const pair = generateKeyPair(seed);

    const did = generateDidDocument(pair.address, deviceID);

    toast.promise(callDIDPallet(pair, did, deviceID), {
      pending: "Storing DID on chain...",
      success: "DID stored on chain",
      error: "Error storing DID on chain",
    });
  };

  storeDataOnChain = async () => {};

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
