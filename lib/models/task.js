'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Aufgaben.
 */

/**
* @function Konstruktor für eine Aufgabe
* @constructs
* @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
*/
var Task = module.exports = function Task(_node) {
  Node.apply(this, arguments);
};

var neo4j = require('neo4j');
var config = require('../config/config');
var indicative = require('indicative');
var validator = new indicative();
var dbhelper = require('../db');
var moment = require('moment');

var Node = require('./node');
var Solution = require('./solution');
var User = require('./user');
var Target = require('./target');
var Rating = require('./rating');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Task.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Aufgabe-Nodes für Aufgabe#create
Task.VALIDATION_RULES = {
  description: 'required|string|max:200',
  sources: 'required|string|max:1000',
  text: 'required|string|max:2000'
};

Task.PROTECTED_ATTRIBUTES = ['uuid', 'createdAt', 'author', 'target'];

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @prop {string} description Beschreibung der Aufgabe
 */
Object.defineProperty(Task.prototype, 'description', {
  get: function() {
    return this.properties.description;
  }
});

/**
 * @prop {object} author Autor der Aufgabe als Userobjekt
 */
Object.defineProperty(Task.prototype, 'author', {
  get: function() {
    return this.properties.author;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function Statische Gettermethode für Aufgaben
 * @param {string} uuid UUID der gesuchten Aufgabe
 */
Task.get = function(uuid, callback) {

  var query = [
    'MATCH (a:Task {uuid: {uuid}})<-[:CREATED]-(u:User)',
    'RETURN a'
  ].join('\n');

  var params = {
    uuid: uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if (err) return callback(err);
    if (result.length === 0) {
      err = new Error('Es wurde keine Aufgabe `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'AufgabeNotFound';
      return callback(err);
    }
    // erstelle neue Aufgabe-Instanz und gib diese zurück
    var a = new Task(result[0].a);

    callback(null, a);
  });

};

/**
 * @function Statische Gettermethode für ALLE Aufgaben
 */
Task.getAll = function(callback) {

  var query = [
    'MATCH (a:Task)',
    'RETURN a'
  ].join('\n');

  db.cypher({
    query: query
  }, function(err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Aufgaben aus dem Ergebnisdokument
    var aufgaben = result.map(function(e) {
      return new Task(e.a);
    });

    callback(null, aufgaben);
  });

};

/**
 * @function Erstellt eine neue Aufgabe und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} parentUUID UUID der Parent-Node, an die die Aufgabe gehängt werden soll
 * @param {string} authorUUID UUID des Autors der Aufgabe
 */
Task.create = function(properties, parentUUID, authorUUID, callback) {

  // Validierung
  validator
    .validate(Task.VALIDATION_RULES, properties)
    .then(function() {

      properties.createdAt = moment().format('X');
      properties.author = authorUUID;
      properties.target = parentUUID;

      var query = [
        'MATCH (dt:Target {uuid: {parent}}), (u:User {uuid: {author}})',
        'CREATE (a:Task:Unfinished {properties})',
        'CREATE UNIQUE (u)-[:CREATED]->(a)-[r:BELONGS_TO]->(dt)',
        'RETURN a'
      ].join('\n');

      var params = {
        properties: properties,
        parent: parentUUID,
        author: authorUUID
      };

      db.cypher({
        query: query,
        params: params
      }, function(err, result) {

        if (err) return callback(err);

        // falls es kein Ergebnis gibt wurde die neue Aufgabe nicht erstellt da es keinen passenden Parent zu `parentUUID` gibt
        if(result.length === 0) {
          err = new Error('Das Lernziel als Parent mit der UUID `' + parentUUID + '` oder der User mit der UUID `'+authorUUID+'` existiert nicht');
          err.status = 404;
          err.name = 'TargetNotFound';

          return callback(err);
        }

        // hole gerade erstellte Info aus der Datenbank
        dbhelper.getNodeByID(result[0].a._id, function (err, node) {
          if (err) return callback(err);
          // erstelle neue Infosinstanz und gib diese zurück
          var i = new Task(node);
          callback(null, i);
        });

      });

    })
    .catch(function(errors) {
      return callback(errors);
    });

};


/**
 * @function Aktualisiert die Aufgabe mit den Daten aus dem {properties} Objekt
 * @param {object} properties Objekt mit neuen Daten für die Aufgabe
 */
Task.prototype.patch = function(properties, cb) {

  var self = this;

  Task.PROTECTED_ATTRIBUTES.forEach(function(i) {
    if(properties.hasOwnProperty(i)) delete properties[i];
  });

  properties.changedAt = moment().format('X');

  // Validierung
  validator
    .validate(Task.VALIDATION_RULES, properties)
    .then(function() {

      var query = [
        'MATCH (t:Task:Unfinished {uuid: {taskUUID}})',
        'SET t += {properties}',
        'RETURN t'
      ].join('\n');

      var params = {
        taskUUID: self.uuid,
        properties: properties
      };

      db.cypher({
        query: query,
        params: params
      }, function(err, result) {
        if(err) return cb(err);
        if(result.length === 0) {
          // Task `taskUUID` existiert nicht oder ist nicht mehr veränderbar
          err = new Error('Die Aufgabe `'+self.uuid+'` existiert nicht oder ist nicht mehr änderbar');
          err.status = 409;
          err.name = 'AlreadySubmitted';
          return cb(err);
        }
        var task = new Task(result[0].t);
        return cb(null, task);
      });

    })
    .catch(function(err) {
      return cb(err);
    });

};

/**
 * @function Löscht die alte Parent-Beziehung zwischen dieser Aufgaben und dessen Lernziel und
 * erstellt eine neue Beziehung zwischen dieser Aufgabe und dem angegebenen Lernziel
 * @param {string} newParent UUID der neuen Parent-Node
 */
Task.prototype.changeParent = function(newParent, callback) {

  var self = this;

  var query = [
    'MATCH (a:Task {uuid: {uuid}}), (p:Target {uuid: {parent}})',
    'OPTIONAL MATCH (a)-[r:BELONGS_TO]->(oldp:Target)',
    'DELETE r',
    'CREATE UNIQUE (a)-[newr:BELONGS_TO]->(p)',
    'RETURN a'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    parent: newParent
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if(err) return callback(err);
    callback(null, result);

  });

};

/**
 * @function Gibt Vater-Node der Aufgabe, also das zugehörige Lernziel zurück
 */
Task.prototype.getParent = function(callback) {

  var self = this;

  var query = [
    'MATCH (n {uuid: {selfUUID}})-[:BELONGS_TO]->(t:Target)',
    'RETURN t'
  ].join('\n');

  var params = {
    selfUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    if(result.length === 0) {
      err = new Error('Keine Aufgabe `'+self.uuid+'` oder kein zugehöriges Lernziel gefunden');
      err.status = 404;
      err.name = 'ShitHappens';
      return callback(err);
    }

    callback(null, new Target(result[0].t));
  });

};

/**
 * @function Gibt alle zugehörigen Lösungen zu dieser Aufgabe zurück
 */
Task.prototype.getSolutions = function(callback) {

  var self = this;

  var query = [
    'MATCH (a:Task {uuid: {uuid}})<-[r:SOLVES]-(s:Solution) WHERE NOT s:Inactive AND NOT s:Unfinished',
    'RETURN s'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if(err) return callback(err);
    var solutions = result.map(function(i) {
      return new Solution(i.s);
    });
    callback(null, solutions);

  });

};

