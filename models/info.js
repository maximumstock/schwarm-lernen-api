 'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Infos.
 */

/**
 * @function Konstruktor für eine Info
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Info = module.exports = function Info(_node) {
  Node.apply(this, arguments);
};

var neo4j = require('neo4j');
var config = require('../config/config');
var validate = require('../lib/validation/validation');
var errors = require('../lib/errors/errors');
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');
var Target = require('./target');
var User = require('./user');
var Degree = require('./degree');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Info.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Info-Nodes für Info#create
Info.VALIDATION_INFO = {
  description: {
    required: true,
    message: 'Muss eine Beschreibung haben'
  }
};

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function Propertydefinition für den Inhalt der Info
 * @prop {string} description Textinhalt der Info
 */
Object.defineProperty(Info.prototype, 'description', {
  get: function () {
    return this.properties.description;
  }
});

/**
 * @function Propertydefinition für den Autor der Info als Userobjekt
 * @prop {object} author Autor der Info
 */
Object.defineProperty(Info.prototype, 'author', {
  get: function () {
    return this.properties.author;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Infos
 * @param {string} uuid UUID der gesuchten Info
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Info.get = function (uuid, callback) {

  var query = [
    'MATCH (i:Info {uuid: {uuid}})<-[:CREATED]-(u:User)',
    'RETURN i'
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
      err = new Error('Es wurde keine Info `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'InfoNotFound';
      return callback(err);
    }
    // erstelle neue Info-Instanz und gib diese zurück
    result[0].i.properties.points = result[0].points;
    var i = new Info(result[0].i);
    callback(null, i);
  });

};

/**
 * @function get Statische Gettermethode für ALLE Infos
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Info.getAll = function (callback) {

  var query = [
    'MATCH (i:Info)',
    'RETURN i'
  ].join('\n');

  db.cypher({
    query: query
  }, function (err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Infos aus dem Ergebnisdokument
    var infos = result.map(function (e) {
      e.i.properties.rating = e.rating;
      e.i.properties.votes = e.votes;
      e.i.properties.author = new User(e.creator);
      return new Info(e.i);
    });

    callback(null, infos);
  });

};

/**
 * @function
 * @name create Erstellt eine neue Info und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} targetUUID UUID der Lernziel-Node für die die Info gilt
 * @param {string} userUUID UUID des Users, der die Info angefertigt hat
 * @param {integer} points Anzahl der Punkte die für das Erstellen verdient werden
 */
Info.create = function (properties, targetUUID, userUUID, points, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(Info.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  properties.createdAt = parseInt(moment().format('X'));
  properties.author = userUUID;
  properties.target = targetUUID;

  var query = [
    'MATCH (a:Target {uuid: {target}}), (u:User {uuid: {author}})',
    'CREATE (i:Info {properties})',
    'CREATE UNIQUE (a)<-[r:BELONGS_TO]-(i)<-[r2:CREATED {points: {points}}]-(u)',
    'return i'
  ].join('\n');

  var params = {
    properties: properties,
    target: targetUUID,
    author: userUUID,
    points: points
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    if (err) return callback(err);

    // falls es kein Ergebnis gibt wurde die neue Info nicht erstellt da es keinen passenden Autor oder Target gibt
    if (result.length === 0) {
      err = new Error('Das Target `' + targetUUID + '` existiert nicht');
      err.status = 404;
      err.name = 'TargetNotFound';

      return callback(err);
    }

    // hole gerade erstellte Info aus der Datenbank
    dbhelper.getNodeByID(result[0].i._id, function (err, node) {
      if (err) return callback(err);
      // erstelle neue Infosinstanz und gib diese zurück
      var i = new Info(node);
      callback(null, i);
    });

  });

};

// Instanzmethoden

/**
 * @function Gibt zugehöriges Target zu dieser Info zurück
 */
Info.prototype.getParent = function (callback) {

  var self = this;

  var query = [
    'MATCH (i:Info {uuid: {uuid}})-[r:BELONGS_TO]->(t:Target)',
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
    var t = new Target(result[0].t);
    callback(null, t);

  });

};

/**
 * @function Middleware um den Studiengang, zu dem diese Info gehört, im Request zu speichern
 */
Info.prototype.getParentDegree = function(callback) {

  var self = this;

  var query = [
    'MATCH (i:Info {uuid: {uuid}})-[:BELONGS_TO]->(target:Target)-[:PART_OF]->(d:Degree)',
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
Info.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/infos/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  links.author = apiVersion + '/users/' + encodeURIComponent(this.properties.author);
  links.target = apiVersion + '/targets/' + encodeURIComponent(this.properties.target);
  links.rating = base + '/rating';
  links.comments = base + '/comments';

  this.links = links;

};
