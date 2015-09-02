'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für User.
 */

/**
 * @function Konstruktor für einen User
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var User = module.exports = function User(_node) {
  Node.apply(this, arguments);
};

var neo4j = require('neo4j');
var config = require('../config/config');
var validate = require('../lib/validation/validation');
var errors = require('../lib/errors/errors');
var dbhelper = require('../lib/db');
var moment = require('moment');
var pwgen = require('password-generator');

var Node = require('./node');
var Task = require('./task');
var Info = require('./info');
var Solution = require('./solution');
var Comment = require('./comment');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

User.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Kommentar-Nodes für Comment#create
User.VALIDATION_INFO = {
  password: {
    required: true,
    minLength: 10,
    message: 'Muss ein Passwort haben.'
  }
};

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function Propertydefinition für den Name des Users, welcher die UUID der Node ist
 * @prop {string} name Name des Users
 */
Object.defineProperty(User.prototype, 'name', {
  get: function () {
    return this._node.properties.uuid;
  }
});

/**
 * @function Propertydefinition für das Passwort des Nutzers
 * @prop {string} password Passwort
 */
Object.defineProperty(User.prototype, 'password', {
  get: function () {
    return this._node.properties.password;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für User
 * @param {string} uuid UUID des gesuchten Users
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
User.get = function (uuid, callback) {

  var query = [
    'MATCH (u:User {uuid: {uuid}})',
    'RETURN u'
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
      err = new Error('Es wurde kein User `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'UserNotFound';
      return callback(err);
    }
    // erstelle neue User-Instanz und gib diese zurück
    var u = new User(result[0].u);
    callback(null, u);
  });

};

/**
 * @function get Statische Gettermethode für ALLE User
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
User.getAll = function (callback) {

  var query = [
    'MATCH (u:User)',
    'RETURN u'
  ].join('\n');

  db.cypher({
    query: query
  }, function (err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Usern aus dem Ergebnisdokument
    var users = result.map(function (e) {
      var u = new User(e.u);
      return u;
    });

    callback(null, users);
  });

};

/**
 * @function
 * @name create Erstellt einen neuen User und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
User.create = function (properties, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(User.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  properties.createdAt = parseInt(moment().format('X'));
  // Passwort generieren
  properties.password = pwgen(10, false, /\w/); // 10 Zeichen, not-mermorable, alpha-numerisch

  var query = [
    'CREATE (u:User {properties})',
    'return u'
  ].join('\n');

  var params = {
    properties: properties
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {

    if (err) return callback(err);
    // hole gerade erstellten User aus der Datenbank
    dbhelper.getNodeById(result[0].u._id, function (err, node) {
      if (err) return callback(err);
      // erstelle neue Userinstanz und gib diese zurück
      var u = new User(node[0].u);
      callback(null, u);
    });
  });

};

// Instanzmethoden

/**
 * @function Gibt alle Kommentare dieses Users zurück
 */
User.prototype.comments = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {uuid}}-[:CREATED]->(c:Comment)',
    'RETURN c'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    var c = new Comment(result[0].c);
    callback(null, c);
  });

};

/**
 * @function Gibt alle Infos zurück, die dieser User erstellt hat
 */
User.prototype.infos = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {uuid}})-[:CREATED]->(i:Info)',
    'RETURN i'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    result = result.map(function(i) {
      return new Info(i.i);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle Aufgaben zurück, die dieser User erstellt hat
 */
User.prototype.ownTasks = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {uuid}})-[:CREATED]->(t:Task)',
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
    result = result.map(function(i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle Aufgaben zurück, die dieser User bearbeitet hat (egal ob Lösung bewertet oder nicht)
 */
User.prototype.solvedTasks = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {uuid}})-[:CREATED]->(s:Solution)-[:SOLVES]->(t:Task)',
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
    result = result.map(function(i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};


/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
User.prototype.addMetadata = function (apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/users/' + encodeURIComponent(this.uuid);
  this._node.ref = base;
  this._node.comments = base + '/comments';
  this._node.ownTasks = base + '/tasks/created';
  this._node.solvedTasks = base + '/tasks/solved';
  this._node.infos = base + '/infos';

};
