'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Konfigurationen für Studiengänge.
 */

 /**
  * @function Konstruktor
  * @constructs
  * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
  */
 var Config = module.exports = function Config(_node) {
   Node.apply(this, arguments);
 };

var neo4j = require('neo4j');
var config = require('../config/config');
var indicative = require('indicative');
var validator = new indicative();
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Config.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Konfigurationen für Config#create, Config#patch
Config.VALIDATION_RULES = {
  packageSize: 'integer|above:5',
  rateMultiplier: 'integer|min:1',
  taskShare: 'number|range:0,100',
  infoShare: 'number|range:0,100',
  rateShare: 'number|range:0,100',
  solutionShare: 'number|range:0,100',
  taskPoints: 'integer|min:0',
  infoPoints: 'integer|min:0',
  ratePoints: 'integer|min:0',
  solutionPoints: 'integer|min:0',
  taskCost: 'integer|min:0',
  infoCost: 'integer|min:0',
  rateCost: 'integer|min:0',
  solutionCost: 'integer|min:0'
};

// Attribute die nicht per .patch aktualsiert werden dürfen
Config.PROTECTED_ATTRIBUTES = ['createdAt', 'parent', 'uuid'];

// Default-Konfigurationsobjekt für das Erstellen neuer Studiengänge
Config.DEFAULT_CONFIG = {
  packageSize: 10,
  // Shares beziehen sich auf die Anteile an neu verteilten Arbeitspaketen
  rateShare: 0.15,
  taskShare: 0.50,
  infoShare: 0.35,
  solutionShare: 0.0,
  // Points beziehen sich auf die Menge der Punkte die der Einstellende für eine Aktion bekommt
  infoPoints: 5,
  taskPoints: 7,
  solutionPoints: 0,
  ratePoints: 1,
  // Costs beziehen sich auf die Menge der Punkte die der Einstellende für eine Aktion zahlen muss
  infoCost: 0,
  taskCost: 0,
  solutionCost: 10, // eig Kosten
  rateCost: 1, // Anzahl der Punkte die der Bewertende für eine Bewertung bekommt
  rateMultiplier: 1, // ein Multiplikator der mit der Bewertung (1-5) verrechnet und als Punkten der A/L/I hinzugefügt wird,

};

// Propertydefinition für den Namen des Studiengangs
Object.defineProperty(Config.prototype, 'degree', {
  get: function () {
    return this.properties.degree;
  }
});

Object.defineProperty(Config.prototype, 'packageSize', {
  get: function () {
    return this.properties.packageSize;
  }
});

Object.defineProperty(Config.prototype, 'rateMultiplier', {
  get: function () {
    return this.properties.rateMultiplier;
  }
});

Object.defineProperty(Config.prototype, 'ratePoints', {
  get: function () {
    return this.properties.ratePoints;
  }
});

Object.defineProperty(Config.prototype, 'rateCost', {
  get: function () {
    return this.properties.rateCost;
  }
});

Object.defineProperty(Config.prototype, 'rateShare', {
  get: function () {
    return this.properties.rateShare;
  }
});

Object.defineProperty(Config.prototype, 'solutionShare', {
  get: function () {
    return this.properties.solutionShare;
  }
});

Object.defineProperty(Config.prototype, 'solutionCost', {
  get: function () {
    return this.properties.solutionCost;
  }
});

Object.defineProperty(Config.prototype, 'solutionPoints', {
  get: function () {
    return this.properties.solutionPoints;
  }
});

Object.defineProperty(Config.prototype, 'infoShare', {
  get: function () {
    return this.properties.infoShare;
  }
});

Object.defineProperty(Config.prototype, 'infoCost', {
  get: function () {
    return this.properties.infoCost;
  }
});

Object.defineProperty(Config.prototype, 'infoPoints', {
  get: function () {
    return this.properties.infoPoints;
  }
});

Object.defineProperty(Config.prototype, 'taskShare', {
  get: function () {
    return this.properties.taskShare;
  }
});

Object.defineProperty(Config.prototype, 'taskCost', {
  get: function () {
    return this.properties.taskCost;
  }
});

Object.defineProperty(Config.prototype, 'taskPoints', {
  get: function () {
    return this.properties.taskPoints;
  }
});

