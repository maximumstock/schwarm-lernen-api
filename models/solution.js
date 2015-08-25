/**
 * @file Enthält das Datenmodell und die Businessregeln für Lösungen.
 */

var neo4j = require('neo4j');
var config = require('../config/config');
var validate = require('../lib/validation/validation');
var errors = require('../lib/errors/errors');
var Task = require('./task');
//var Review = require('./review');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

/**
 * @function Konstruktor für eine Lösung
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Solution = module.exports = function Solution(_node) {
  // Speichern der Node als Instanzvariable
  // Dadurch werden alle Labels und Properties aus der Datenbank in diesem Objekt gespeichert
  this._node = _node;
  delete this._node._id;
};

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Loesungs-Nodes für Loesung#create
Solution.VALIDATION_INFO = {
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
 * @function Propertydefinition für den Inhalt der Loesung
 * @prop {string} description Textinhalt der Lösung
 */
Object.defineProperty(Solution.prototype, 'description', {
  get: function() {
    return this._node.properties['description'];
  }
});

/**
 * @function Propertydefinition für die UUID der Lösung
 * @prop {string} uuid UUID der Lösung
 */
Object.defineProperty(Solution.prototype, 'uuid', {
  get: function() {
    return this._node.properties['uuid'];
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Lösungen
 * @param {string} uuid UUID der gesuchten Lösung
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Solution.get = function(uuid, callback) {

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})',
    'RETURNs'
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
      err = new Error('Es wurde keine Lösung `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'LoesungNotFound';
      return callback(err);
    }
    // erstelle neue Lösungs-Instanz und gib diese zurück
    var l = new Solution(result[0]['s']);
    callback(null, l);
  });

}

/**
 * @function get Statische Gettermethode für ALLE Lösungen
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Aufgabe.getAll = function(callback) {

  var query = [
    'MATCH (s:Solutions)',
    'RETURN s'
  ].join('\n');

  db.cypher({
    query: query
  }, function(err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Aufgaben aus dem Ergebnisdokument
    var loesungen = [];
    result.forEach(function(e) {
      var l = new Solution(e['s']);
      loesungen.push(l);
    });

    callback(null, loesungen);
  });

}

/**
 * @function
 * @name create Erstellt eine neue Lösung und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} taskUUID UUID der Aufgaben-Node für die die Lösung gilt
 * @param {string} userUUID UUID des Users, der die Lösung angefertigt hat
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
Solution.create = function(properties, taskUUID, userUUID, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(Solution.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  // validate

  var query = [
    'MATCH (a:Task {uuid: {task}}), (u:User {uuid: {author}})',
    'CREATE (s:Solution {properties})',
    'CREATE UNIQUE (a)<-[r:SOLVES]-(s)<-[r2:HAS_SOLUTION]-(u)',
    'return s'
  ].join('\n');

  var params = {
    properties: properties,
    task: taskUUID,
    author: userUUID

  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if (err) return callback(err);

    // falls es kein Ergebnis gibt wurde die neue Lösung nicht erstellt da es keinen passenden Autor oder Aufgabe gibt
    if (result.length === 0) {
      err = new Error('Der Benutzer `' + userUUID + '` oder die Aufgabe `' + taskUUID + '` existieren nicht');
      err.status = 404;
      err.name = 'TaskOrUserNotFound'

      return callback(err);
    }

    // hole gerade erstellte Lösung aus der Datenbank
    db.cypher({
      query: 'MATCH (s:Solution) where ID(s) = {id} RETURN s',
      params: {
        id: result[0]['s']._id
      }
    }, function(err, result) {
      if (err) return callback(err);
      // erstelle neue Lösungsinstanz und gib diese zurück
      var l = new Solution(result[0]['s']);
      callback(null, l);
    });

  });

};

// Instanzmethoden

/**
 * @function
 * @name del Löscht eine bestehende Lösung
 * @param {callback} callback Callbackfunktion, die die gelöschte Node engegennimmt
 */
