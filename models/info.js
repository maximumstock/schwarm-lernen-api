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

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Info.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Info-Nodes für Info#create
Info.VALIDATION_INFO = {
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
 * @function Propertydefinition für den Inhalt der Info
 * @prop {string} description Textinhalt der Info
 */
Object.defineProperty(Info.prototype, 'description', {
  get: function () {
    return this._node.properties.description;
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
    'MATCH (i:Info {uuid: {uuid}})',
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
      var i = new Info(e.i);
      return i;
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
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
Info.create = function (properties, targetUUID, userUUID, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(Info.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  properties.createdAt = parseInt(moment().format('X'));

  var query = [
    'MATCH (a:Target {uuid: {target}}), (u:User {uuid: {author}})',
    'CREATE (i:Info {properties})',
    'CREATE UNIQUE (a)<-[r:BELONGS_TO]-(i)<-[r2:CREATED]-(u)',
    'return i'
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

    // falls es kein Ergebnis gibt wurde die neue Info nicht erstellt da es keinen passenden Autor oder Target gibt
    if (result.length === 0) {
      err = new Error('Der Benutzer `' + userUUID + '` oder das Target `' + targetUUID + '` existieren nicht');
      err.status = 404;
      err.name = 'TargetOrUserNotFound';

      return callback(err);
    }

    // hole gerade erstellte Info aus der Datenbank
    dbhelper.getNodeById(result[0].i._id, function (err, result) {
      if (err) return callback(err);
      // erstelle neue Infosinstanz und gib diese zurück
      var i = new Info(result[0].x);
      callback(null, i);
    });

  });

};

// Instanzmethoden

/**
 * @function Gibt zugehöriges Target zu dieser Info zurück
 */
Info.prototype.target = function (callback) {

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
 * @function Gibt den Autor zurück
 */
Info.prototype.author = function (callback) {

  var self = this;

  var query = [
    'MATCH (i:Info {uuid: {uuid}})<-[:CREATED]-(u:User)',
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
 * @function Gibt alle Ratings zu dieser Info zurück
 */
Info.prototype.ratings = function (callback) {

  var self = this;

  var query = [
    'MATCH (i:Info {uuid: {uuid}})<-[r:RATES]-()',
    'RETURN r'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);

    callback(null, result);
  });

};

/**
 * @function Gibt alle Kommentare zu dieser Info zurück
 */
Info.prototype.comments = function (callback) {

  var self = this;

  var query = [
    'MATCH (i:Info {uuid: {uuid}})<-[r:COMMENTS]-(u:User)',
    'RETURN r, u'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);

    callback(null, result);
  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Info.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/infos/' + encodeURIComponent(this.uuid);
  this._node.ref = base;
  this._node.author = base + '/author';
  this._node.ratings = base + '/ratings';
  this._node.target = base + '/target';

};
