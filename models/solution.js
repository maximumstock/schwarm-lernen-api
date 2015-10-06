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
var indicative = require('indicative');
var validator = new indicative();
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');
var Task = require('./task');
var User = require('./user');
var Target = require('./target');
var Rating = require('./rating');


var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Solution.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Loesungs-Nodes für Loesung#create
Solution.VALIDATION_RULES = {
  description: 'required|string|max:200',
  sources: 'required|string|max:1000',
  text: 'required|string|max:2000'
};

Solution.PROTECTED_ATTRIBUTES = ['uuid', 'createdAt', 'author', 'task'];

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
 * @function Statische Gettermethode für Lösungen
 * @param {string} uuid UUID der gesuchten Lösung
 */
Solution.get = function (uuid, callback) {

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})<-[:CREATED]-(u:User)',
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
 * @function Statische Gettermethode für ALLE Lösungen
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
 * @function Erstellt eine neue Lösung und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} taskUUID UUID der Aufgaben-Node für die die Lösung gilt
 * @param {string} userUUID UUID des Users, der die Lösung angefertigt hat
 */
Solution.create = function (properties, taskUUID, userUUID, callback) {

  // Validierung
  validator
    .validate(Solution.VALIDATION_RULES, properties)
    .then(function() {

      properties.createdAt = moment().format('X');
      properties.author = userUUID;
      properties.task = taskUUID;

      var query = [
        'MATCH (a:Task {uuid: {task}}), (u:User {uuid: {author}})',
        'CREATE UNIQUE (a)<-[:SOLVES]-(s:Solution:Unfinished {properties})<-[:CREATED]-(u)',
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
          err.name = 'TaskNotFound';
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

    })
    .catch(function(errors) {
      return callback(errors);
    });

};

// Instanzmethoden

/**
 * @function Aktualisiert die Lösung mit den Daten aus dem {properties} Objekt
 * @param {object} properties Objekt mit neuen Daten für die Lösung
 */
Solution.prototype.patch = function(properties, cb) {

  var self = this;

  Solution.PROTECTED_ATTRIBUTES.forEach(function(i) {
    if(properties.hasOwnProperty(i)) delete properties[i];
  });

  properties.changedAt = moment().format('X');

  // Validierung
  validator
    .validate(Solution.VALIDATION_RULES, properties)
    .then(function() {

      var query = [
        'MATCH (s:Solution:Unfinished {uuid: {solutionUUID}})',
        'SET s += {properties}',
        'RETURN s'
      ].join('\n');

      var params = {
        solutionUUID: self.uuid,
        properties: properties
      };

      db.cypher({
        query: query,
        params: params
      }, function(err, result) {
        if(err) return cb(err);
        if(result.length === 0) {
          // Lösung `solutionUUID` existiert nicht oder ist nicht mehr veränderbar
          err = new Error('Die Lösung `'+self.uuid+'` existiert nicht oder ist nicht mehr änderbar');
          err.status = 409;
          err.name = 'AlreadySubmitted';
          return cb(err);
        }
        var solution = new Solution(result[0].s);
        return cb(null, solution);
      });

    })
    .catch(function(err) {
      return cb(err);
    });

};


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
Solution.prototype.getParentTarget = function(callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})-[:SOLVES]->(t:Task)-[:BELONGS_TO]->(target:Target)-[:PART_OF *1..]->(et:Target:EntryTarget)',
    'RETURN et'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    callback(err, new Target(result[0].et));
  });

};

/**
 * @function Liefert alle Bewertungen einer Lösung, falls welche bestehen
 */
Solution.prototype.getRatings = function(callback) {

  var self = this;

  var query = [
    'MATCH (n {uuid: {selfUUID}})<-[:RATES]-(r:Rating)',
    'RETURN r'
  ].join('\n');

  var params = {
    selfUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    var ratings = result.map(function(i) {
      var r = new Rating(i.r);
      return r;
    });
    return callback(null, ratings);
  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Solution.prototype.addMetadata = function (apiVersion) {

  // Autor soll anonym sein
  if(this.properties.author) {
    delete this.properties.author;
  }

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/solutions/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  //links.author = apiVersion + '/users/' + encodeURIComponent(this.properties.author);
  links.task = apiVersion + '/tasks/' + encodeURIComponent(this.properties.task);
  links.ratings = base + '/ratings';
  links.rating = base + '/rating';
  links.status = base + '/status';
  // falls die Aufgabe `unfinished` ist, kann man sie unter folgender URL abgeben
  if(!this.isFinished()) {
    links.submit = base + '/submit';
  }
  this.links = links;

};
