'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Lernziele (Lernziel/LZ abgekürtz).
 */

 /**
  * @function Konstruktor für ein Lernziel
  * @constructs
  * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
  */
  var Target = module.exports = function Target(_node) {
    Node.apply(this, arguments);
  };

var neo4j = require('neo4j');
var config = require('../config/config');
var indicative = require('indicative');
var validator = new indicative();
var dbhelper = require('../lib/db');
var moment = require('moment');

var Node = require('./node');
var Degree = require('./degree');
var Task = require('./task');
var Info = require('./info');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Target.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Lernziel-Nodes für Lernziel#create
Target.VALIDATION_RULES = {
  name: 'required|string|alpha_numeric'
};

Target.PROTECTED_ATTRIBUTES = ['createdAt'];

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function Propertydefinition für den Namen des Lernziels
 * @prop {string} name Name des Lernziel
 */
Object.defineProperty(Target.prototype, 'name', {
  get: function() {
    return this._node.properties.name;
  }
});

/**
 * @function Propertydefinition für die UUID des Parents des Lernziels
 * @prop {string} uuid UUID des Parents des Lernziels
 */
Object.defineProperty(Target.prototype, 'parent', {
  get: function() {
    return this._node.properties.parent;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für Lernziele
 * @param {string} uuid UUID des gesuchten Lernziels
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Target.get = function(uuid, callback) {

  var query = [
    'MATCH (t:Target {uuid: {uuid}})-[r:PART_OF]->(p)',
    'RETURN t, p'
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
      err = new Error('Es wurde kein Lernziel `' + uuid + '` gefunden');
      err.status = 404;
      err.name = 'TargetNotFound';
      return callback(err);
    }
    // erstelle neue Lernziel-Instanz und gib diese zurück
    var t = new Target(result[0].t);
    callback(null, t);
  });

};

/**
 * @function get Statische Gettermethode für ALLE Lernziele
 * @param {callback} callback Callbackfunktion, die das Ergebnis entgegennimmt
 */
Target.getAll = function(callback) {

  var query = [
    'MATCH (t:Target)',
    'RETURN t'
  ].join('\n');

  db.cypher({
    query: query
  }, function(err, result) {
    if (err) return callback(err);

    // Erstelle ein Array von Lernzielen aus dem Ergebnisdokument
    var lernziele = result.map(function(e) {
      return new Target(e.t);
    });

    callback(null, lernziele);
  });

};

/**
 * @function
 * @name create Erstellt eine neues Lernziel und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} parentUUID UUID der Parent-Node, an die das Lernziel gehängt werden soll
 * @param {callback} callback Callbackfunktion, die die neu erstellte Node entgegennimt
 */
Target.create = function(properties, parentUUID, callback) {

  // Validierung
  validator
    .validate(Target.VALIDATION_RULES, properties)
    .then(function() {

      properties.createdAt = parseInt(moment().format('X'));

      var query = [
        'MATCH (dt {uuid: {parent}})',
        'WHERE (dt:Degree) or (dt:Target)', // Targets sind nur mit anderen Targets oder Degrees verbunden
        'MERGE (t:Target {name: {name}})-[r:PART_OF]->(dt)',
        'ON CREATE SET t = {properties}',
        'return t'
      ].join('\n');

      var params = {
        properties: properties,
        name: properties.name,
        parent: parentUUID
      };

      db.cypher({
        query: query,
        params: params
      }, function(err, result) {

        if (err) return callback(err);

        // falls es kein Ergebnis gibt wurde das neue Lernziel nicht erstellt da es keinen passenden Parent zu `parentUUID` gibt
        if(result.length === 0) {
          err = new Error('Es gibt keinen gültigen Studiengang/kein gültiges Lernziel als Parent mit der UUID `' + parentUUID + '`');
          err.status = 404;
          err.name = 'ParentNotFound';

          return callback(err);
        }

        // hole gerade erstelles Lernziel aus der Datenbank
        var id = result[0].t._id;
        dbhelper.getNodeByID(id, function(err, node) {
          if(err) return callback(err);
          // erstelle neue Lernzielinstanz und gib diese zurück
          var t = new Target(node);
          callback(null, t);
        });

      });

    })
    .catch(function(errors) {
      return callback(errors);
    });

};

// Instanzmethoden

/**
 * @function
 * @name del Löscht ein bestehendes Lernziel und seine Verbindung nach "oben" (zum übergeordneten Target/Studiengang) aus der Datenbank
 * @param {callback} callback Callbackfunktion, die die gelöschte Node engegennimmt
 */
Target.prototype.del = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}})-[r:PART_OF]->(o)', // Target hängt immer an etwas
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

      err = new Error('Am Lernziel `'+self.name+'` hängen noch Beziehungen.');
      err.name = 'RemainingRelationships';
      err.status = 409;

    }

    if(err) return callback(err);
    // gib `null` zurück (?!)
    callback(null, null); // success
  });

};

