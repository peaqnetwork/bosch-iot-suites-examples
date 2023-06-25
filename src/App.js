import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import { Sdk } from "@peaq-network/sdk";

import Content from './Content';
import Header from './Header';

import mqtt from 'mqtt';

const styles = theme => ({
  root: {
    flexGrow: 1,
  }
});

const seed = "put impulse gadget fence humble soup mother card yard renew chat quiz";
const name = "peaq-console";

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      deviceID: '',
    }
  }

  componentDidMount() {
    this.client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt")
    this.client.on("connect", () => {
      console.log("connected");
      this.client.subscribe("telemetry");
      this.client.subscribe("deviceID")
    });
    this.client.on('message', (topic, message) => {
        if (topic === 'telemetry') {
          this.handleJsonMessage(JSON.parse(message.toString()));
          console.log(JSON.parse(message.toString()));
        }
        if (topic === 'deviceID') {
          this.setState({ deviceID: message.toString() })
          this.handleDid();
        }
    })
  }

  handleJsonMessage = (json) => {
    const temperatures = this.state.temperatures || []
    const humidities = this.state.humidities || []
    const lights = this.state.lights || []
    const pressures = this.state.pressures || []
    const time = Date.now();
    temperatures.push([time, json.temperature || 0])
    humidities.push([time, json.humidity || 0])
    lights.push([time, json.lux || 0])
    pressures.push([time, json.pressure || 0])
    this.setState({
      data: { ...json },
      deviceID: json.deviceID,
      temperatures,
      humidities,
      pressures,
      lights
    })
  }

  handleDid = async () => {
    const sdkInstance = await Sdk.createInstance({ baseUrl: "wss://wsspc1-qa.agung.peaq.network", seed });
    const didRead = await sdkInstance.did.read({ name, address: this.state.deviceID });
    if (!didRead) {
      const did = await sdkInstance.did.create({ name, address: this.state.deviceID });
      did.unsubscribe();
    }
    sdkInstance.disconnect();
  };

  storeDataOnChain = async () => {

  };

  componentWillUnmount() {
    if (this.client) {
      this.client.end()
    }
  }

  render() {
    const { classes } = this.props;
    const data = this.state.data || {}
    const temperatures = this.state.temperatures || []
    const humidities = this.state.humidities || []
    const lights = this.state.lights || []
    const pressures = this.state.pressures || []
    return (
      <div className={classes.root}>
        <Header data={data} />
        <Content temperatures={temperatures}
          lights={lights}
          pressures={pressures}
          humidities={humidities} />
      </div>
    );
  }
}
export default withStyles(styles)(App);
