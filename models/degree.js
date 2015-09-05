'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Studiengänge.
 */

 /**
  * @function Konstruktor
  * @constructs
  * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
  */
 var Degree = module.exports = function Degree(_node) {
   Node.apply(this, arguments);
 };

var neo4j = require('neo4j');
var config = require('../config/config');
var validate = require('../lib/validation/validation').validate;
var errors = require('../lib/errors/errors');
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');
var Target = require('./target');
var User = require('./user');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Degree.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Degrees für Degree#create
Degree.VALIDATION_INFO = {
  name: {
    required: true,
    minLength: 3,
    message: 'Muss einen Namen haben.'
  }
};

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function Propertydefinition für den Namen des Studiengangs
 * @prop {string} name Name des Studiengangs
 */
Object.defineProperty(Degree.prototype, 'name', {
  get: function () {
    return this.properties.name;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Studiengänge
 * @param {string} name Name des gesuchten Studiengangs
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Degree.get = function (uuid, callback) {

  var query = [
    'MATCH (d:Degree {uuid: {uuid}})',
    'RETURN d'
  ].join('\n');

  var params = {
    uuid: uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    // falls Studiengang nicht existiert
    if (result.length === 0) {
      err = new Error('Es wurde kein Studiengang `' + uuid + '` gefunden.');
      err.name = 'DegreeNotFound';
      err.status = 404;
      return callback(err);
    }
    // erstelle neue Instanz und gib diese zurück
    var s = new Degree(result[0].d);
    callback(null, s);
  });

};

/**
 * @function getAll Statische Gettermethode für ALLE Studiengänge
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Degree.getAll = function (callback) {

  var query = [
    'MATCH (d:Degree)',
    'RETURN d'
  ].join('\n');

  db.cypher({
    query: query
  }, function (err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Modulen aus dem Ergebnisdokument
    var degrees = [];
    result.forEach(function (e) {
      var s = new Degree(e.d);
      degrees.push(s);
    });

    callback(null, degrees);
  });

};

/**
 * @function Erstellt einen neuen Studiengang und speichert ihn in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
Degree.create = function (properties, callback) {

  // Validierung
  // `validate()` garantiert unter anderem, dass mindestens ein Name für die neue Node vorhanden ist
  try {
    properties = validate(Degree.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  properties.createdAt = parseInt(moment().format('X'));

  var query = [
    'Create (d:Degree {properties})',
    'RETURN d'
  ].join('\n');

  var params = {
    properties: properties,
    name: properties.name
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    // falls der Name schon verwendet wird fängt unser Constraint diesen Fall ab
    if (err instanceof neo4j.ClientError &&
      err.neo4j.code === 'Neo.ClientError.Schema.ConstraintViolation') {

      // Studiengangname besteht bereits
      // Erzeuge neuen, übersichtlicheren Fehler für Nutzer
      err = new Error('Es besteht bereits ein Studiengang names `' + properties.name + '`.');
      err.name = 'DegreeAlreadyExists';
      err.status = 409;

    }

    if (err) return callback(err);
    // gerade erstellte Instanz hat noch keine uuid -> mit `_id` Property nochmal querien
    var id = result[0].d._id;

    dbhelper.getNodeById(id, function (err, result) {

      if (err) return callback(err);
      var d = new Degree(result[0].x);
      callback(null, d);

    });

  });

};

// Instanzmethoden

/**
 * @function Löscht eine bestehenden Studiengang aus der Datenbank. Ein Studiengang kann nur gelöscht werden, sobald er
 * keine weiteren Beziehungen mehr besitzt
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Degree.prototype.del = function (callback) {

  var self = this;

  var query = [
    'MATCH (d:Degree {uuid: {uuid}})',
    'DELETE d'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    // Keine Neo4J-Node kann gelöscht werden, falls noch Relationships daran hängen
    if (err instanceof neo4j.DatabaseError &&
      err.neo4j.code === 'Neo.DatabaseError.Transaction.CouldNotCommit') {

      err = new Error('Am Studiengang `' + self.name + '` hängen noch Beziehungen.');
      err.name = 'RemainingRelationships';
      err.status = 400;

    }

    if (err) return callback(err);
    // gib `null` zurück (?!)
    callback(null, null);
  });

};

/**
 * @function Aktualisiert die jeweilige Node mit neuen Informationen
 * @param {object} properties Objekt mit Attribute deren Werte aktualisiert bzw.
 * deren Key-Value-Paare angelegt werden sollen, falls sie nicht bereits bestehen.
 * @param {callback} callback Callbackfunktion, die die aktualisierte Node engegennimmt
 */
Degree.prototype.patch = function (properties, callback) {

  var self = this;

  try {
    // validate() mit `false` da SET +=<--
    // falls `true` müsste z.B. stets der Name mitgesendet werden, da der Name oben als `required` definiert ist
    properties = validate(Degree.VALIDATION_INFO, properties, false);
  } catch (e) {
    return callback(e);
  }

  properties.changedAt = parseInt(moment().format('X'));

  var query = [
    'MATCH (d:Degree {uuid: {uuid}})',
    'SET d += {properties}',
    'RETURN d'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    properties: properties
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    // Datenbank-/Constraintfehler abfangen

    // falls der Studiengangsname schon verwendet wird -> ConstraintViolation Error
    if (err instanceof neo4j.ClientError &&
      err.neo4j.code === 'Neo.ClientError.Schema.ConstraintViolation') {

      err = new Error('Es besteht bereits ein Studiengang namens `' + self.name + '`.');
      err.name = 'DegreeAlreadyExists';
      err.status = 400;

    }

    // Fehler weiterreichen
    if (err) {
      return callback(err);
    }

    // aktualisierte Instanz erzeugen und zurückgeben
    var s = new Degree(result[0].d);
    callback(null, s);

  });

};

/**
 * @function Liefert alle Lernziele innerhalb eines Studiengangs die {level} Beziehungen vom Studiengang entfernt sind
 * @param {int} level maximale Beziehungstiefe in der Lernziele gesucht werden sollen
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Degree.prototype.getTargets = function (level, callback) {

  var self = this;

  var query = [
    'MATCH (d:Degree {uuid: {uuid}})<-[r:PART_OF *1..' + level + ']-(t:Target)',
    'RETURN t'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);

    // Instanzen anlegen
    result = result.map(function (t) {
      return new Target(t.t);
    });

    callback(null, result);
  });

};

/**
 * @function Gibt alle User zurück die auf diesen Studiengang zugreifen können
 */
Degree.prototype.getUsers = function (callback) {

  var self = this;

  var query = [
    'MATCH (d:Degree {uuid: {uuid}})<-[:HAS_ACCESS]-(u:User)',
    'RETURN u'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    var users = result.map(function(i) {
      return new User(i.u);
    });
    callback(null, users);
  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Degree.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/degrees/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  links.targets = base + '/targets';
  links.users = base + '/users';
  this.links = links;

};

// Static initialization:

// Anlegen von Constraints
// Constraint: Unique Name eines Studiengangs
db.createConstraint({
  label: 'Degree',
  property: 'name',
}, function (err, constraint) {
  if (err) throw err; // fürs erste Server einfach crashen lassen
  if (constraint) {
    console.log('(Unique Studiengang:name registriert.)');
  } else {
    // Constraint besteht bereits
  }
});
