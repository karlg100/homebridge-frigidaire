'use strict';

var Frigidaire = require('frigidaire');

var Service, Characteristic;

function fahrenheitToCelsius(temperature) {
  return (temperature - 32) / 1.8;
}

function celsiusToFahrenheit(temperature) {
  return (temperature * 1.8) + 32;
}

module.exports = function(homebridge){
  Service = homebridge.hap.Service;

  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform("homebridge-frigidaire", "Frigidaire", FrigidairePlatform, false);
};

function FrigidairePlatform(log, config) {
  this.log = log;

  this.config = config;

  this.pollingInterval = this.config.pollingInterval || 10000;

  this.AC = new Frigidaire({
    username: this.config.username, 
    password: this.config.password,
    pollingInterval: this.pollingInterval
  });
}

FrigidairePlatform.prototype = {
  accessories: function (callback) {
    var self = this;
    var airConditioners = [];
    self.AC.getDevices(function(err, result) {
      if (err) return console.error(err);
      console.log('Got Devices');
      console.log(result);
      result.forEach(function(device) {
        if (device['APPLIANCE_TYPE_DESC'] == 'Air Conditioner') {
          console.log('craeting accessory for AC unit labeled : '+device['LABEL']);
          airConditioners.push(new FrigidaireAirConditionerAccessory(device, self.AC, self.log, self.pollingInterval));
        }
      });
      callback(airConditioners);
    });
  },
};

function FrigidaireAirConditionerAccessory(deviceInfo, AC, log, pollingInterval) {
  this.log = log;
  this.AC = AC;
  this.pollingInterval = pollingInterval;
  this.log('pollingInterval is set to '+this.pollingInterval);

  // Characteristic.TargetHeatingCoolingState.OFF
  // Characteristic.TargetHeatingCoolingState.HEAT
  // Characteristic.TargetHeatingCoolingState.AUTO
  // Characteristic.TargetHeatingCoolingState.COOL

  //this.currentCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
  this.currentCoolingState = undefined;
  this.targetCoolingState  = this.currentHeatingCoolingState;

  this.currentTemperature  = undefined;
  this.targetTemperature   = this.currentTemperature;

  // Characteristic.TemperatureDisplayUnits.FAHRENHEIT
  // Characteristic.TemperatureDisplayUnits.CELSIUS

  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

  this.fanSpeed = 0;
  this.fanPending = false; // need to change this to a timer, so the last value always gets executed after the current pending value is completed.

  this.applianceId  = deviceInfo['APPLIANCE_ID'];
  this.make         = deviceInfo['MAKE'];
  this.model        = deviceInfo['MODEL'];
  this.serialNumber = deviceInfo['SERIAL'];
  this.name         = deviceInfo['LABEL'] || 'AC Unit';
  this.firmware     = deviceInfo['NIU_VERSION'];

  this.AC.scheduleUpdates(this.applianceId, function () {});
  var self = this;
  this.updateTimer = setInterval(function () { self.updateAll(); }, this.pollingInterval);
}

