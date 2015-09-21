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
var validate = require('../lib/validation/validation').validate;
var errors = require('../lib/errors/errors');
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Config.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Konfigurationen für Config#create
Config.VALIDATION_INFO = {
  solutionShare: {
    required: true
  },
  taskShare: {
    required: true
  },
  infoShare: {
    required: true
  },
  solutionPoints: {
    required: true
  },
  infoPoints: {
    required: true
  },
  taskPoints: {
    required: true
  },
  ratePoints: {
    required: true
  }
};

// Default-Konfigurationsobjekt für das Erstellen neuer Studiengänge
Config.DEFAULT_CONFIG = {
  solutionShare: 50, // Shares in Prozent
  taskShare: 35,
  infoShare: 15,
  infoPoints: 1,
  taskPoints: 2,
  solutionPoints: -3, // eig Kosten
  //rateMultiplier: 1, // ein Multiplikator der mit der Bewertung (1-5) verrechnet und als Punkten der A/L/I hinzugefügt wird,
  ratePoints: 1 // Anzahl der Punkte die der Bewertende für eine Bewertung bekommt
};

// Propertydefinition für den Namen des Studiengangs
Object.defineProperty(Config.prototype, 'degree', {
  get: function () {
    return this.properties.degree;
  }
});

// Propertydefinitionen für Konfigurationsparameter
Object.defineProperty(Config.prototype, 'solutionPoints', {
  get: function () {
    return this.properties.solutionPoints;
  }
});

Object.defineProperty(Config.prototype, 'infoPoints', {
  get: function () {
    return this.properties.infoPoints;
  }
});

Object.defineProperty(Config.prototype, 'taskPoints', {
  get: function () {
    return this.properties.taskPoints;
  }
});

Object.defineProperty(Config.prototype, 'ratePoints', {
  get: function () {
    return this.properties.ratePoints;
  }
});

Object.defineProperty(Config.prototype, 'solutionShare', {
  get: function () {
    return this.properties.solutionShare;
  }
});

Object.defineProperty(Config.prototype, 'infoShare', {
  get: function () {
    return this.properties.infoShare;
  }
});

Object.defineProperty(Config.prototype, 'taskShare', {
  get: function () {
    return this.properties.taskShare;
  }
});


// Öffentliche Methoden

// Statische Methoden

/**
 * @function Statische Gettermethode für Konfigurationen
 * @param {string} name Name des gesuchten Konfiguration
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

// /**
//  * @function Statische Gettermethode für ALLE Studiengänge
//  */
// Degree.getAll = function (callback) {
//
//   var query = [
//     'MATCH (d:Degree)',
//     'RETURN d'
//   ].join('\n');
//
//   db.cypher({
//     query: query
//   }, function (err, result) {
//     if (err) return callback(err);
//
//     // Erstelle ein Array von Modulen aus dem Ergebnisdokument
//     var degrees = result.map(function(e) {
//       return new Degree(e.d);
//     });
//
//     callback(null, degrees);
//   });
//
// };

/**
 * @function Erstellt ein neue Konfiguration für einen Studiengang
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} degreeUUID UUID des Studiengangs für den die Konfiguration gilt
 */
Config.create = function (properties, degreeUUID, callback) {

  // Validierung
  try {
    properties = validate(Config.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  properties.createdAt = parseInt(moment().format('X'));
  properties.degree = degreeUUID;

  // shares normalisieren
  var sum = properties.solutionShare + properties.infoShare + properties.taskShare;
  properties.solutionShare = properties.solutionShare / sum;
  properties.infoShare = properties.infoShare / sum;
  properties.taskShare = properties.taskShare / sum;

  var query = [
    'MATCH (d:Degree {uuid: {degreeUUID}})',
    'CREATE (d)<-[:BELONGS_TO]-(c:Config {properties})',
    'RETURN c'
  ].join('\n');

  var params = {
    properties: properties,
    degreeUUID: degreeUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    if (err) return callback(err);
    // gerade erstellte Instanz hat noch keine uuid -> mit `_id` Property nochmal querien
    var id = result[0].c._id;
    dbhelper.getNodeByID(id, function (err, node) {

      if (err) return callback(err);
      var c = new Config(node);
      callback(null, c);

    });

  });

};

// Instanzmethoden

// /**
//  * @function Löscht eine bestehenden Studiengang aus der Datenbank. Ein Studiengang kann nur gelöscht werden, sobald er
//  * keine weiteren Beziehungen mehr besitzt
//  */
// Degree.prototype.del = function (callback) {
//
//   var self = this;
//
//   var query = [
//     'MATCH (d:Degree {uuid: {uuid}})',
//     'DELETE d'
//   ].join('\n');
//
//   var params = {
//     uuid: self.uuid
//   };
//
//   db.cypher({
//     query: query,
//     params: params
//   }, function (err, result) {
//
//     // Keine Neo4J-Node kann gelöscht werden, falls noch Relationships daran hängen
//     if (err instanceof neo4j.DatabaseError &&
//       err.neo4j.code === 'Neo.DatabaseError.Transaction.CouldNotCommit') {
//
//       err = new Error('Am Studiengang `' + self.name + '` hängen noch Beziehungen.');
//       err.name = 'RemainingRelationships';
//       err.status = 409;
//
//     }
//
//     if (err) return callback(err);
//     // gib `null` zurück (?!)
//     callback(null, null);
//   });
//
// };

/**
 * @function Aktualisiert die jeweilige Node mit neuen Informationen
 * @param {object} properties Objekt mit Attribute deren Werte aktualisiert bzw.
 * deren Key-Value-Paare angelegt werden sollen, falls sie nicht bereits bestehen.
 */
Config.prototype.patch = function (properties, callback) {

  var self = this;

  try {
    // validate() mit `false` da SET +=<--
    properties = validate(Config.VALIDATION_INFO, properties, false);
  } catch (e) {
    return callback(e);
  }

  // vor normalisierung alle Werte zuweisen
  properties.solutionShare = properties.solutionShare || 100*this.properties.solutionShare;
  properties.taskShare = properties.taskShare || 100*this.properties.taskShare;
  properties.infoShare = properties.infoShare || 100*this.properties.infoShare;

  // shares normalisieren
  var sum = properties.solutionShare + properties.infoShare + properties.taskShare;
  properties.solutionShare = properties.solutionShare / sum;
  properties.infoShare = properties.infoShare / sum;
  properties.taskShare = properties.taskShare / sum;

  properties.changedAt = parseInt(moment().format('X'));

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
  links.degree = apiVersion + '/degrees/' + encodeURIComponent(this.degree);
  this.links = links;

};
