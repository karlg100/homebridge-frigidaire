'use strict';

var debug = require('debug')('frigidaire:homebridge');
var Frigidaire = require('frigidaire');
const fs = require('fs');
const path = require('path')

var Service, Characteristic, User;

function fahrenheitToCelsius(temperature) {
  return (temperature - 32) / 1.8;
}

function celsiusToFahrenheit(temperature) {
  return (temperature * 1.8) + 32;
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;

  Characteristic = homebridge.hap.Characteristic;

  User = homebridge.user;

  homebridge.registerPlatform("homebridge-frigidaire", "Frigidaire", FrigidairePlatform, false);
};

function FrigidairePlatform(log, config) {
  this.log = log;

  this.config = config;

  this.pollingInterval = this.config.pollingInterval || 10000;

  let homebridgeConfigDir = null
  if (this.config.cacheRefreshToken) {
    homebridgeConfigDir = path.dirname(User.configPath())
    this.log('cacheRefreshToken option set to true, using directory ' + homebridgeConfigDir + ' as cache path')
  }

  this.AC = new Frigidaire({
    username: this.config.username,
    password: this.config.password,
    pollingInterval: this.pollingInterval,
    applianceSerial: this.config.applianceSerial || null,
    cacheDir: homebridgeConfigDir
  });
}

FrigidairePlatform.prototype = {
  accessories: function (callback) {
    var self = this;
    var airConditioners = [];

    debug("Autodetecting all devices...");
    self.AC.getDevices(function (err, result) {
      if (err) {
        console.error(err);
        return callback(airConditioners);
      }
      debug("Got Device List, setting up each accessory");
      debug(result);
      result.forEach(function (device) {
        device = { ...device, ...self.AC.applianceInfo[device.fullId] }
        self.log('Creating accessory for AC unit: ' + device.nickname);
        debug(device);
        airConditioners.push(new FrigidaireAirConditionerAccessory(device, self.AC, self.log, self.pollingInterval));
      });
      debug("calling back airConditioners");
      return callback(airConditioners);
    });
    //}
  },
};

function FrigidaireAirConditionerAccessory(applianceObj, AC, log, pollingInterval) {
  this.log = log;
  this.AC = AC;
  this.applianceObj = applianceObj;
  this.applianceSn = applianceObj.sn;
  this.pollingInterval = pollingInterval;
  debug('pollingInterval is set to ' + this.pollingInterval);

  this.currentCoolingState = undefined;
  this.targetCoolingState = this.currentHeatingCoolingState;

  this.currentTemperature = undefined;
  this.targetTemperature = this.currentTemperature;

  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

  this.fanSpeed = 0;
  this.fanPending = false; // need to change this to a timer, so the last value always gets executed after the current pending value is completed.

  this.applianceId = this.applianceObj.applianceId;
  this.make = this.applianceObj.brand;
  this.model = this.applianceObj.model
  this.serialNumber = this.applianceSn;
  this.name = this.applianceObj.nickname;
  this.firmware = this.applianceObj.version;

  var self = this;
  this.updateTimer = setInterval(self.updateAll, this.pollingInterval, self);
}

