'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Konfigurationen für Lernziele.
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
  taskPoints: 'integer|min:0',
  infoPoints: 'integer|min:0',
  ratePoints: 'integer|min:0',
  solutionPoints: 'integer|min:0',
  taskMaxPoints: 'integer|min:1',
  infoMaxPoints: 'integer|min:1',
  solutionMaxPoints: 'integer|min:1',
  taskCost: 'integer|min:0',
  infoCost: 'integer|min:0',
  rateCost: 'integer|min:0',
  solutionCost: 'integer|min:0'
};

// Attribute die nicht per .patch aktualsiert werden dürfen
Config.PROTECTED_ATTRIBUTES = ['createdAt', 'parent', 'uuid'];

// Default-Konfigurationsobjekt für das Erstellen neuer Studiengänge
Config.DEFAULT_CONFIG = {
  // folgende 3 Werte beziehen sich auf die Menge der Punkte die der Betreffende maximal erhalten kann wenn alle Bewertungen die maximale Punktzahl geben
  taskMaxPoints: 10,
  infoMaxPoints: 10,
  solutionMaxPoints: 1,
  // folgende 3 Werte beziehen sich auf die Menge der Punkte die der Einstellende direkt nach dem Einstellen des jeweiligen Inhalts bekommt
  infoPoints: 5,
  taskPoints: 7,
  solutionPoints: 0,
  ratePoints: 1, // ratePoints hingegen bezieht sich auf die Menge der Punkte die man für das Bewerten von Bewertungen erhalten soll
  // Costs beziehen sich auf die Menge der Punkte die der Einstellende für eine Aktion zahlen muss
  infoCost: 0,
  taskCost: 0,
  solutionCost: 10, // eig Kosten
  rateCost: 1 // Anzahl der Punkte die der Bewertende für eine Bewertung bezahlen muss
};

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

Object.defineProperty(Config.prototype, 'solutionMaxPoints', {
  get: function () {
    return this.properties.solutionMaxPoints;
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

Object.defineProperty(Config.prototype, 'infoMaxPoints', {
  get: function () {
    return this.properties.infoMaxPoints;
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

Object.defineProperty(Config.prototype, 'taskMaxPoints', {
  get: function () {
    return this.properties.taskMaxPoints;
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
 * @function Löscht die jeweilige Konfiguration
 */
Config.prototype.del = function(cb) {

  var self = this;

  var query = [
    'MATCH (c:Config {uuid: {configUUID}})-[r:BELONGS_TO]->(t:Target)',
    'DELETE c,r'
  ].join('\n');

  var params = {
    configUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    return cb(err, null);
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
