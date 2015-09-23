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
var dbhelper = require('../lib/db');
var moment = require('moment');
var indicative = require('indicative');
var validator = new indicative();

var Node = require('./node');
var Task = require('./task');
var Info = require('./info');
var Solution = require('./solution');
var User = require('./user');
var Degree = require('./degree');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Comment.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Kommentar-Nodes für Comment#create
Comment.VALIDATION_RULES = {
  comment: 'required|string'
};

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function Propertydefinition für den Inhalt des Kommentars
 * @prop {string} description Textinhalt des Kommentars
 */
Object.defineProperty(Comment.prototype, 'description', {
  get: function () {
    return this.properties.description;
  }
});

/**
 * @function Propertydefinition für den Autor des Kommentars als Userobjekt
 * @prop {object} author Autor des Kommentars
 */
Object.defineProperty(Comment.prototype, 'author', {
  get: function () {
    return this.properties.author;
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
 * @function Gibt einen bestimmten Kommentar zurück der zu einer bestimmten Node gehört
 * @param {string} commentUUID UUID des Kommentars
 * @param {string} nodeUUID UUID der Zielnode des Kommentars
 */
Comment.getCommentByIDAndNode = function(commentUUID, nodeUUID, callback) {

  var self = this;

  var query = [
    'MATCH (a {uuid: {nodeUUID}})<-[r:BELONGS_TO]-(c:Comment {uuid: {commentUUID}})',
    'RETURN c'
  ].join('\n');

  var params = {
    nodeUUID: nodeUUID,
    commentUUID: commentUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    if(result.length === 0) {
      err = new Error('Kommentar `'+commentUUID+'` für die Node `'+nodeUUID+'` existiert nicht');
      err.status = 404;
      err.name = 'CommentNotFound';
      return callback(err);
    }
    callback(null, new Comment(result[0].c));
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
  validator
    .validate(Comment.VALIDATION_RULES, properties)
    .then(function() {

      properties.createdAt = parseInt(moment().format('X'));
      properties.author = userUUID;

      var query = [
        'MATCH (a {uuid: {target}}), (u:User {uuid: {author}})',
        'WHERE (a:Task) or (a:Info) or (a:Comment) or (a:Solution)',
        'CREATE (a)<-[r:BELONGS_TO]-(c:Comment {properties})<-[r2:CREATED]-(u)',
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
        dbhelper.getNodeByID(result[0].c._id, function (err, node) {
          if (err) return callback(err);
          // erstelle neue Kommentarinstanz und gib diese zurück
          var c = new Comment(node);
          callback(null, c);
        });

      });

    })
    .catch(function(errors) {
      return callback(errors);
    });

};

// Instanzmethoden

/**
 * @function Gibt zugehörige Node, welche durch diesen Kommentar kommentiert wurde, zurück
 */
Comment.prototype.getParent = function (callback) {

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
 * @function Middleware um den Studiengang, zu dem diese Info gehört, im Request zu speichern
 */
Comment.prototype.getParentDegree = function(callback) {

  var self = this;

  var query = [
    'MATCH (c:Comment {uuid: {uuid}})-[:BELONGS_TO]->()-[:BELONGS_TO]->(target:Target)-[:PART_OF]->(d:Degree)',
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
Comment.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/comments/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  links.author = apiVersion + '/users/' + encodeURIComponent(this.properties.author);
  links.parent = base + '/parent';
  this.links = links;

};
