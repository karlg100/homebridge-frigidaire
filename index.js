'use strict';

var debug = require('debug')('frigidaire:homebridge');
var Frigidaire = require('frigidaire');

var Service, Characteristic;

function fahrenheitToCelsius(temperature) {
  return (temperature - 32) / 1.8;
}

function celsiusToFahrenheit(temperature) {
  return (temperature * 1.8) + 32;
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;

  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform("homebridge-frigidaire", "Frigidaire", FrigidairePlatform, false);
};

function FrigidairePlatform(log, config) {
  this.log = debug;

  this.config = config;

  this.pollingInterval = this.config.pollingInterval || 10000;
  this.cleanAirEnable = this.config.cleanAirEnable || false;

  this.AC = new Frigidaire({
    username: this.config.username,
    password: this.config.password,
    pollingInterval: this.pollingInterval,
    applianceSerial: this.config.applianceSerial || null,
    deviceId: this.config.deviceId || null
  });
}

FrigidairePlatform.prototype = {
  accessories: function (callback) {
    var self = this;
    var airConditioners = [];
    if (self.config.applianceSerial) {
      debug("Serial number provided, only setting up one accessory...");
      self.AC.getTelem(self.config.applianceSerial, function (err, result) {
        if (err) {
          console.error(err);
          callback(airConditioners);
        } else {
          debug('Found device specified!');
          var applianceObj = self.AC.getDevice(self.config.applianceSerial);
          //console.log(result);

          console.log('creating accessory for AC unit labeled: ' + applianceObj.nickname + " (" + applianceObj.appliance_id + ")");
          airConditioners.push(new FrigidaireAirConditionerAccessory(applianceObj, self.AC, self.log, self.pollingInterval, self.cleanAirEnable));
  
          callback(airConditioners); 
        }
      });
    } else {
      debug("Autodetecting all devices...");
      self.AC.getDevices(function (err, result) {
        if (err) {
          console.error(err);
          callback(airConditioners);
        }
        debug("Got Device List, setting up each accessory");
        debug(result);
        result.forEach(function(device) {
          console.log('craeting accessory for AC unit labeled : '+device.nickname);
          debug(device);
          airConditioners.push(new FrigidaireAirConditionerAccessory(device, self.AC, self.log, self.pollingInterval, self.cleanAirEnable));
          self.AC.getTelem(device.sn, function (err, result) { });
        });
        debug("calling back airConditioners");
        callback(airConditioners);
      });
    }
  },
};

function FrigidaireAirConditionerAccessory(applianceObj, AC, log, pollingInterval, cleanAirEnable) {
  this.log = log;
  this.AC = AC;
  this.applianceObj = applianceObj;
  this.applianceSn = applianceObj.sn;
  this.pollingInterval = pollingInterval;
  this.cleanAirEnable = cleanAirEnable;
  this.log('Clean Air toggle is set to ' + this.cleanAirEnable);
  this.log('pollingInterval is set to ' + this.pollingInterval);

  // Characteristic.TargetHeatingCoolingState.OFF
  // Characteristic.TargetHeatingCoolingState.HEAT
  // Characteristic.TargetHeatingCoolingState.AUTO
  // Characteristic.TargetHeatingCoolingState.COOL

  //this.currentCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
  this.currentCoolingState = undefined;
  this.targetCoolingState = this.currentHeatingCoolingState;

  this.currentTemperature = undefined;
  this.targetTemperature = this.currentTemperature;

  // Characteristic.TemperatureDisplayUnits.FAHRENHEIT
  // Characteristic.TemperatureDisplayUnits.CELSIUS

  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

  this.fanSpeed = 0;
  this.fanPending = false; // need to change this to a timer, so the last value always gets executed after the current pending value is completed.

  var deviceVersion;
  this.AC.getValue(this.applianceSn, this.AC.VERSION, function(err, result) { deviceVersion = result });
  //this.AC.telem.forEach(item => { if (item.haclCode === '0011') { deviceVersion = item.stringValue } });

  this.applianceId = this.applianceObj.appliance_id;
  this.make = 'Frigidaire';
  this.model = 'AC ' + this.applianceObj.appliance_type;
  this.serialNumber = this.applianceSn;
  this.name = this.applianceObj.nickname;
  this.firmware = deviceVersion;

  //this.AC.scheduleUpdates(this.applianceSn, function () { });
  var self = this;
  this.updateTimer = setInterval(self.updateAll, this.pollingInterval, self);
}

