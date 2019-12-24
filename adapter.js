/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const noble = require('@abandonware/noble');

const {
  Adapter,
  Device,
  Property
} = require('gateway-addon');

class BlueMaestroTempoDisk extends Device {
  constructor(adapter, manifest, id) {
    super(adapter, `${BlueMaestroTempoDisk.name}-${id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor'];
    this.name = manifest.display_name;
    this.description = manifest.description;

    this.addProperty({
      type: 'number',
      '@type': 'TemperatureProperty',
      minimum: -127.99,
      maximum: 127.99,
      multipleOf: 0.1,
      unit: 'degree celsius',
      title: 'temperature',
      description: 'The ambient temperature',
      readOnly: true
    });

    this.addProperty({
      type: 'number',
      minimum: 0,
      maximum: 100,
      multipleOf: 0.1,
      unit: '%',
      title: 'humidity',
      description: 'The relative humidity',
      readOnly: true
    });

    this.addProperty({
      type: 'number',
      minimum: -127.99,
      maximum: 127.99,
      multipleOf: 0.1,
      unit: 'degree celsius',
      title: 'dewPoint',
      description: 'The dew point',
      readOnly: true
    });

    this.addProperty({
      type: 'number',
      minimum: 0,
      maximum: 100,
      multipleOf: 1,
      unit: 'percent',
      title: 'battery',
      description: 'The battery level',
      readOnly: true
    });
  }

  addProperty(description) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
  }

  setData(manufacturerData) {
    const parsedData = {
      temperature: manufacturerData.readInt16BE(8) / 10.0,
      humidity: manufacturerData.readInt16BE(10) / 10.0,
      dewPoint: manufacturerData.readInt16BE(12) / 10.0,
      battery: manufacturerData.readUInt8(3)
    };

    const tempProperty = this.properties.get('temperature');
    tempProperty.setCachedValue(parsedData.temperature);
    this.notifyPropertyChanged(tempProperty);

    const humiProperty = this.properties.get('humidity');
    humiProperty.setCachedValue(parsedData.humidity);
    this.notifyPropertyChanged(humiProperty);

    const dewPointProperty = this.properties.get('dewPoint');
    dewPointProperty.setCachedValue(parsedData.dewPoint);
    this.notifyPropertyChanged(dewPointProperty);

    const batteryProperty = this.properties.get('battery');
    batteryProperty.setCachedValue(parsedData.battery);
    this.notifyPropertyChanged(batteryProperty);
  }
}

class BlueMaestroTempoDiskAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, BlueMaestroTempoDiskAdapter.name, manifest.name);
    this.pollInterval = manifest.moziot.config.pollInterval;
    this.knownDevices = {};
    addonManager.addAdapter(this);

    noble.on('stateChange', (state) => {
      console.log('Noble adapter is %s', state);

      if (state === 'poweredOn') {
        console.log('Start scanning for devices');
        noble.startScanning([], true);
      }
    });

    noble.on('discover', (peripheral) => {
      const manufacturerData = peripheral.advertisement.manufacturerData;

      //                                                            v TODO
      if (manufacturerData && manufacturerData.readUInt16LE(0) === 0x0133) {
        if(manufacturerData.length === 41) {
          const id = peripheral.id;
          let knownDevice = this.knownDevices[id];

          if (!knownDevice) {
            console.log(`Detected new BlueMaestro Tempo Disk with id ${id}`);
            knownDevice = new BlueMaestroTempoDisk(this, manifest, id);
            this.handleDeviceAdded(knownDevice);
            this.knownDevices[id] = knownDevice;
          }

          knownDevice.setData(manufacturerData);
        } else {
            console.log(manufacturerData.length)
        }
      }
    })
  }
}

module.exports = BlueMaestroTempoDiskAdapter;