/**
 * @function
 * @name patch Aktualisiert die jeweilige Node mit neuen Informationen
 * @param {object} properties Objekt mit Attribute deren Werte aktualisiert bzw.
 * deren Key-Value-Paare angelegt werden sollen, falls sie nicht bereits bestehen.
 * Ändert nur die Attribute der Node und nicht deren Beziehungen (siehe #changeParent)
 * @param {callback} callback Callbackfunktion, die die aktualisierte Node entgegennimmt
 */
Target.prototype.patch = function(properties, callback) {

  var self = this;

  Target.PROTECTED_ATTRIBUTES.forEach(function(i) {
    if(properties.hasOwnProperty(i)) delete properties[i];
  });

  properties.changedAt = parseInt(moment().format('X'));

  var query = [
    'MATCH (t:Target {uuid: {uuid}})',
    'SET t += {properties}',
    'RETURN t'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    properties: properties
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {

    if(err) return callback(err);

    if(result.length === 0) {
      err = new Error('Es konnte kein passendes Lernziel gefunden werden');
      err.status = 404;
      err.name = 'TargetNotFound';

      return callback(err);
    }

    // aktualisierte Lernzielinstanz erzeugen und zurückgeben
    var t = new Target(result[0].t);
    callback(null, t);

  });

};

/**
 * @function Liefert eine bestimmte Aufgabe unter diesem Lernziel
 * @param {string} taskUUID UUID der gesuchten Aufgabe
 */
Target.prototype.getTaskByID = function(taskUUID, callback) {

  var self = this;

  var query = [
    'MATCH (target:Target {uuid: {targetUUID}})<-[:BELONGS_TO]-(t:Task {uuid: {taskUUID}})',
    'RETURN t'
  ].join('\n');

  var params = {
    targetUUID: self.uuid,
    taskUUID: taskUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    if(result.length === 0) {
      err = new Error('Es konnte keine Aufgabe `' + taskUUID + '` unter dem Lernziel `' + self.uuid + '`gefunden werden');
      err.status = 404;
      err.name = 'TaskNotFound';
      return callback(err, null);
    }
    callback(null, new Task(result[0].t));
  });

};

/**
 * @function Liefert eine bestimmte Info unter diesem Lernziel
 * @param {string} infoUUID UUID der gesuchten Info
 */
Target.prototype.getInfoByID = function(infoUUID, callback) {

  var self = this;

  var query = [
    'MATCH (target:Target {uuid: {targetUUID}})<-[:BELONGS_TO]-(i:Info {uuid: {infoUUID}})',
    'RETURN i'
  ].join('\n');

  var params = {
    targetUUID: self.uuid,
    infoUUID: infoUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    if(result.length === 0) {
      err = new Error('Es konnte keine Info `' + infoUUID + '` unter dem Lernziel `' + self.uuid + '`gefunden werden');
      err.status = 404;
      err.name = 'InfoNotFound';
      return callback(err, null);
    }
    callback(null, new Info(result[0].i));
  });

};


/**
 * @function Löscht die alte Parent-Beziehung zwischen diesem Lernziel und einem anderen Lernziel/Studiengang und
 * erstellt eine neue Beziehung zwischen diesem Lernziel und der angegeben Node
 * @param {string} newParent UUID der neuen Parent-Node
 */
Target.prototype.changeParent = function(newParent, callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}}), (p {uuid: {parent}})',
    'OPTIONAL MATCH (t)-[r:PART_OF]->(oldp)',
    'DELETE r',
    'SET t.changedAt = {changedAt}',
    'CREATE UNIQUE (t)-[newr:PART_OF]->(p)',
    'RETURN t'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    parent: newParent,
    changedAt: parseInt(moment().format('X'))
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
 * @function Gibt die Parent-Node des Lernziels zurück
 */
Target.prototype.getParent = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}})-[:PART_OF]->(dt)',
    'RETURN dt'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, parents) {

    if(err) return callback(err);
    // Normalerweise sollte es eh nur ein Parent geben
    var parent = parents[0].dt;
    if(parent.labels.indexOf('Degree') > -1) {
      //var Studiengang = require('./studiengang'); // keine Ahnung warum, anders gehts nicht
      var s = new Degree(parent);
      callback(null, s);
    } else if(parent.labels.indexOf('Target') > -1) {
      var t = new Target(parent);
      callback(null, t);
    } else {
      callback(null, parent);
    }
  });

};