Object.defineProperty(Config.prototype, 'parent', {
  get: function() {
    return this.properties.parent;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function Statische Gettermethode für Konfigurationen
 * @param {string} name Name der gesuchten Konfiguration
 */
Config.get = function (uuid, callback) {

  var query = [
    'MATCH (c:Config {uuid: {uuid}})',
    'RETURN c'
  ].join('\n');

  var params = {
    uuid: uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    // falls Konfiguration nicht existiert
    if (result.length === 0) {
      err = new Error('Es wurde keine Konfiguration `' + uuid + '` gefunden.');
      err.name = 'ConfigNotFound';
      err.status = 404;
      return callback(err);
    }
    // erstelle neue Instanz und gib diese zurück
    var c = new Config(result[0].c);
    callback(null, c);
  });

};

/**
 * @function Erstellt ein neue Konfiguration für einen Studiengang
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} parentUUID UUID des Lernziels für den die Konfiguration gilt
 */
Config.create = function (properties, parentUUID, callback) {

  // Validierung
  validator
    .validate(Config.VALIDATION_RULES, properties)
    .then(function() {

      properties.createdAt = moment().format('X');
      properties.parent = parentUUID;

      // shares normalisieren
      var sum = properties.solutionShare + properties.infoShare + properties.taskShare + properties.rateShare;
      properties.solutionShare = properties.solutionShare / sum;
      properties.infoShare = properties.infoShare / sum;
      properties.taskShare = properties.taskShare / sum;
      properties.rateShare = properties.rateShare / sum;

      var query = [
        'MATCH (t:Target {uuid: {parentUUID}})',
        'CREATE (t)<-[:BELONGS_TO]-(c:Config {properties})',
        'RETURN c'
      ].join('\n');

      var params = {
        properties: properties,
        parentUUID: parentUUID
      };

      db.cypher({
        query: query,
        params: params
      }, function (err, result) {

        if (err) return callback(err);
        if(result.length === 0) {
          err = new Error('Es gibt kein Lernziel mit der UUID `'+parentUUID+'`');
          err.name = 'TargetNotFound';
          err.status = 404;
          return callback(err);
        }
        // gerade erstellte Instanz hat noch keine uuid -> mit `_id` Property nochmal querien
        var id = result[0].c._id;
        dbhelper.getNodeByID(id, function (err, node) {

          if (err) return callback(err);
          var c = new Config(node);
          callback(null, c);

        });

      });

    })
    .catch(function(errors) {
      return callback(errors);
    });

};

/**
 * @function Aktualisiert die jeweilige Node mit neuen Informationen
 * @param {object} properties Objekt mit Attribute deren Werte aktualisiert bzw.
 * deren Key-Value-Paare angelegt werden sollen, falls sie nicht bereits bestehen.
 */
Config.prototype.patch = function (properties, callback) {

  var self = this;

  Config.PROTECTED_ATTRIBUTES.forEach(function(i) {
    if(properties.hasOwnProperty(i)) delete properties[i];
  });

  // vor normalisierung alle Werte zuweisen
  properties.solutionShare = properties.solutionShare || 100*this.properties.solutionShare;
  properties.taskShare = properties.taskShare || 100*this.properties.taskShare;
  properties.infoShare = properties.infoShare || 100*this.properties.infoShare;
  properties.rateShare = properties.rateShare || 100*this.properties.rateShare;

  // shares normalisieren
  var sum = properties.solutionShare + properties.infoShare + properties.taskShare + properties.rateShare;
  properties.solutionShare = properties.solutionShare / sum;
  properties.infoShare = properties.infoShare / sum;
  properties.taskShare = properties.taskShare / sum;
  properties.rateShare = properties.rateShare / sum;

  properties.changedAt = moment().format('X');

  var query = [
    'MATCH (c:Config {uuid: {uuid}})',
    'SET c += {properties}',
    'RETURN c'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    properties: properties
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    if (err) return callback(err);
    var c = new Config(result[0].c);
    callback(null, c);

  });

};


/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Config.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';

  var links = {};
  links.parent = apiVersion + '/targets/' + encodeURIComponent(this.parent);
  this.links = links;

};
