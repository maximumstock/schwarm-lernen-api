'use strict';

/**
 * @file Basisprototyp für alle weiteren Datenmodelle.
 */

/**
 * @function Konstruktor
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Node = module.exports = function Node(_node) {

  var self = this;

  // Speichern der Node als Instanzvariable
  // Dadurch werden alle Labels und Properties aus der Datenbank in diesem Objekt gespeichert
  this.labels = _node.labels;
  this.properties = _node.properties;

  // Alle Nodes (aber vor allem die Content-Nodes A, L, I) können zwischen 3 Stati wechseln
  // `active` sind alle Nodes standardmäßig, quasi Normalfall
  // `unfinished` sind alle Aufgaben, Lösungen und Infos die nicht expliziert finialisiert wurden
  // `inactive` sind alle deaktivierten Inhalte
  this.properties.status = 'active';
  if(!this.isFinished()) this.properties.status = 'unfinished';
  if(!this.isActive()) this.properties.status = 'inactive';
};

var moment = require('moment');
var config = require('../config/config');
var neo4j = require('neo4j');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

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
 * @function Helferfunktion, die eine `unfinished` Aufgabe, Lösung oder Info in den `finished`-Status bringt
 */
Node.prototype.finalize = function(cb) {

  var self = this;

  if(self.isFinished()) {
    // falls die Node bereits `finished` ist -> Node einfach wieder zurückgeben
    return cb(null, this);
  }

  var query = [
    'MATCH (n:Unfinished {uuid: {nodeUUID}})',
    'REMOVE n:Unfinished'
  ].join('\n');

  var params = {
    nodeUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, cb);

};

/**
 * @function Helferfunktion, die überpürft, ob eine Node ein Rating ist
 */
Node.prototype.isRating = function() {
  return this.labels.indexOf('Rating') > -1;
};

/**
 * @function Helferfunktion, die überprüft, ob eine Node `unfinished` ist, sprich eine noch nicht öffentlich zugängliche Aufgabe, Lösung oder Info
 */
Node.prototype.isFinished = function() {
  return this.labels.indexOf('Unfinished') === -1;
};

/**
 * @function Helferfunktion die überprüft ob eine Node ein User oder eine Aufgabe, Lösung oder Information ist
 */
Node.prototype.isToggable = function() {

  return this.labels.indexOf('Task') > -1 || this.labels.indexOf('Solution') > -1 || this.labels.indexOf('Info') > -1 || this.labels.indexOf('User') > -1;

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
 * @function Vorlage für für die `getParentTarget` Funktion aller von `Node` abgeleiteten Prototypen
 * Um später innerhalb der API feststellen zu können ob ein User Zugriff auf eine Ressource hat,
 * müssen alle Ressourcenprototypen die Methode `getParentTarget` implementieren. Um etwaige verpasste
 * Implementierungen abzufangen gibt es hier eine vererbte Implementierung, welche den Server
 * crashen lässt.
 */
Node.prototype.getParentTarget = function() {

  var err = new Error('Dieser Prototyp hat die Funktion `getParentTarget` noch nicht implementiert. Crash!');
  console.log(err, this);
  throw err;

};


/**
 * @function Fügt von der aktuellen Node zum User {userUUID} eine [:GIVES_PRESTIGE {prestige: <integer>}] Relationship, durch die der jeweilige Nutzer Prestige erhält
 * Der Einfachheit halber ist die Einsetzbarkeit dieser Funktion nicht auf bestimmte Datenmodelle begrenzt, sprich auch lernziele könnten Usern Punkte geben, was eigentlich keinen Sinn macht (BEWARE!?)
 * @param {string} userUUID Der User der Prestige erhalten soll
 * @param {object} properties Objekt mit Attributen für die Relation
 */
Node.prototype.givePrestigeTo = function(userUUID, properties, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}}), (n {uuid: {nodeUUID}})',
    'CREATE UNIQUE (u)<-[:GIVES_PRESTIGE {properties}]-(n)'
  ].join('\n');

  var params = {
    userUUID: userUUID,
    properties: properties,
    nodeUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, cb);

};


/**
 * @function Fügt von der aktuellen Node zum User {userUUID} eine [:GIVES_POINTS {points: <integer>}] Relationship, durch die der jeweilige Nutzer Punkte erhält
 * Der Einfachheit halber ist die Einsetzbarkeit dieser Funktion nicht auf bestimmte Datenmodelle begrenzt, sprich auch Lernziele könnten Usern Punkte geben, was eigentlich keinen Sinn macht (BEWARE!?)
 * @param {string} userUUID Der User der Punkte erhalten soll
 * @param {object} properties Objekt mit Attributen für die Relation
 */
Node.prototype.givePointsTo = function(userUUID, properties, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}}), (n {uuid: {nodeUUID}})',
    'CREATE UNIQUE (u)<-[:GIVES_POINTS {properties}]-(n)'
  ].join('\n');

  var params = {
    userUUID: userUUID,
    nodeUUID: self.uuid,
    properties: properties
  };

  db.cypher({
    query: query,
    params: params
  }, cb);

};

/**
 * @function Fügt von der aktuellen Node zum User {userUUID} eine [:COSTS_POINTS {points: <integer>}] Relationship, durch die der jeweilige Nutzer Punkte verliert
 * Der Einfachheit halber ist die Einsetzbarkeit dieser Funktion nicht auf bestimmte Datenmodelle begrenzt, sprich auch Lernziel könnten Usern Punkte kosten, was eigentlich keinen  Sinn macht (BEWARE!?)
 * @param {string} userUUID Der User der Punkte bezahlen soll
 * @param {object} properties Objekten mit Attributen für die Relation
 */
Node.prototype.takePointsFrom = function(userUUID, properties, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}}), (n {uuid: {nodeUUID}})',
    'CREATE UNIQUE (u)<-[:COSTS_POINTS {properties}]-(n)'
  ].join('\n');

  var params = {
    userUUID: userUUID,
    nodeUUID: self.uuid,
    properties: properties
  };

  db.cypher({
    query: query,
    params: params
  }, cb);

};