FrigidaireAirConditionerAccessory.prototype = {
  // Start
  identify: function (callback) {
    this.log("Identify requested, but we have no way of doing this!");

    return callback(null);
  },

  updateData: function (callback) {
    this.log("updateData");

    return callback(null);
  },

  // Required
  getCurrentHeatingCoolingState: function (callback) {
    var self = this;
    debug("getCurrentHeatingCoolingState: ", this.currentCoolingState);
    this.AC.getCoolingState(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      if (result == self.AC.COOLINGSTATE_OFF) self.currentCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
      else if (result == self.AC.COOLINGSTATE_ON) self.currentCoolingState = Characteristic.CurrentHeatingCoolingState.COOL;
      self.thermostatService
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .updateValue(self.currentCoolingState);
      debug("getCurrentHeatingCoolingState: ", self.currentCoolingState);
      return callback(null, self.currentCoolingState);
    });
  },

  getFanState: function (callback) {
    var self = this;
    debug("getFanState: ", this.currentCoolingState);
    this.AC.getCoolingState(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      self.fan
        .getCharacteristic(Characteristic.On)
        .updateValue(result);
      debug("getFanState: ", result);
      return callback(null, result);
    });
  },

  /* no way to set this with API
    setCurrentHeatingCoolingState: function(value, callback) {
      this.log("setCurrentHeatingCoolingState: ", value);
  
      this.currentCoolingState = value;
      return callback(null);
    },
  */

  getCleanAir: function (callback) {
    var self = this;

    this.AC.getCleanAir(self.applianceSn, function (err, result) {
      var newValue;
      if (err) return console.error(err);
      if (result == self.AC.CLEANAIR_ON) newValue = true;
      else if (result == self.AC.CLEANAIR_OFF) newValue = false;

      debug("getCleanAir: ", self.cleanAir);

      if (self.cleanAir != newValue) {
        self.cleanAir = newValue;
        self.cleanAirSwitch
          .setCharacteristic(Characteristic.On, newValue);
      }

      return callback(null, self.cleanAir);
    });
  },

  setCleanAir: function (value, callback) {
    var self = this;
    if (value == true) var newMode = self.AC.CLEANAIR_ON;
    else if (value == false) var newMode = self.AC.CLEANAIR_OFF;

    if (self.cleanAir == value)
      return callback(null);

    this.AC.cleanAir(self.applianceSn, newMode, function (err, result) {
      if (err) return console.error(err);

      self.log("setCleanAir: ", newMode);
      self.cleanAir = value;

      self.cleanAirSwitch
        .setCharacteristic(Characteristic.On, value);

      return callback(null);
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

      if (oldstate != self.targetCoolingState)
        self.thermostatService
          .getCharacteristic(Characteristic.TargetHeatingCoolingState)
          .updateValue(self.targetCoolingState);

      debug("getTargetHeatingCoolingState: ", self.targetCoolingState);
      return callback(null, self.targetCoolingState);
    });

  },

  setTargetHeatingCoolingState: function (value, callback) {
    var self = this;

    if (value == Characteristic.TargetHeatingCoolingState.OFF) var newMode = self.AC.MODE_OFF;
    else if (value == Characteristic.TargetHeatingCoolingState.AUTO) var newMode = self.AC.MODE_ECON;
    else if (value == Characteristic.TargetHeatingCoolingState.COOL) var newMode = self.AC.MODE_COOL;
    else if (value == Characteristic.TargetHeatingCoolingState.HEAT) var newMode = self.AC.MODE_FAN;

    // abort any calls that doesn't change the mode
    if (self.targetCoolingState == value)
      return callback(null);

    this.AC.mode(self.applianceSn, newMode, function (err, result) {
      if (err) return console.error(err);
      self.log("setTargetHeatingCoolingState from/to: ", self.targetCoolingState, value);
      self.targetCoolingState = value;
      self.thermostatService
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .updateValue(self.targetCoolingState);
      return callback(null);
    });
  },

  getCurrentTemperature: function (callback) {
    var self = this;
    if (this.disableTemp) {
      self.thermostatService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(undefined);
      self.currentTemperature = undefined;
      return callback(null, undefined);
    }
    this.AC.getRoomTemp(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      var oldtemp = self.currentTemperature;
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) self.currentTemperature = fahrenheitToCelsius(result);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS) self.currentTemperature = result;
      debug("getCurrentTemperature: %s -> %s", result, self.currentTemperature);
      if (oldtemp != self.currentTemperature)
        self.thermostatService
          .getCharacteristic(Characteristic.CurrentTemperature)
          .updateValue(self.currentTemperature);
      return callback(null, self.currentTemperature);
    });
  },

  getTargetTemperature: function (callback) {
    var self = this;
    this.AC.getTemp(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      var oldtemp = self.targetTemperature;
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) self.targetTemperature = fahrenheitToCelsius(result);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS) self.targetTemperature = result;
      debug("getTargetTemperature %s -> %s (old: %s)", result, self.targetTemperature, oldtemp);

      if (oldtemp === undefined || oldtemp != self.targetTemperature)
        self.thermostatService
          .getCharacteristic(Characteristic.TargetTemperature)
          .updateValue(self.targetTemperature);
      return callback(null, self.targetTemperature);
    });
  },

  setTargetTemperature: function (value, callback) {
    var self = this;

    if (self.targetTemperature == value)
      return callback(null);

    this.AC.setTemp(self.applianceSn, celsiusToFahrenheit(value), function (err, result) {
      if (err) return console.error(err);
      self.targetTemperature = value;
      self.log("setTargetTemperature to: ", value);
      self.thermostatService
        .getCharacteristic(Characteristic.TargetTemperature)
        .updateValue(self.targetTemperature);
      return callback(null);
    });
  },

  getTemperatureDisplayUnits: function (callback) {
    var self = this;
    this.AC.getUnit(self.applianceSn, function (err, result) {
      if (err) return console.error(err);
      var oldunits = self.temperatureDisplayUnits;
      if (result == self.AC.FAHRENHEIT) self.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
      else if (result == self.AC.CELSIUS) self.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
      if (oldunits != self.temperatureDisplayUnits)
        self.thermostatService
          .getCharacteristic(Characteristic.TemperatureDisplayUnits)
          .updateValue(self.temperatureDisplayUnits);
      debug("getTemperatureDisplayUnits: ", self.temperatureDisplayUnits);
      return callback(null, self.temperatureDisplayUnits);
    });
  },

  setTemperatureDisplayUnits: function (value, callback) {
    var self = this;
    if (value == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) var newValue = self.AC.FAHRENHEIT;
    else if (value == Characteristic.TemperatureDisplayUnits.CELSIUS) var newValue = self.AC.CELSIUS;

    if (this.temperatureDisplayUnits == value)
      return callback(null);

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
      debug('current fan mode is ' + result);
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

      debug("getFanSpeed: ", self.fanSpeed);

      if (oldfan != self.fanSpeed)
        self.fan
          .getCharacteristic(Characteristic.RotationSpeed)
          .updateValue(self.fanSpeed);

      return callback(null, self.fanSpeed);
    });
  },

  setFanSpeed: function (value, callback) {
    var self = this;
    var newMode;
    if (value == 100) newMode = this.AC.FANMODE_AUTO;
    else if (value >= 0 && value <= 33) newMode = this.AC.FANMODE_LOW;
    else if (value > 33 && value <= 66) newMode = this.AC.FANMODE_MED;
    else if (value > 66 && value < 100) newMode = this.AC.FANMODE_HIGH;
    this.log('newMode = ' + newMode);

    if (this.fanSpeed == value)
      return callback(null);

    self.fan
      .getCharacteristic(Characteristic.RotationSpeed)
      .updateValue(self.fanSpeed);

    this.AC.fanMode(self.applianceSn, newMode, function (err, result) {
      if (err) return console.error(err);
      self.log('Turned fan to ' + self.fanSpeed);

      self.fanSpeed = value;
      self.fanPending = false;
      return callback(null);
    });
  },

  getFilter: function (callback) {
    var self = this;

    this.AC.getFilter(self.applianceSn, function (err, result) {
      var newValue;
      if (err) return console.error(err);
      if (result == self.AC.FILTER_GOOD) newValue = Characteristic.FilterChangeIndication.FILTER_OK;
      else newValue = Characteristic.FilterChangeIndication.CHANGE_FILTER;


      debug("getFilter: ", self.filter);

      if (self.filter != newValue) {
        self.filter = newValue;
        self.thermostatService
          .setCharacteristic(Characteristic.FilterChangeIndication, newValue);
      }

      return callback(null, self.filter);
    });
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
        self.getCleanAir(function () { });
        self.getFilter(function () { });
        self.getFanState(function () { });
    });
  },

  // Optional
  getName: function (callback) {
    debug("getName:", this.name);

    return callback(null, this.name);
  },

  setName: function (value, callback) {
    this.log("setName:", value);

    this.name = value;

    return callback(null);
  },

  getServices: function () {
    debug("getServices");

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
    //if (this.AC.hasAttribute(this.applianceSn, this.AC.CLEANAIR)) {
    //if (this.cleanAirEnable) {
        debug("Clean Air Switch created for " + this.name);
        this.cleanAirSwitch = new Service.Switch(this.name + " Ionizer");
        this.cleanAirSwitch
          .getCharacteristic(Characteristic.On)
          .on('get', this.getCleanAir.bind(this))
          .on('set', this.setCleanAir.bind(this));
    //debug(this.cleanAirSwitch);
    //} else {
        //debug("Clean Air Switch skipped for " + this.name);
    //}

    this.fan = new Service.Fan(this.name + " Fan");
    this.fan
        .getCharacteristic(Characteristic.On)
        .on('get', this.getFanState.bind(this))

    // Filter status attribute
    this.thermostatService
        .getCharacteristic(Characteristic.FilterChangeIndication)
        .on('get', this.getFilter.bind(this));

    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentHeatingCoolingState.bind(this));

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
        minValue: 15.56,
        maxValue: 32.22,
        minStep: 0.1
      })
      .on('get', this.getTargetTemperature.bind(this))
      .on('set', this.setTargetTemperature.bind(this));

    this.thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.getTemperatureDisplayUnits.bind(this))
      .on('set', this.setTemperatureDisplayUnits.bind(this));

    this.fan
      .addCharacteristic(Characteristic.RotationSpeed)
      .on('get', this.getFanSpeed.bind(this))
      .on('set', this.setFanSpeed.bind(this));

    // Optional Characteristics
    this.thermostatService
      .getCharacteristic(Characteristic.Name)
      .on('get', this.getName.bind(this))
      .on('set', this.setName.bind(this));

    return [this.informationService, this.thermostatService, this.cleanAirSwitch, this.filterStatus, this.fan];
  }
};