// Aufgabe.prototype.del = function(callback) {
//
//   var self = this;
//
//   var query = [
//     'MATCH (a:Task {uuid: {uuid}})<-[r:HAS_TASK]-(o)', // Aufgabe hängt immer an einem Target
//     'DELETE t, r'
//   ].join('\n');
//
//   var params = {
//     uuid: self.uuid
//   };
//
//   db.cypher({
//     query: query,
//     params: params
//   }, function(err, result) {
//
//     // Keine Neo4J-Node kann gelöscht werden, falls noch Relationships daran hängen
//     if(err instanceof neo4j.DatabaseError &&
//        err.neo4j.code === 'Neo.DatabaseError.Transaction.CouldNotCommit') {
//
//       err = new Error('An der Aufgabe `'+self.uuid+'` hängen noch Beziehungen.');
//       err.name = 'RemainingRelationships';
//       err.status = 409;
//
//     }
//
//     if(err) return callback(err);
//     // gib `null` zurück (?!)
//     callback(null, null); // success
//   })
//
// };
//
// /**
//  * @function
//  * @name patch Aktualisiert die jeweilige Node mit neuen Informationen
//  * @param {object} properties Objekt mit Attribute deren Werte aktualisiert bzw.
//  * deren Key-Value-Paare angelegt werden sollen, falls sie nicht bereits bestehen.
//  * Ändert nur die Attribute der Node und nicht deren Beziehungen (siehe #changeParent)
//  * @param {callback} callback Callbackfunktion, die die aktualisierte Node entgegennimmt
//  */
// Aufgabe.prototype.patch = function(properties, callback) {
//
//   var self = this;
//
//   try {
//     var safeProps = validate.validate(Aufgabe.VALIDATION_INFO, properties, false); // `false` da SET +=<--
//   } catch(e) {
//     return callback(e);
//   }
//
//   query = [
//     'MATCH (a:Task {uuid: {uuid}})',
//     'SET a += {properties}',
//     'RETURN a'
//   ].join('\n')
//
//   var params = {
//     uuid: self.uuid,
//     properties: safeProps
//   };
//
//   db.cypher({
//     query: query,
//     params: params
//   }, function(err, result) {
//
//     if(err) return callback(err);
//
//     if(result.length === 0) {
//       err = new Error('Es konnte keine passende Aufgabe gefunden werden');
//       err.status = 404;
//       err.name = 'AufgabeNotFound';
//
//       return callback(err);
//     }
//
//     // aktualisierte Aufgabeninstanz erzeugen und zurückgeben
//     var a = new Aufgabe(result[0]['a']);
//     callback(null, a);
//
//   });
//
// };



/**
 * @function Löscht die alte Parent-Beziehung zwischen dieser Aufgaben und dessen Lernziel und
 * erstellt eine neue Beziehung zwischen dieser Aufgabe und dem angegebenen Lernziel
 * @param {string} newParent UUID der neuen Parent-Node
 */
// Aufgabe.prototype.changeParent = function(newParent, callback) {
//
//   var self = this;
//
//   var query = [
//     'MATCH (a:Task {uuid: {uuid}}), (p:Target {uuid: {parent}})',
//     'OPTIONAL MATCH (a)<-[r:HAS_TARGET]-(oldp:Target)',
//     'DELETE r',
//     'CREATE UNIQUE (a)<-[newr:HAS_TARGET]-(p)',
//     'RETURN a'
//   ].join('\n');
//
//   var params = {
//     uuid: self.uuid,
//     parent: newParent
//   };
//
//   db.cypher({
//     query: query,
//     params: params
//   }, function(err, result) {
//
//     if(err) return callback(err);
//     callback(null, result);
//
//   });
//
// };

/**
 * @function Gibt zugehörige Aufgabe zu dieser Lösung zurück
 */
Solution.prototype.task = function(callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})-[r:SOLVES]->(a:Task)',
    'RETURN a'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if (err) return callback(err);
    var a = new Aufgabe(result[0]['a']);
    callback(null, a);

  });

};

/**
 * @function Gibt den Autor zurück
 */
Solution.prototype.author = function(callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})<-[:HAS_SOLUTION]-(u:User)',
    'RETURN u'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if (err) return callback(err);
    var u = new User(result[0]['u']);
    callback(null, u);
  })

};

/**
 * @function Gibt alle Reviews zu dieser Lösung zurück
 */
Solution.prototype.reviews = function(callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution {uuid: {uuid}})<-[:RATES_SOLUTION]-(r:Review)',
    'RETURN r'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if (err) return callback(err);

    var reviews = [];
    result.forEach(function(r) {
      reviews.push(new Review(result[0]['r']));
    });
    callback(null, reviews);
  })

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Solution.prototype.addMetadata = function(apiVersion) {

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/solutions/' + encodeURIComponent(this.uuid);
  this._node.ref = base;
  this._node.author = base + '/author';
  this._node.reviews = base + '/reviews';
  this._node.task = base + '/task';

}