FrigidaireAirConditionerAccessory.prototype = {
  // Start
  identify: function(callback) {
    this.log("Identify requested, but we have no way of doing this!");

    callback(null);
  },

  updateData: function(callback) {
    this.log("updateData");

    callback(null);
  },

  // Required
  getCurrentHeatingCoolingState: function(callback) {
    this.log("getCurrentHeatingCoolingState: ", this.currentCoolingState);

    callback(null, this.currentCoolingState);
  },

  setCurrentHeatingCoolingState: function(value, callback) {
    this.log("setCurrentHeatingCoolingState: ", value);

    this.targetCoolingState = value;

    callback(null);
  },

  getTargetHeatingCoolingState: function(callback) {
    var self = this;

    this.AC.getMode(self.applianceId, function(err, result) {
      if (err) return console.error(err);
      if (result == self.AC.MODE_OFF) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
      else if (result == self.AC.MODE_ECON) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
      else if (result == self.AC.MODE_COOL) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
      else if (result == self.AC.MODE_FAN) self.targetCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
      self.currentCoolingState = self.targetCoolingState;

      self.log("getTargetHeatingCoolingState: ", self.targetCoolingState);
      callback(null, self.targetCoolingState);
    });
 
  },

  setTargetHeatingCoolingState: function(value, callback) {
    var self = this;

    if (value == Characteristic.TargetHeatingCoolingState.OFF) var newMode = self.AC.MODE_OFF;
    else if (value == Characteristic.TargetHeatingCoolingState.AUTO) var newMode = self.AC.MODE_ECON;
    else if (value == Characteristic.TargetHeatingCoolingState.COOL) var newMode = self.AC.MODE_COOL;
    else if (value == Characteristic.TargetHeatingCoolingState.HEAT) var newMode = self.AC.MODE_FAN;

    this.AC.mode(self.applianceId, newMode, function(err, result) {
      if (err) return console.error(err);
      self.log("setTargetHeatingCoolingState from/to: ", self.targetCoolingState, value);
      self.targetCoolingState = value;
      self.currentCoolingState = self.targetCoolingState;
      callback(null);
    });
  },

  getCurrentTemperature: function(callback) {
    var self = this;
    this.AC.getRoomTemp(self.applianceId, function(err, result) {
      if (err) return console.error(err);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) self.currentTemperature = fahrenheitToCelsius(result);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS) self.currentTemperature = result;
      self.log("getCurrentTemperature: ", self.currentTemperature);
      callback(null, self.currentTemperature);
    });
  },

  getTargetTemperature: function(callback) {
    var self = this;
    this.AC.getTemp(self.applianceId, function(err, result) {
      if (err) return console.error(err);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) self.targetTemperature = fahrenheitToCelsius(result);
      if (self.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS) self.targetTemperature = result;
      self.log("getTargetTemperature: ", self.targetTemperature);
      callback(null, self.targetTemperature);
    });
  },

  setTargetTemperature: function(value, callback) {
    var self = this;
    this.AC.setTemp(self.applianceId, celsiusToFahrenheit(value), function(err, result) {
      if (err) return console.error(err);
      self.targetTemperature = value;
      self.log("setTargetTemperature to: ", value);
      callback(null);
    });
  },

  getTemperatureDisplayUnits: function(callback) {
    var self = this;
    this.AC.getUnit(self.applianceId, function(err, result) {
      if (err) return console.error(err);
      if (result == self.AC.FAHRENHEIT) self.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
      else if (result == self.AC.CELSIUS) self.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
      self.log("getTemperatureDisplayUnits: ", self.temperatureDisplayUnits);
      return callback(null, self.temperatureDisplayUnits);
    });
  },

  setTemperatureDisplayUnits: function(value, callback) {
    var self = this;
    if (value == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) var newValue = self.AC.FAHRENHEIT;
    else if (value == Characteristic.TemperatureDisplayUnits.CELSIUS) var newValue = self.AC.CELSIUS;

    self.AC.changeUnits(self.applianceId, newValue,function(err, result) {
      if (err) return console.error(err);
      self.temperatureDisplayUnits = value;
      self.log("setTemperatureDisplayUnits from %s to %s", self.temperatureDisplayUnits, value);
      return callback(null);
    });
  },

  getFanSpeed: function(callback) {
    var self = this;
    this.AC.getFanMode(self.applianceId, function(err, result) {
      if (err) return console.error(err);

      // we only have 3 fan speeds, plus auto.
      // auto = 100%
      // high = 67-99%
      // med  = 34-66%
      // low  = 0-33%
      // off? = 0% - we may need to add this later, if there's no way to turn off the unit using other controls
	    //
      self.log('current fan mode is '+result);
      if(result == self.AC.FANMODE_AUTO)
        self.fanSpeed = 100;
      else if(result == self.AC.FANMODE_LOW) {
        if (self.fanSpeed > 33) self.fanSpeed = 33;
        if (self.fanSpeed <= 0) self.fanSpeed = 1;
      } else if(result == self.AC.FANMODE_MED) {
        if (self.fanSpeed > 66) self.fanSpeed = 66;
        if (self.fanSpeed <= 33) self.fanSpeed = 34;
      } else if(result == self.AC.FANMODE_HIGH) {
        if (self.fanSpeed >= 100) self.fanSpeed = 99;
        if (self.fanSpeed <= 66) self.fanSpeed = 67;
      }

      self.log("getFanSpeed: ", self.fanSpeed);
      callback(null, self.fanSpeed);
    });
  },

  setFanSpeed: function(value, callback) {
    var self = this;
    var newMode;
    if (this.fanPending)
      callback(null);
    else {
      this.fanPending = true;
      if(value == 100) newMode =  this.AC.FANMODE_AUTO;
      else if (value >= 0 && value <= 33) newMode = this.AC.FANMODE_LOW;
      else if (value > 33 && value <= 66) newMode = this.AC.FANMODE_MED;
      else if (value > 66 && value < 100) newMode = this.AC.FANMODE_HIGH;
this.log('newMode = '+newMode);
  
      this.AC.fanMode(self.applianceId, newMode, function(err, result) {
        if (err) return console.error(err);
        self.log('Turned fan to '+self.fanSpeed);

        self.fanSpeed = value;
        self.fanPending = false;
        callback(null);
      });
    }
  },

  pushUpdate: function(characteristic, err, value) {
    
  },

  updateAll: function() {
    this.getTemperatureDisplayUnits(function () {});
    this.getCurrentHeatingCoolingState(function () {});
    this.getTargetHeatingCoolingState(function () {});
    this.getCurrentTemperature(function () {});
    this.getTargetTemperature(function () {});
    this.getFanSpeed(function () {});
  },

  // Optional
  getName: function(callback) {
    this.log("getName:", this.name);

    callback(null, this.name);
  },

  setName: function(value, callback) {
    this.log("setName:", value);

    this.name = value;

    callback(null);
  },

  getServices: function() {
    this.log("getServices");

    // you can OPTIONALLY create an information service if you wish to override
    // the default values for things like serial number, model, etc.
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.make)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

    var thermostatService = new Service.Thermostat(this.name);

    // Required Characteristics
    thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentHeatingCoolingState.bind(this))
      .on('set', this.setCurrentHeatingCoolingState.bind(this));

    thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.getTargetHeatingCoolingState.bind(this))
      .on('set', this.setTargetHeatingCoolingState.bind(this));

    thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));

    thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on('get', this.getTargetTemperature.bind(this))
      .on('set', this.setTargetTemperature.bind(this));

    thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.getTemperatureDisplayUnits.bind(this))
      .on('set', this.setTemperatureDisplayUnits.bind(this));

    thermostatService
      .addCharacteristic(Characteristic.RotationSpeed)
      .on('get', this.getFanSpeed.bind(this))
      .on('set', this.setFanSpeed.bind(this));

    // Optional Characteristics
    thermostatService
      .getCharacteristic(Characteristic.Name)
      .on('get', this.getName.bind(this))
      .on('set', this.setName.bind(this));

    return [informationService, thermostatService];
  }
};
