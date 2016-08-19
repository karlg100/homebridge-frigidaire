'use strict';

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
}

FrigidairePlatform.prototype = {
  accessories: function (callback) {
    var airConditioner = new FrigidaireAirConditionerAccessory(this.log);

    callback([airConditioner]);
  },
};

function FrigidaireAirConditionerAccessory(log) {
  this.log = log;

  // Characteristic.TargetHeatingCoolingState.OFF
  // Characteristic.TargetHeatingCoolingState.HEAT
  // Characteristic.TargetHeatingCoolingState.AUTO
  // Characteristic.TargetHeatingCoolingState.COOL

  this.currentCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
  this.targetCoolingState  = this.currentHeatingCoolingState;

  this.currentTemperature  = 72.0;
  this.targetTemperature   = this.currentTemperature;

  // Characteristic.TemperatureDisplayUnits.FAHRENHEIT
  // Characteristic.TemperatureDisplayUnits.CELSIUS

  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

  this.fanSpeed = 0;

  // TODO: look these up dynamically?
  this.model        = "FCRC0844S10";
  this.serialNumber = "";
  this.name         = "Frigidaire Air Conditioner";
}

FrigidaireAirConditionerAccessory.prototype = {
  // Start
  identify: function(callback) {
    this.log("Identify requested!");

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
    this.log("getTargetHeatingCoolingState: ", this.targetCoolingState);

    callback(null, this.targetCoolingState);
  },

  setTargetHeatingCoolingState: function(value, callback) {
    this.log("setTargetHeatingCoolingState from/to: ", this.targetCoolingState, value);

    this.targetCoolingState = value;

    callback(null);
  },

  getCurrentTemperature: function(callback) {
    this.log("getCurrentTemperature: ", this.currentTemperature);

    callback(null, this.currentTemperature);
  },

  getTargetTemperature: function(callback) {
    this.log("getTargetTemperature: ", this.targetTemperature);

    callback(null, this.targetTemperature);
  },

  setTargetTemperature: function(value, callback) {
    this.log("setTargetTemperature to: ", value);

    this.targetTemperature = value;

    callback(null);
  },

  getTemperatureDisplayUnits: function(callback) {
    this.log("getTemperatureDisplayUnits: ", this.temperatureDisplayUnits);

    callback(null, this.temperatureDisplayUnits);
  },

  setTemperatureDisplayUnits: function(value, callback) {
    this.log("setTemperatureDisplayUnits from %s to %s", this.temperatureDisplayUnits, value);

    this.temperatureDisplayUnits = value;

    callback(null);
  },

  getFanSpeed: function(callback) {
    this.log("getFanSpeed: ", this.fanSpeed);

    callback(null, Math.floor(this.fanSpeed * 100));
  },

  setFanSpeed: function(value, callback) {
    this.log("setFanSpeed: ", value);

    this.fanSpeed = value / 100;

    callback(null);
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
      .setCharacteristic(Characteristic.Manufacturer, "Frigidaire")
      .setCharacteristic(Characteristic.Model, this.model)
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