FrigidaireAirConditionerAccessory.prototype = {
  // Start
  identify: function (callback) {
    this.log("Identify requested, but we have no way of doing this!");

    callback(null);
  },

  updateData: function (callback) {
    this.log("updateData");

    callback(null);
  },

  // Required
  getCurrentHeatingCoolingState: function (callback) {
    //this.log("getCurrentHeatingCoolingState: ", this.currentCoolingState);
    //callback(null, this.currentCoolingState);

    var self = this;
    this.log("getCurrentHeatingCoolingState: ", this.currentCoolingState);
    this.AC.getCoolingState(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      if (result == self.AC.COOLINGSTATE_OFF) self.currentCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
      else if (result == self.AC.COOLINGSTATE_ON) self.currentCoolingState = Characteristic.CurrentHeatingCoolingState.COOL;
      self.thermostatService
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .updateValue(self.currentCoolingState);
      self.log("getCurrentHeatingCoolingState: ", self.currentCoolingState);
      callback(null, self.currentCoolingState);
    });
  },


  /* no way to set this with API
    setCurrentHeatingCoolingState: function(value, callback) {
      this.log("setCurrentHeatingCoolingState: ", value);
  
      this.currentCoolingState = value;
      callback(null);
    },
  */

  getCleanAir: function (callback) {
    var self = this;

    this.AC.getCleanAir(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      if (result == self.AC.CLEANAIR_ON) self.cleanAir = Characteristic.On;
      else if (result == self.AC.CLEANAIR_OFF) self.cleanAir = Characteristic.Off;

      //self.log("getCleanAir: ", self.cleanAir);
      callback(null, self.cleanAir);
    });
  },

  setCleanAir: function (value, callback) {
    var self = this;
    if (value == true) var newMode = self.AC.CLEANAIR_ON;
    else if (value == false) var newMode = self.AC.CLEANAIR_OFF;

    this.AC.cleanAir(self.applianceSn, newMode, function (err, result) {
      if (err) return console.error(err);

      self.log("getCleanAir: ", newMode);
      callback(null, self.cleanAir);
    });
  },

  getTargetHeatingCoolingState: function (callback) {
    var self = this;

    this.AC.getMode(self.applianceSn, function (err, result) {
      var oldstate = self.targetCoolingState;
      if (err) return console.error(err);
      if (result == self.AC.MODE_OFF) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
      else if (result == self.AC.MODE_ECON) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
      else if (result == self.AC.MODE_COOL) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
      else if (result == self.AC.MODE_FAN) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;

      if (oldstate === undefined)
        self.thermostatService
          .getCharacteristic(Characteristic.TargetHeatingCoolingState)
          .updateValue(self.targetCoolingState);

      self.log("getTargetHeatingCoolingState: ", self.targetCoolingState);
      callback(null, self.targetCoolingState);
    });

  },

  setTargetHeatingCoolingState: function (value, callback) {
    var self = this;

    if (value == Characteristic.TargetHeatingCoolingState.OFF) var newMode = self.AC.MODE_OFF;
    else if (value == Characteristic.TargetHeatingCoolingState.AUTO) var newMode = self.AC.MODE_ECON;
    else if (value == Characteristic.TargetHeatingCoolingState.COOL) var newMode = self.AC.MODE_COOL;
    else if (value == Characteristic.TargetHeatingCoolingState.HEAT) var newMode = self.AC.MODE_FAN;

    this.AC.mode(self.applianceSn, newMode, function (err, result) {
      if (err) return console.error(err);
      self.log("setTargetHeatingCoolingState from/to: ", self.targetCoolingState, value);
      self.targetCoolingState = value;
      self.thermostatService
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .updateValue(self.targetCoolingState);
      callback(null);
    });
  },

  getCurrentTemperature: function (callback) {
    var self = this;
    if (this.disableTemp) {
      self.thermostatService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(undefined);
      self.currentTemperature = undefined;
      callback(null, undefined);
    }
    this.AC.getRoomTemp(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) self.currentTemperature = fahrenheitToCelsius(result);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS) self.currentTemperature = result;
      self.log("getCurrentTemperature: %s -> %s", result, self.currentTemperature);
      self.thermostatService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(self.currentTemperature);
      callback(null, self.currentTemperature);
    });
  },

  getTargetTemperature: function (callback) {
    var self = this;
    this.AC.getTemp(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      var oldtemp = self.targetTemperature;
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) self.targetTemperature = fahrenheitToCelsius(result);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS) self.targetTemperature = result;
      self.log("getTargetTemperature: %s -> %s", result, self.targetTemperature);

      if (oldtemp === undefined)
        self.thermostatService
          .getCharacteristic(Characteristic.TargetTemperature)
          .updateValue(self.targetTemperature);
      callback(null, self.targetTemperature);
    });
  },

  setTargetTemperature: function (value, callback) {
    var self = this;
    this.AC.setTemp(self.applianceSn, celsiusToFahrenheit(value), function (err, result) {
      if (err) return console.error(err);
      self.targetTemperature = value;
      self.log("setTargetTemperature to: ", value);
      self.thermostatService
        .getCharacteristic(Characteristic.TargetTemperature)
        .updateValue(self.targetTemperature);
      callback(null);
    });
  },

  getTemperatureDisplayUnits: function (callback) {
    var self = this;
    this.AC.getUnit(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      if (result == self.AC.FAHRENHEIT) self.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
      else if (result == self.AC.CELSIUS) self.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
      self.thermostatService
        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .updateValue(self.temperatureDisplayUnits);
      self.log("getTemperatureDisplayUnits: ", self.temperatureDisplayUnits);
      return callback(null, self.temperatureDisplayUnits);
    });
  },

  setTemperatureDisplayUnits: function (value, callback) {
    var self = this;
    if (value == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) var newValue = self.AC.FAHRENHEIT;
    else if (value == Characteristic.TemperatureDisplayUnits.CELSIUS) var newValue = self.AC.CELSIUS;
    this.temperatureDisplayUnits = value;

    self.AC.changeUnits(self.applianceSn, newValue, function (err, result) {
      if (err) return console.error(err);
      self.log("setTemperatureDisplayUnits - %s and %s", self.temperatureDisplayUnits, value);
      return callback(null);
    });
  },

  getFanSpeed: function (callback) {
    var self = this;
    this.AC.getFanMode(self.applianceSn, function (err, result) {
      if (err) return console.error(err);

      var oldfan = self.fanSpeed;

      // we only have 3 fan speeds, plus auto.
      // auto = 100%
      // high = 67-99%
      // med  = 34-66%
      // low  = 0-33%
      // off? = 0% - we may need to add this later, if there's no way to turn off the unit using other controls
      //
      self.log('current fan mode is ' + result);
      if (result == self.AC.FANMODE_AUTO)
        self.fanSpeed = 100;
      else if (result == self.AC.FANMODE_LOW) {
        if (self.fanSpeed > 33) self.fanSpeed = 33;
        if (self.fanSpeed <= 0) self.fanSpeed = 1;
      } else if (result == self.AC.FANMODE_MED) {
        if (self.fanSpeed > 66) self.fanSpeed = 66;
        if (self.fanSpeed <= 33) self.fanSpeed = 34;
      } else if (result == self.AC.FANMODE_HIGH) {
        if (self.fanSpeed >= 100) self.fanSpeed = 99;
        if (self.fanSpeed <= 66) self.fanSpeed = 67;
      }

      self.log("getFanSpeed: ", self.fanSpeed);

      //if (oldfan === undefined)
        self.thermostatService
          .getCharacteristic(Characteristic.RotationSpeed)
          .updateValue(self.fanSpeed);

      callback(null, self.fanSpeed);
    });
  },

  setFanSpeed: function (value, callback) {
    var self = this;
    var newMode;
    //if (this.fanPending)
    //callback(null);
    //else {
    //this.fanPending = true;
    if (value == 100) newMode = this.AC.FANMODE_AUTO;
    else if (value >= 0 && value <= 33) newMode = this.AC.FANMODE_LOW;
    else if (value > 33 && value <= 66) newMode = this.AC.FANMODE_MED;
    else if (value > 66 && value < 100) newMode = this.AC.FANMODE_HIGH;
    this.log('newMode = ' + newMode);
    self.thermostatService
      .getCharacteristic(Characteristic.RotationSpeed)
      .updateValue(self.fanSpeed);

    this.AC.fanMode(self.applianceSn, newMode, function (err, result) {
      if (err) return console.error(err);
      self.log('Turned fan to ' + self.fanSpeed);

      self.fanSpeed = value;
      self.fanPending = false;
      callback(null);
    });
    //}
  },

  pushUpdate: function (characteristic, err, value) {

  },

  updateAll: function (self) {
    debug("updateAll() - " + self.applianceSn);
    self.AC.getTelem(self.applianceSn, function (err, result) { 
        debug("updateAll() - updating homekit " + self.applianceSn);
        self.getTemperatureDisplayUnits(function () { });
        self.getCurrentHeatingCoolingState(function () { });
        self.getTargetHeatingCoolingState(function () { });
        self.getCurrentTemperature(function () { });
        self.getTargetTemperature(function () { });
        self.getFanSpeed(function () { });
    });
  },

  // Optional
  getName: function (callback) {
    this.log("getName:", this.name);

    callback(null, this.name);
  },

  setName: function (value, callback) {
    this.log("setName:", value);

    this.name = value;

    callback(null);
  },

  getServices: function () {
    this.log("getServices");

    // you can OPTIONALLY create an information service if you wish to override
    // the default values for things like serial number, model, etc.
    this.informationService = new Service.AccessoryInformation();

    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.make)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

    this.thermostatService = new Service.Thermostat(this.name);

    // Required Characteristics
    if (this.cleanAirEnable) {
        debug("Clean Air Switch created for " + this.name);
        this.cleanAirSwitch = new Service.Switch("Clean Air");
        this.cleanAirSwitch
          .getCharacteristic(Characteristic.On)
          .on('get', this.getCleanAir.bind(this))
          .on('set', this.setCleanAir.bind(this));
    } else {
        debug("Clean Air Switch skipped for " + this.name);
    }

    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentHeatingCoolingState.bind(this));
    //.on('set', this.setCurrentHeatingCoolingState.bind(this));

    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.getTargetHeatingCoolingState.bind(this))
      .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));

    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .setProps({
        minValue: 15.5,
        maxValue: 32
      })
      .on('get', this.getTargetTemperature.bind(this))
      .on('set', this.setTargetTemperature.bind(this));

    this.thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.getTemperatureDisplayUnits.bind(this))
      .on('set', this.setTemperatureDisplayUnits.bind(this));

    this.thermostatService
      .addCharacteristic(Characteristic.RotationSpeed)
      .on('get', this.getFanSpeed.bind(this))
      .on('set', this.setFanSpeed.bind(this));

    // Optional Characteristics
    this.thermostatService
      .getCharacteristic(Characteristic.Name)
      .on('get', this.getName.bind(this))
      .on('set', this.setName.bind(this));

    if (this.cleanAirEnable) {
        return [this.informationService, this.thermostatService, this.cleanAirSwitch];
    } else {
        return [this.informationService, this.thermostatService];
    }
  }
};