/**
 * @function Gibt direkt unterstellte Nodes des Lernziels zurück
 * Ein Lernziel kann entweder Aufgaben oder weitere Lernziele als Kinder haben
 * @param {number} depth Maximale Tiefe in der Kindbeziehungen gesucht werden sollen
 * @return Objekt mit einem Array pro Kind-Typ (Aufgabe, Lernziel)
 */
Target.prototype.getChildren = function(depth, callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}})<-[*1..'+parseInt(depth)+']-(c)',
    'RETURN c'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, children) {

    if(err) return callback(err);

    // Children nach Label sortieren, also nach `Aufgabe`, `Lernziel`, `Info` etc.
    var tasks = children.filter(function(c) {
      return c.c.labels.indexOf('Task') > -1;
    }).map(function(c) {
      return new Task(c.c);
    });

    var targets = children.filter(function(c) {
      return c.c.labels.indexOf('Target') > -1;
    }).map(function(c) {
      return new Target(c.c);
    });

    var infos = children.filter(function(c) {
      return c.c.labels.indexOf('Info') > -1;
    }).map(function(c) {
      return new Info(c.c);
    });

    callback(null, {
      tasks: tasks,
      targets: targets,
      infos: infos
    });

  });

};

/**
 * @function Gibt alle zugeordneten Infos des Lernziels
 * @return Array von Info-Objekten
 */
Target.prototype.getInfos = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}})<-[:BELONGS_TO]-(i:Info)',
    'RETURN i'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, infos) {

    if(err) return callback(err);

    infos = infos.map(function(i) {
      return new Info(i.i);
    });

    callback(null, infos);

  });

};

/**
 * @function Gibt alle zugeordneten Aufgaben des Lernziels
 * @return Array von Task-Objekten
 */
Target.prototype.getTasks = function(callback) {

  var self = this;

  var query = [
    'MATCH (t2:Target {uuid: {uuid}})<-[:BELONGS_TO]-(t:Task)',
    'RETURN t'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, tasks) {

    if(err) return callback(err);

    tasks = tasks.map(function(i) {
      return new Task(i.t);
    });

    callback(null, tasks);

  });

};

/**
 * @function Gibt alle Aufgaben zurück, die vom User `userUUID` unter diesem Lernziel bearbeitet wurden
 * @param {string} userUUID UUID des Users auf die die Suche beschränkt werden soll
 */
Target.prototype.getSolvedTasksByUser = function(userUUID, callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[:CREATED]->(s:Solution)-[:SOLVES]->(t:Task)-[:BELONGS_TO]->(target:Target {uuid: {targetUUID}})',
    'RETURN t'
  ].join('\n');

  var params = {
    userUUID: userUUID,
    targetUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    result = result.map(function(i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle Aufgaben zurück, die noch nicht bearbeitet wurden
 */
Target.prototype.getUnsolvedTasks = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Task)-[:BELONGS_TO]->(target:Target {uuid: {targetUUID}})',
    'WHERE NOT (t)<-[:SOLVES]-()',
    'RETURN t'
  ].join('\n');

  var params = {
    targetUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    result = result.map(function(i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle Aufgaben zurück, die bearbeitet wurden
 */
Target.prototype.getSolvedTasks = function(callback) {

  var self = this;

  var query = [
    'MATCH (s:Solution)-[:SOLVES]->(t:Task)-[:BELONGS_TO]->(target:Target {uuid: {targetUUID}})',
    'RETURN t'
  ].join('\n');

  var params = {
    targetUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    result = result.map(function(i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle weiteren Lernziele auf {depth}. Ebene des Lernziels
 * @param number {depth} Tiefe der Baumstruktur in der Lernziele gesucht werden sollen
 * @return Array von Lernziel-Objekten
 */
Target.prototype.getTargets = function(depth, callback) {

  var self = this;

  var query = [
    'MATCH (t2:Target {uuid: {uuid}})<-[:PART_OF]-(t:Target)',
    'RETURN t'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, targets) {
    if(err) return callback(err);
    targets = targets.map(function(i) {
      return new Target(i.t);
    });
    callback(null, targets);
  });

};

/**
 * @function Middleware um den Studiengang, zu dem dieses Target gehört, im Request zu speichern
 */
Target.prototype.getParentDegree = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}})-[r]->(d:Degree)',
    'RETURN d'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    callback(null, new Degree(result[0].d));
  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Target.prototype.addMetadata = function(apiVersion) {

  apiVersion = apiVersion || '';
  var base = apiVersion + '/targets/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  links.children = base + '/children';
  links.parent = base + '/parent';
  this.links = links;

};
