/**
 * @file Enthält das Datenmodell und die Businessregeln für Aufgaben.
 */

var neo4j = require('neo4j');
var config = require('../config/config');
var validate = require('../lib/validation/validation');
var errors = require('../lib/errors/errors');
var Solution = require('./solution');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

/**
 * @function Konstruktor für eine Aufgabe
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Task = module.exports = function Task(_node) {
  // Speichern der Node als Instanzvariable
  // Dadurch werden alle Labels und Properties aus der Datenbank in diesem Objekt gespeichert
  this._node = _node;
  delete this._node._id;
};

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Aufgabe-Nodes für Aufgabe#create
Task.VALIDATION_INFO = {
  description: {
    required: true,
    minLength: 20,
    message: 'Muss eine Beschreibung haben.'
  }
};

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function Propertydefinition für die Beschreibung der Aufgabe
 * @prop {string} description Beschreibung der Aufgabe
 */
Object.defineProperty(Task.prototype, 'description', {
  get: function() {
    return this._node.properties['description'];
  }
});

/**
 * @function Propertydefinition für die UUID der Aufgabe
 * @prop {string} uuid UUID der Aufgabe
 */
Object.defineProperty(Task.prototype, 'uuid', {
  get: function() {
    return this._node.properties['uuid'];
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Aufgaben
 * @param {string} uuid UUID der gesuchten Aufgabe
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Task.get = function(uuid, callback) {

  var query = [
    'MATCH (a:Task {uuid: {uuid}})',
    'RETURN a'
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
      err = new Error('Es wurde keine Aufgabe `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'AufgabeNotFound';
      return callback(err);
    }
    // erstelle neue Aufgabe-Instanz und gib diese zurück
    var a = new Task(result[0]['a']);
    callback(null, a);
  });

}

/**
 * @function get Statische Gettermethode für ALLE Aufgaben
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Task.getAll = function(callback) {

  var query = [
    'MATCH (a:Task)',
    'RETURN a'
  ].join('\n');

  db.cypher({
    query: query
  }, function(err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Aufgaben aus dem Ergebnisdokument
    var aufgaben = [];
    result.forEach(function(e) {
      var m = new Task(e['a']);
      aufgaben.push(m);
    });

    callback(null, aufgaben);
  });

}

/**
 * @function
 * @name create Erstellt eine neue Aufgabe und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} parentUUID UUID der Parent-Node, an die die Aufgabe gehängt werden soll
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
Task.create = function(properties, parentUUID, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(Task.VALIDATION_INFO, properties, true);
  } catch(e) {
    return callback(e);
  }

  // validate

  var query = [
    'MATCH (dt:Target {uuid: {parent}})',
    'CREATE (a:Task {properties})',
    'CREATE UNIQUE (a)<-[r:HAS_TASK]-(dt)',
    'return a'
  ].join('\n');

  var params = {
    properties: properties,
    parent: parentUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if (err) return callback(err);

    // falls es kein Ergebnis gibt wurde die neue Aufgabe nicht erstellt da es keinen passenden Parent zu `parentUUID` gibt
    if(result.length === 0) {
      err = new Error('Es gibt kein gültiges Lernziel als Parent mit der UUID `' + parentUUID + '`');
      err.status = 404;
      err.name = 'ParentNotFound'

      return callback(err);
    }

    // hole gerade erstellte Aufgabe aus der Datenbank
    db.cypher({
      query: 'MATCH (a:Task) where ID(a) = {id} RETURN a',
      params: {
        id: result[0]['a']._id
      }
    }, function(err, result) {
      if(err) return callback(err);
      // erstelle neue Aufgabeninstanz und gib diese zurück
      var a = new Task(result[0]['a']);
      callback(null, a);
    });

  });

};

// Instanzmethoden

/**
 * @function
 * @name del Löscht eine bestehende Aufgabe und seine Verbindung nach "oben" (zum übergeordneten Target) aus der Datenbank
 * @param {callback} callback Callbackfunktion, die die gelöschte Node engegennimmt
 */
Task.prototype.del = function(callback) {

  var self = this;

  var query = [
    'MATCH (a:Task {uuid: {uuid}})<-[r:HAS_TASK]-(o)', // Aufgabe hängt immer an einem Target
    'DELETE t, r'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    // Keine Neo4J-Node kann gelöscht werden, falls noch Relationships daran hängen
    if(err instanceof neo4j.DatabaseError &&
       err.neo4j.code === 'Neo.DatabaseError.Transaction.CouldNotCommit') {

      err = new Error('An der Aufgabe `'+self.uuid+'` hängen noch Beziehungen.');
      err.name = 'RemainingRelationships';
      err.status = 409;

    }

    if(err) return callback(err);
    // gib `null` zurück (?!)
    callback(null, null); // success
  })

};

/**
 * @function
 * @name patch Aktualisiert die jeweilige Node mit neuen Informationen
 * @param {object} properties Objekt mit Attribute deren Werte aktualisiert bzw.
 * deren Key-Value-Paare angelegt werden sollen, falls sie nicht bereits bestehen.
 * Ändert nur die Attribute der Node und nicht deren Beziehungen (siehe #changeParent)
 * @param {callback} callback Callbackfunktion, die die aktualisierte Node entgegennimmt
 */
Task.prototype.patch = function(properties, callback) {

  var self = this;

  try {
    var safeProps = validate.validate(Task.VALIDATION_INFO, properties, false); // `false` da SET +=<--
  } catch(e) {
    return callback(e);
  }

  query = [
    'MATCH (a:Task {uuid: {uuid}})',
    'SET a += {properties}',
    'RETURN a'
  ].join('\n')

  var params = {
    uuid: self.uuid,
    properties: safeProps
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if(err) return callback(err);

    if(result.length === 0) {
      err = new Error('Es konnte keine passende Aufgabe gefunden werden');
      err.status = 404;
      err.name = 'AufgabeNotFound';

      return callback(err);
    }

    // aktualisierte Aufgabeninstanz erzeugen und zurückgeben
    var a = new Task(result[0]['a']);
    callback(null, a);

  });

};


/**
 * @function Löscht die alte Parent-Beziehung zwischen dieser Aufgaben und dessen Lernziel und
 * erstellt eine neue Beziehung zwischen dieser Aufgabe und dem angegebenen Lernziel
 * @param {string} newParent UUID der neuen Parent-Node
 */
Task.prototype.changeParent = function(newParent, callback) {

  var self = this;

  var query = [
    'MATCH (a:Task {uuid: {uuid}}), (p:Target {uuid: {parent}})',
    'OPTIONAL MATCH (a)<-[r:HAS_TARGET]-(oldp:Target)',
    'DELETE r',
    'CREATE UNIQUE (a)<-[newr:HAS_TARGET]-(p)',
    'RETURN a'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    parent: newParent
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if(err) return callback(err);
    callback(null, result);

  });

};

/**
 * @function Gibt alle zugehörigen Lösungen zu dieser Aufgabe zurück
 */
Task.prototype.solutions = function(callback) {

  var self = this;

  var query = [
    'MATCH (a:Task {uuid: {uuid}})<-[r:SOLVES]-(s:Solution)',
    'RETURN s'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if(err) return callback(err);
    var solutions = [];
    result.forEach(function(i) {
      solutions.push(new Solution(i['s']));
    });
    callback(null, solutions);

  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Task.prototype.addMetadata = function(apiVersion) {

  apiVersion = apiVersion || '';
  var base = apiVersion + '/tasks/' + encodeURIComponent(this.uuid);
  this._node.ref = base;
  this._node.solutions = base + '/solutions';
  this._node.parent = base + '/parent';

}