/**
 * @function Helferfunktion um das Hauptlernziel, zu dem diese Aufgabe gehört, zu erhalten
 */
Task.prototype.getParentEntryTarget = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Task {uuid: {uuid}})-[:BELONGS_TO]->(target:Target)-[:PART_OF *0..]->(et:Target:EntryTarget)',
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
 * @function Helferfunktion um das unmittelbar nächste Lernziel, zu dem diese Aufgabe gehört, zu erhalten
 */
Task.prototype.getParentTarget = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Task {uuid: {uuid}})-[:BELONGS_TO]->(et:Target)',
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
 * @function Liefert alle Bewertungen einer Aufgabe, falls welche bestehen
 */
Task.prototype.getRatings = function(callback) {

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
Task.prototype.addMetadata = function(apiVersion) {

  // Autor soll anonym sein
  if(this.properties.author) {
    delete this.properties.author;
  }

  apiVersion = apiVersion || '';
  var base = apiVersion + '/tasks/' + encodeURIComponent(this.uuid);
  var links = {};
  links.ref = base;
  //links.author = apiVersion + '/users/' + encodeURIComponent(this.properties.author);
  links.target = apiVersion + '/targets/' + encodeURIComponent(this.properties.target);
  links.solutions = base + '/solutions';
  links.solution = base + '/solution';
  links.ratings = base + '/ratings';
  links.rating = base + '/ratings';
  links.status = base + '/status';

  // falls die Aufgabe `unfinished` ist, kann man sie unter folgender URL abgeben
  if(!this.isFinished()) {
    links.submit = base + '/submit';
  }

  this.links = links;

};
