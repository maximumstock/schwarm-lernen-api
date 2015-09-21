'use strict';

/**
 * @file Basisprototyp für alle weiteren Datenmodelle.
 */

var moment = require('moment');
var config = require('../config/config');
var neo4j = require('neo4j');


var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

/**
 * @function Konstruktor
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Node = module.exports = function Node(_node) {
  // Speichern der Node als Instanzvariable
  // Dadurch werden alle Labels und Properties aus der Datenbank in diesem Objekt gespeichert
  this.labels = _node.labels;
  this.properties = _node.properties;

  this.properties.status = this.isActive() ? 'active' : 'inactive';
};

var Comment = require('./comment');

// Öffentliche Konstanten

// Öffentliche Instanzvariablen mit Gettern und Settern
/**
 * @function Propertydefinition für die UUID der Node
 * @prop {string} uuid UUID der Node
 */
Object.defineProperty(Node.prototype, 'uuid', {
  get: function () {
    return this.properties.uuid;
  }
});

/**
 * @function Liefert alle Kommentare einer Node, falls welche bestehen
 */
Node.prototype.getComments = function(callback) {

  var self = this;

  var query = [
    'MATCH (n {uuid: {selfUUID}})<-[r:BELONGS_TO]-(c:Comment)',
    'RETURN c'
  ].join('\n');

  var params = {
    selfUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    var comments = result.map(function(i) {
      return new Comment(i.c);
    });
    callback(null, comments);
  });

};


/**
 * @function Liefert alle Bewertungen einer Node, falls welche bestehen
 */
Node.prototype.getRating = function(callback) {

  var self = this;

  var query = [
    'MATCH (n {uuid: {selfUUID}})<-[r:RATES]-(u:User)',
    'RETURN r, u'
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
      return {
        r1: i.r.properties.r1,
        r2: i.r.properties.r2,
        r3: i.r.properties.r3,
        r4: i.r.properties.r4,
        r5: i.r.properties.r5,
        comment: i.r.properties.comment,
        author: i.u.properties.username,
        authorUUID: i.u.properties.uuid
      };
    });

    callback(null, {
      ratings: ratings,
      votes: result.length
    });
  });

};

/**
 * @function Helferfunktion die überprüft ob eine Node eine Aufgabe, Lösunge oder Information ist
 */
Node.prototype.isToggable = function() {

  return this.labels.indexOf('Task') > -1 || this.labels.indexOf('Solution') > -1 || this.labels.indexOf('Info') > -1;

};

/**
 * @function Helferfunktion die überprüft ob eine Node aktiv ist
 */
Node.prototype.isActive = function() {

  return this.labels.indexOf('Inactive') === -1;

};

/**
 * @function Helferfunktion die die Node inaktive toggled indem sie das Label `Inactive` hinzufügt
 */
Node.prototype.toggleInactive = function(cb) {

  var self = this;

  var query = [
    'MATCH (n {uuid: {uuid}})',
    'SET n:Inactive'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    cb(err, null);
  });

};

/**
 * @function Helferfunktion die die Node aktiv toggled indem sie das Label `Inactive` entfernt
 */
Node.prototype.toggleActive = function(cb) {

 var self = this;

 var query = [
   'MATCH (n {uuid: {uuid}})',
   'REMOVE n:Inactive'
 ].join('\n');

 var params = {
   uuid: self.uuid
 };

 db.cypher({
   query: query,
   params: params
 }, function(err, result) {
   cb(err, null);
 });

};

/**
 * @function Toggled den Aktivitätsstatus der Node, falls es sich um Aufgaben, Lösungen oder Informationen handelt
 */
Node.prototype.toggle = function(callback) {

  // Falls es keine Info, Lösung oder Aufgabe ist, einfach das aktuelle Objekt zurückgeben
  if(!this.isToggable()) {
    return callback(null, this);
  }

  // Status togglen
  if(this.isActive()) {
    // inaktiv togglen
    this.toggleInactive(callback);
  } else {
    // aktiv togglen
    this.toggleActive(callback);
  }

};

/**
 * @function Vorlage für für die `getParentDegree` Funktion aller von `Node` abgeleiteten Prototypen
 * Um später innerhalb der API feststellen zu können ob ein User Zugriff auf eine Ressource hat,
 * müssen alle Ressourcenprototypen die Methode `getParentDegree` implementieren. Um etwaige verpasste
 * Implementierungen abzufangen gibt es hier eine vererbte Implementierung, welche den Server
 * crashen lässt.
 */
Node.prototype.getParentDegree = function() {

  var err = new Error('Dieser Prototyp hat die Funktion `getParentDegree` noch nicht implementiert. Crash!');
  console.log(err, this);
  throw err;

};
