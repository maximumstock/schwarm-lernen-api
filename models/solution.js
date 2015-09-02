'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Lösungen.
 */

/**
 * @function Konstruktor für eine Lösung
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Solution = module.exports = function (_node) {
  Node.apply(this, arguments);
};

var neo4j = require('neo4j');
var config = require('../config/config');
var validate = require('../lib/validation/validation');
var errors = require('../lib/errors/errors');
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');
var Task = require('./task');
var Comment = require('./comment');
var User = require('./user');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Solution.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Loesungs-Nodes für Loesung#create
Solution.VALIDATION_INFO = {
  author: {
    required: true,
    minLength: 36,
    message: 'Muss einen Autor haben.'
  },
  description: {
    required: true,
    minLength: 10,
    message: 'Muss eine Beschreibung haben'
  }
};

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function Propertydefinition für den Inhalt der Loesung
 * @prop {string} description Textinhalt der Lösung
 */
Object.defineProperty(Solution.prototype, 'description', {
  get: function () {
    return this._node.properties.description;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Lösungen
 * @param {string} uuid UUID der gesuchten Lösung
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Solution.get = function (uuid, callback) {

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})',
    'RETURN s'
  ].join('\n');

  var params = {
    uuid: uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    if (result.length === 0) {
      err = new Error('Es wurde keine Lösung `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'SolutionNotFound';
      return callback(err);
    }
    // erstelle neue Lösungs-Instanz und gib diese zurück
    var l = new Solution(result[0].s);
    callback(null, l);
  });

};

/**
 * @function get Statische Gettermethode für ALLE Lösungen
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Solution.getAll = function (callback) {

  var query = [
    'MATCH (s:Solution)',
    'RETURN s'
  ].join('\n');

  db.cypher({
    query: query
  }, function (err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Lösungen aus dem Ergebnisdokument
    var loesungen = [];
    result.forEach(function (e) {
      var l = new Solution(e.s);
      loesungen.push(l);
    });

    callback(null, loesungen);
  });

};

/**
 * @function
 * @name create Erstellt eine neue Lösung und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} taskUUID UUID der Aufgaben-Node für die die Lösung gilt
 * @param {string} userUUID UUID des Users, der die Lösung angefertigt hat
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
Solution.create = function (properties, taskUUID, userUUID, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(Solution.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  properties.createdAt = parseInt(moment().format('X'));

  var query = [
    'MATCH (a:Task {uuid: {task}}), (u:User {uuid: {author}})',
    'CREATE (s:Solution {properties})',
    'CREATE (a)<-[r:SOLVES]-(s)<-[r2:CREATED]-(u)',
    'return s'
  ].join('\n');

  var params = {
    properties: properties,
    task: taskUUID,
    author: userUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    if (err) return callback(err);
    // falls es kein Ergebnis gibt wurde die neue Lösung nicht erstellt da es keinen passenden Autor oder Aufgabe gibt
    if (result.length === 0) {
      err = new Error('Der Benutzer `' + userUUID + '` oder die Aufgabe `' + taskUUID + '` existieren nicht');
      err.status = 404;
      err.name = 'TaskOrUserNotFound';
      return callback(err);
    }

    // hole gerade erstellte Lösung aus der Datenbank
    dbhelper.getNodeById(result[0].s._id, function (err, result) {
      if (err) return callback(err);
      // erstelle neue Lösungsinstanz und gib diese zurück
      var l = new Solution(result[0].x);
      callback(null, l);
    });
  });

};

// Instanzmethoden

/**
 * @function Gibt zugehörige Aufgabe zu dieser Lösung zurück
 */
Solution.prototype.task = function (callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})-[r:SOLVES]->(a:Task)',
    'RETURN a'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    if (err) return callback(err);
    var a = new Task(result[0].a);
    callback(null, a);

  });

};

/**
 * @function Gibt den Autor zurück
 */
Solution.prototype.author = function (callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})<-[:CREATED]-(u:User)',
    'RETURN u'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    var u = new User(result[0].u);
    callback(null, u);
  });

};

/**
 * @function Gibt alle Kommentare zu dieser Lösung zurück
 */
Solution.prototype.comments = function (callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})<-[:BELONGS_TO]-(c:Comment)',
    'RETURN c'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, comments) {
    if (err) return callback(err);

    comments = comments.map(function (c) {
      c = new Comment(c.c);
      return c;
    });
    callback(null, comments);
  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Solution.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/solutions/' + encodeURIComponent(this.uuid);
  this._node.ref = base;
  this._node.author = base + '/author';
  this._node.comments = base + '/comments';
  this._node.task = base + '/task';

};
