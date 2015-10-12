'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für globale Konfigurationen für Hauptlernziele.
 */

 /**
  * @function Konstruktor
  * @constructs
  * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
  */
 var GlobalConfig = module.exports = function GlobalConfig(_node) {
   Node.apply(this, arguments);
 };

var neo4j = require('neo4j');
var config = require('../config/config');
var indicative = require('indicative');
var validator = new indicative();
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');
var Config = require('./config');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

GlobalConfig.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Konfigurationen für GlobalConfig#create, GlobalConfig#patch
GlobalConfig.VALIDATION_RULES = {
  packageSize: 'integer|above:4',
  taskShare: 'number|range:0,100',
  infoShare: 'number|range:0,100',
  rateShare: 'number|range:0,100',
  solutionShare: 'number|range:0,100',
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

// Enthält Informationen ob eine Property wirklich global sein soll und nicht überschreibbar sein soll
GlobalConfig.ENSURE_GLOBAL = [
  'packageSize',
  'taskShare',
  'infoShare',
  'rateShare',
  'solutionShare'
];

// Attribute die nicht per .patch aktualsiert werden dürfen
GlobalConfig.PROTECTED_ATTRIBUTES = ['createdAt', 'parent', 'uuid'];

// Default-Konfigurationsobjekt für das Erstellen neuer Studiengänge
GlobalConfig.DEFAULT_CONFIG = {
  packageSize: 10,
  // Shares beziehen sich auf die Anteile an neu verteilten Arbeitspaketen
  rateShare: 0.3,
  taskShare: 0.50,
  infoShare: 0.2,
  solutionShare: 0.0,
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

Object.defineProperty(GlobalConfig.prototype, 'packageSize', {
  get: function () {
    return this.properties.packageSize;
  }
});


Object.defineProperty(GlobalConfig.prototype, 'rateShare', {
  get: function () {
    return this.properties.rateShare;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'solutionShare', {
  get: function () {
    return this.properties.solutionShare;
  }
});


Object.defineProperty(GlobalConfig.prototype, 'infoShare', {
  get: function () {
    return this.properties.infoShare;
  }
});


Object.defineProperty(GlobalConfig.prototype, 'taskShare', {
  get: function () {
    return this.properties.taskShare;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'ratePoints', {
  get: function () {
    return this.properties.ratePoints;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'rateCost', {
  get: function () {
    return this.properties.rateCost;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'solutionCost', {
  get: function () {
    return this.properties.solutionCost;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'solutionPoints', {
  get: function () {
    return this.properties.solutionPoints;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'solutionMaxPoints', {
  get: function () {
    return this.properties.solutionMaxPoints;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'infoCost', {
  get: function () {
    return this.properties.infoCost;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'infoPoints', {
  get: function () {
    return this.properties.infoPoints;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'infoMaxPoints', {
  get: function () {
    return this.properties.infoMaxPoints;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'taskCost', {
  get: function () {
    return this.properties.taskCost;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'taskPoints', {
  get: function () {
    return this.properties.taskPoints;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'taskMaxPoints', {
  get: function () {
    return this.properties.taskMaxPoints;
  }
});

Object.defineProperty(GlobalConfig.prototype, 'parent', {
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
GlobalConfig.get = function (uuid, callback) {

  var query = [
    'MATCH (c:GlobalConfig {uuid: {uuid}})',
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
      err = new Error('Es wurde keine globale Konfiguration `' + uuid + '` gefunden.');
      err.name = 'GlobalConfigNotFound';
      err.status = 404;
      return callback(err);
    }
    // erstelle neue Instanz und gib diese zurück
    var c = new GlobalConfig(result[0].c);
    callback(null, c);
  });

};

/**
 * @function Erstellt ein neue Konfiguration für einen Studiengang
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} parentUUID UUID des Lernziels für den die Konfiguration gilt
 */
GlobalConfig.create = function (properties, parentUUID, callback) {

  // Validierung
  validator
    .validate(GlobalConfig.VALIDATION_RULES, properties)
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
        'CREATE (t)<-[:BELONGS_TO]-(c:GlobalConfig {properties})',
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
          var c = new GlobalConfig(node);
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
GlobalConfig.prototype.patch = function (properties, callback) {

  var self = this;

  GlobalConfig.PROTECTED_ATTRIBUTES.forEach(function(i) {
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
    'MATCH (c:GlobalConfig {uuid: {uuid}})',
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
    var c = new GlobalConfig(result[0].c);
    callback(null, c);

  });

};

/**
 * @function Löscht die jeweilige Konfiguration
 */
GlobalConfig.prototype.del = function(cb) {

  var self = this;

  var query = [
    'MATCH (c:GlobalConfig {uuid: {configUUID}})-[r:BELONGS_TO]->(t:Target)',
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
 * @function Kombiniert diese globale Konfiguration mit der spezialisierenden Konfiguration {config}
 * aus globaler und spezieller Config eine gemeinsame Config bauen (Achtung auf `uuid` und andere spezielle Attribute achten)
 * da `Config` und `GlobalConfig` verschiedene JS Prototypen darstellen, ist es unratsam einfach eine neue Config mit der Schnittmenge
 * der Attribute zu erstellen, da bspw. nicht beide Prototypen die gleichen Getter-Methoden definiert haben
 * daher bietet es sich an in req._config einfach ein reines JS Objekt anstatt eines Prototypen zu speichern
 * @param {config} Object Ein spezialisierendes Config-Objekt des Prototyps `Config`
 */
GlobalConfig.prototype.combine = function(config) {

  var self = this;

  var conf = self.properties; // leere, noch zu füllende Config

  var prop;
  // vorinitialisieren mit globaler Konfiguration
  for(prop in GlobalConfig.VALIDATION_RULES) {
    conf[prop] = self[prop];
  }
  // überschreiben mit spezialisierten Werten
  for(prop in Config.VALIDATION_RULES) {
    if(config && config.properties && config.properties.hasOwnProperty(prop)) {
      conf[prop] = config[prop];
    }
  }
  // hier alle Werte, die in GlobalConfig.ENSURE_GLOBAL definiert sind, nochmal überschreiben
  // damit Werte wie packageSize ausschließlich durch die globale Config beeinflusst werden
  GlobalConfig.ENSURE_GLOBAL.forEach(function(p) {
    if(self[prop]) {
      conf[prop] = self[prop];
    }
  });

  return this;


};


/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
GlobalConfig.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';

  var links = {};
  links.parent = apiVersion + '/targets/' + encodeURIComponent(this.parent);
  this.links = links;

};
