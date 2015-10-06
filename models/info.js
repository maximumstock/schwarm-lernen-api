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
var indicative = require('indicative');
var validator = new indicative();
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');
var Target = require('./target');
var User = require('./user');
var Rating = require('./rating');


var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Info.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Info-Nodes für Info#create
Info.VALIDATION_RULES = {
  description: 'required|string|max:200',
  sources: 'required|string|max:1000',
  text: 'required|string|max:2000'
};

Info.PROTECTED_ATTRIBUTES = ['uuid', 'createdAt', 'author', 'target'];

// Öffentliche Instanzvariablen mit Gettern und Settern

Object.defineProperty(Info.prototype, 'description', {
  get: function () {
    return this.properties.description;
  }
});

Object.defineProperty(Info.prototype, 'author', {
  get: function () {
    return this.properties.author;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function Statische Gettermethode für Infos
 * @param {string} uuid UUID der gesuchten Info
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
 * @function Statische Gettermethode für ALLE Infos
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
 * @function Erstellt eine neue Info und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} targetUUID UUID der Lernziel-Node für die die Info gilt
 * @param {string} userUUID UUID des Users, der die Info angefertigt hat
 */
Info.create = function (properties, targetUUID, userUUID, callback) {

  // Validierung
  validator
    .validate(Info.VALIDATION_RULES, properties)
    .then(function() {

      properties.createdAt = moment().format('X');
      properties.author = userUUID;
      properties.target = targetUUID;

      var query = [
        'MATCH (a:Target {uuid: {target}}), (u:User {uuid: {author}})',
        'CREATE (i:Info:Unfinished {properties})',
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
          err = new Error('Das Lernziel `' + targetUUID + '` existiert nicht');
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

    })
    .catch(function(errors) {
      return callback(errors);
    });

};

// Instanzmethoden

/**
 * @function Aktualisiert die Info mit den Daten aus dem {properties} Objekt
 * @param {object} properties Objekt mit neuen Daten für die Info
 */
Info.prototype.patch = function(properties, cb) {

  var self = this;

  Info.PROTECTED_ATTRIBUTES.forEach(function(i) {
    if(properties.hasOwnProperty(i)) delete properties[i];
  });

  properties.changedAt = moment().format('X');

  // Validierung
  validator
    .validate(Info.VALIDATION_RULES, properties)
    .then(function() {

      var query = [
        'MATCH (i:Info:Unfinished {uuid: {infoUUID}})',
        'SET i += {properties}',
        'RETURN i'
      ].join('\n');

      var params = {
        infoUUID: self.uuid,
        properties: properties
      };

      db.cypher({
        query: query,
        params: params
      }, function(err, result) {
        if(err) return cb(err);
        if(result.length === 0) {
          // Info `infoUUID` existiert nicht oder ist nicht mehr veränderbar
          err = new Error('Die Info `'+self.uuid+'` existiert nicht oder ist nicht mehr änderbar');
          err.status = 409;
          err.name = 'AlreadySubmitted';
          return cb(err);
        }
        var info = new Info(result[0].i);
        return cb(null, info);
      });

    })
    .catch(function(err) {
      return cb(err);
    });

};


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
Info.prototype.getParentTarget = function(callback) {

  var self = this;

  var query = [
    'MATCH (i:Info {uuid: {uuid}})-[:BELONGS_TO]->(target:Target)-[:PART_OF *1..]->(et:Target:EntryTarget)',
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
 * @function Liefert alle Bewertungen einer Info, falls welche bestehen
 */
Info.prototype.getRatings = function(callback) {

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
Info.prototype.addMetadata = function (apiVersion) {

  // Autor soll anonym sein
  if(this.properties.author) {
    delete this.properties.author;
  }

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/infos/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  //links.author = apiVersion + '/users/' + encodeURIComponent(this.properties.author);
  links.target = apiVersion + '/targets/' + encodeURIComponent(this.properties.target);
  links.ratings = base + '/ratings';
  links.rating = base + '/rating';
  links.status = base + '/status';
  // falls die Aufgabe `unfinished` ist, kann man sie unter folgender URL abgeben
  if(!this.isFinished()) {
    links.submit = base + '/submit';
  }

  this.links = links;

};
