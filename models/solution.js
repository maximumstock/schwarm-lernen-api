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
var Degree = require('./degree');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Solution.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Loesungs-Nodes für Loesung#create
Solution.VALIDATION_INFO = {
  description: {
    required: true,
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
    return this.properties.description;
  }
});

/**
 * @function Propertydefinition für den Autor der Loesung als Userobjekt
 * @prop {object} author Author der Lösung
 */
Object.defineProperty(Solution.prototype, 'author', {
  get: function () {
    return this.properties.author;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Lösungen
 * @param {string} uuid UUID der gesuchten Lösung
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
    var loesungen = result.map(function (e) {
      return new Solution(e.s);
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
  properties.author = userUUID;
  properties.task = taskUUID;

  var query = [
    'MATCH (a:Task {uuid: {task}}), (u:User {uuid: {author}})',
    'MERGE (a)<-[r1:SOLVES]-(s:Solution)<-[r2:CREATED]-(u)',
    'ON CREATE SET s = {properties}',
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
      err = new Error('Die Aufgabe `' + taskUUID + '` existiert nicht');
      err.status = 404;
      err.name = 'TaskOrUserNotFound';
      return callback(err);
    }

    // obige Query fängt nicht den Fall ab, falls bereits eine Lösung bestand
    if(result[0].s.properties.createdAt !== properties.createdAt) {
      // Lösung bestand bereits
      err = new Error('Du hast die Aufgabe bereits gelöst');
      err.status = 409;
      err.name = 'TaskAlreadySolved';
      return callback(err);
    }

    // hole gerade erstellte Lösung aus der Datenbank
    dbhelper.getNodeByID(result[0].s._id, function (err, node) {
      if (err) return callback(err);
      // erstelle neue Lösungsinstanz und gib diese zurück
      var l = new Solution(node);
      callback(null, l);
    });
  });

};

// Instanzmethoden

/**
 * @function Gibt zugehörige Aufgabe zu dieser Lösung zurück
 */
Solution.prototype.getTask = function (callback) {

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
 * @function Middleware um den Studiengang, zu dem diese Aufgabe gehört, im Request zu speichern
 */
Solution.prototype.getParentDegree = function(callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})-[:SOLVES]->(t:Task)-[:BELONGS_TO]->(target:Target)-[:PART_OF]->(d:Degree)',
    'RETURN d'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    callback(err, new Degree(result[0].d));
  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Solution.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/solutions/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  links.author = apiVersion + '/users/' + encodeURIComponent(this.properties.author);
  links.task = apiVersion + '/tasks/' + encodeURIComponent(this.properties.task);
  links.comments = base + '/comments';
  links.rating = base + '/rating';
  this.links = links;

};
