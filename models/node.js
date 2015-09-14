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
 * @function Liefert alle Kommentare einer Node, falls welche bestehen
 */
Node.prototype.getRating = function(callback) {

  var self = this;

  var query = [
    'MATCH (n {uuid: {selfUUID}})<-[r:RATES]-(u:User)',
    'RETURN avg(r.rating) as rating, length(collect(r)) as votes'
  ].join('\n');

  var params = {
    selfUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    callback(null, {
      rating: result[0].rating,
      votes: result[0].votes
    });
  });

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
