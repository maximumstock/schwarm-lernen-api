'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Kommentare.
 */

/**
 * @function Konstruktor für einen Kommentar
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Comment = module.exports = function Comment(_node) {
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
var Info = require('./info');
var Solution = require('./solution');
var User = require('./user');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Comment.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Kommentar-Nodes für Comment#create
Comment.VALIDATION_INFO = {
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
 * @function Propertydefinition für den Inhalt des Kommentars
 * @prop {string} description Textinhalt des Kommentars
 */
Object.defineProperty(Comment.prototype, 'description', {
  get: function () {
    return this._node.properties.description;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Kommentare
 * @param {string} uuid UUID des gesuchten Kommentars
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Comment.get = function (uuid, callback) {

  var query = [
    'MATCH (c:Comment {uuid: {uuid}})',
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
    if (result.length === 0) {
      err = new Error('Es wurde kein Kommentar `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'CommentNotFound';
      return callback(err);
    }
    // erstelle neue Kommentar-Instanz und gib diese zurück
    var c = new Comment(result[0].c);
    callback(null, c);
  });

};

/**
 * @function get Statische Gettermethode für ALLE Kommentare
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Comment.getAll = function (callback) {

  var query = [
    'MATCH (c:Comment)',
    'RETURN c'
  ].join('\n');

  db.cypher({
    query: query
  }, function (err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Kommentaren aus dem Ergebnisdokument
    var comments = result.map(function (e) {
      var c = new Comment(e.c);
      return c;
    });

    callback(null, comments);
  });

};

/**
 * @function
 * @name create Erstellt einen neuen Kommentar und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} targetUUID UUID der kommentierbaren Node für die der Kommentar gilt (z.B. Info, Aufgabe, etc.)
 * @param {string} userUUID UUID des Users, der den Kommentar angefertigt hat
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
Comment.create = function (properties, targetUUID, userUUID, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(Comment.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  properties.createdAt = parseInt(moment().format('X'));

  // überprüfe ob targetUUID zu einer Node gehört die überhaupt kommentierbar ist
  dbhelper.isCommentable(targetUUID, function (err, commentable) {
    if (err) return callback(err);
    if (commentable) {

      var query = [
        'MATCH (a:Target {uuid: {target}}), (u:User {uuid: {author}})',
        'CREATE (c:Comment {properties})',
        'CREATE UNIQUE (a)<-[r:BELONGS_TO]-(c)<-[r2:CREATED]-(u)',
        'return c'
      ].join('\n');

      var params = {
        properties: properties,
        target: targetUUID,
        author: userUUID
      };

      db.cypher({
        query: query,
        params: params
      }, function (err, result) {

        if (err) return callback(err);

        // falls es kein Ergebnis gibt wurde der neue Kommentar nicht erstellt da es keinen passenden Autor oder Ziel gibt
        if (result.length === 0) {
          err = new Error('Der Benutzer `' + userUUID + '` oder das Ziel `' + targetUUID + '` existieren nicht');
          err.status = 404;
          err.name = 'TargetOrUserNotFound';

          return callback(err);
        }

        // hole gerade erstellten Kommentar aus der Datenbank
        dbhelper.getNodeById(result[0].c._id, function (err, node) {
          if (err) return callback(err);
          // erstelle neue Kommentarinstanz und gib diese zurück
          var c = new Comment(node[0].c);
          callback(null, c);
        });

      });

    } else {

      // Fehler werfen
      var e = new Error('Die Node ´' + targetUUID + '´ ist nicht kommentierbar');
      e.status = 409;
      e.name = 'TargetNotCommentable';

      callback(e);

    }
  });

};

// Instanzmethoden

/**
 * @function Gibt zugehörige Node, welche durch diesen Kommentar kommentiert wurde, zurück
 */
Comment.prototype.target = function (callback) {

  var self = this;

  var query = [
    'MATCH (c:Comment {uuid: {uuid}})-[r:BELONGS_TO]->(t)',
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
    // die kommentierte Node kann eines folgender Labels haben: Info, Task, Solution
    var t = null;
    var labels = result[0].t.labels;
    var o = result[0].t;

    if (labels.indexOf('Task') > -1) t = new Task(o);
    else if (labels.indexOf('Info') > -1) t = new Info(o);
    else if (labels.indexOf('Solution') > -1) t = new Solution(o);
    else ; // t unverändert/sollte nie passieren

    callback(null, t);
  });

};

/**
 * @function Gibt den Autor zurück
 */
Comment.prototype.author = function (callback) {

  var self = this;

  var query = [
    'MATCH (c:Comment {uuid: {uuid}})<-[:CREATED]-(u:User)',
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
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Comment.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/comments/' + encodeURIComponent(this.uuid);
  this._node.ref = base;
  this._node.author = base + '/author';
  this._node.target = base + '/target';

};
