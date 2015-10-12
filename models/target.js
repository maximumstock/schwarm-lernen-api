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
var Task = require('./task');
var Info = require('./info');
var Config = require('./config');
var User = require('./user');
var GlobalConfig = require('./globalconfig');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Target.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Lernziel-Nodes für Lernziel#create
Target.VALIDATION_RULES = {
  name: 'required|string|max:50'
};

Target.PROTECTED_ATTRIBUTES = ['uuid', 'createdAt'];

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
 * @function Statische Gettermethode für Lernziele
 * @param {string} uuid UUID des gesuchten Lernziels
 */
Target.get = function(uuid, callback) {

  var query = [
    'MATCH (t:Target {uuid: {uuid}})',
    'RETURN t'
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
 * @function Statische Gettermethode für ALLE Lernziele
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
 * @function Statische Gettermethode für alle Hauptlernziele
 */
Target.getAllEntryTargets = function(cb) {

  var query = [
    'MATCH (t:Target:EntryTarget)',
    'RETURN t'
  ].join('\n');

  db.cypher({
    query: query
  }, function(err, result) {
    if(err) return cb(err);

    var targets = result.map(function(e) {
      return new Target(e.t);
    });
    cb(null, targets);
  });

};

/**
 * @function
 * @name create Erstellt eine neues Lernziel und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 * @param {string} parentUUID UUID der Parent-Node, an die das Lernziel gehängt werden soll
 */
Target.create = function(properties, parentUUID, callback) {

  // Validierung
  validator
    .validate(Target.VALIDATION_RULES, properties)
    .then(function() {

      properties.createdAt = moment().format('X');

      var query = [
        'MATCH (dt:Target {uuid: {parent}})',
        'CREATE (t:Target {properties})',
        'CREATE UNIQUE (t)-[r:PART_OF]->(dt)',
        'return t'
      ].join('\n');

      // falls parentUUID null ist, soll es ein neues EntryTarget werden
      if(!parentUUID) {
        query = [
          'CREATE (t:Target:EntryTarget {properties})',
          'RETURN t'
        ].join('\n');
      }

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
          err = new Error('Es gibt kein gültiges Lernziel als Parent mit der UUID `' + parentUUID + '`');
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
 * @function Löscht ein bestehendes Lernziel und seine Verbindung nach "oben" (zum übergeordneten Target/Studiengang) aus der Datenbank
 */
Target.prototype.del = function(callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}})',
    'OPTIONAL MATCH (t)-[r *1..]-(o)',
    'DELETE t, o',
    'FOREACH(_r in r | DELETE _r)'
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
    callback(null, null); // success
  });

};

/**
 * @function Aktualisiert die jeweilige Node mit neuen Informationen
 * @param {object} properties Objekt mit Attribute deren Werte aktualisiert bzw.
 * deren Key-Value-Paare angelegt werden sollen, falls sie nicht bereits bestehen.
 * Ändert nur die Attribute der Node und nicht deren Beziehungen (siehe #changeParent)
 */
Target.prototype.patch = function(properties, callback) {

  var self = this;

  Target.PROTECTED_ATTRIBUTES.forEach(function(i) {
    if(properties.hasOwnProperty(i)) delete properties[i];
  });

  properties.changedAt = moment().format('X');

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
 * @function Löscht die alte Parent-Beziehung zwischen diesem Lernziel und einem anderen Lernziel/Studiengang und
 * erstellt eine neue Beziehung zwischen diesem Lernziel und der angegeben Node
 * @param {string} newParent UUID der neuen Parent-Node
 */
Target.prototype.changeParent = function(newParent, callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}}), (p:Target {uuid: {parent}})',
    'OPTIONAL MATCH (t)-[r:PART_OF]->(oldp)',
    'DELETE r',
    'SET t.changedAt = {changedAt}',
    'CREATE UNIQUE (t)-[newr:PART_OF]->(p)',
    'RETURN t'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    parent: newParent,
    changedAt: moment().format('X')
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
 * @function Helferfunktion die überprüft ob es sich bei dem Lernziel um ein Hauptlernziel handelt
 * Ein Hauptlernziel ist ein Lernziel, welches alleine stehen kann und nicht an bisherige Lernziele anschließen muss
 * In der Datenbank sind solche Lernziele mit dem Label 'EntryTarget' versehen
 */
Target.prototype.isEntryTarget = function() {
  return this.labels.indexOf('EntryTarget') > -1;
};

/**
 * @function Gibt die Parent-Node des Lernziels zurück
 * @returns null falls es keine Parent-Node gibt
 */
Target.prototype.getParent = function(callback) {

  var self = this;

  // falls dieses Lernziel ein Hauptlernziel ist kann es keine Parent-Node haben
  if(this.isEntryTarget()) {
    return callback(null, null);
  }

  var query = [
    'MATCH (t:Target {uuid: {uuid}})-[:PART_OF]->(dt:Target)',
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
    if(parents.length === 0) {
      return callback(null, null);
    }
    // Normalerweise sollte es eh nur ein Parent geben
    var parent = parents[0].dt;
    var t = new Target(parent);
    callback(null, t);
  });

};

/**
 * @function Gibt direkt unterstellte Nodes des Lernziels zurück
 * Ein Lernziel kann entweder Aufgaben oder weitere Lernziele als Kinder haben
 * @param {number} depth Maximale Tiefe in der Kindbeziehungen gesucht werden sollen
 * @return Objekt mit einem Array pro Kind-Typ (Aufgabe, Info, Lernziel)
 */
Target.prototype.getChildren = function(depth, callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {uuid}})<-[*1..'+parseInt(depth)+']-(c)',
    'WHERE NOT c:Unfinished and NOT c:Unfinished',
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
 * @function Helferfunktion um das Hauptlernziel, zu dem dieses Lernziel gehört, zu erhalten
 */
Target.prototype.getParentEntryTarget = function(callback) {

  var self = this;

  if(self.isEntryTarget()) {
    return callback(null, self);
  }

  var query = [
    'MATCH (t:Target {uuid: {uuid}})-[:PART_OF *0..]->(et:Target:EntryTarget)',
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
 * @function Helferfunktion um das unmittelbar nächste Lernziel, zu dem diese Info gehört, zu erhalten
 */
Target.prototype.getParentTarget = function(callback) {

  var self = this;

  if(self.isEntryTarget()) {
    return callback(null, self);
  }

  var query = [
    'MATCH (t:Target {uuid: {uuid}})-[:PART_OF]->(et:Target)',
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
 * @function Liefert das aktuelle Konfigurationsobjekt für das Lernziel selbst
 * In dieser Konfiguration befinden sich Informationen darüber wieviel Punkte man erhält/bezahlt werden müssen für jede Aktion
 * Jedes Lernziel (Target) hat solch eine Konfiguration oder verwendet die Konfiguration des darüberstehenden Lernziels
 */
Target.prototype.getConfig = function(cb) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {targetUUID}})<-[:BELONGS_TO]-(c:Config)',
    'RETURN c'
  ].join('\n');

  var params = {
    targetUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return cb(err);
    if(result.length === 0) {
      // das Lernziel hat keine eigene Config -> leeres Objekt
      return cb(null, {});
    } else {
      // falls es eine eigene Config hat:
      var config = new Config(result[0].c);
      return cb(null, config);
    }
  });

};

/**
 * @function Liefert die globale Konfiguration unter der dieses lernziel steht.
 */
Target.prototype.getGlobalConfig = function(cb) {

  var self = this;

  self.getParentEntryTarget(function(err, et) {
    if(err) return cb(err);

    var query = [
      'MATCH (t:EntryTarget {uuid: {entryTargetUUID}})<-[:BELONGS_TO]-(gc:GlobalConfig)',
      'RETURN gc'
    ].join('\n');

    var params = {
      entryTargetUUID: et.uuid
    };

    db.cypher({
      query: query,
      params: params
    }, function(err, result) {
      if(err) return cb(err);
      if(result.length === 0) {
        err = new Error('Das Hauptlernziel `'+self.uuid+'` oder dessen globale Konfiguration existiert nicht');
        err.status = 404;
        return cb(err);
      }
      var gc = new GlobalConfig(result[0].gc);
      return cb(null, gc);
    });

  });

};

/**
 * @function Gibt alle User zurück die auf die Daten dieses Lernziel zugreifen können
 */
Target.prototype.getUsers = function (cb) {

  var self = this;

  var query = [
    'MATCH (t:Target:EntryTarget {uuid: {targetUUID}})<-[:HAS_ACCESS]-(u:User)',
    'RETURN u'
  ].join('\n');

  var params = {
    targetUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return cb(err);
    var users = result.map(function(i) {
      return new User(i.u);
    });
    return cb(null, users);
  });

};

/**
 * @function Helferfunktion, die überprüft, ob das Lernziel bereits eine eigene Konfiguration besitzt
 */
Target.prototype.hasConfig = function(cb) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {targetUUID}})<-[:BELONGS_TO]-(c:Config)',
    'RETURN c'
  ].join('\n');

  var params = {
    targetUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    return cb(err, result.length === 0 ? false : true);
  });

};


/**
 * @function Gibt dem User {uuid} Zugriff auf dieses Hauptlernziel
 * Falls es kein Hauptlernziel ist -> Fehler
 * @param {string} userUUID UUID des Users der Zugriff bekommen soll
 * @return true falls erfolgreich
 */
Target.prototype.addUser = function (userUUID, callback) {

  if(!this.isEntryTarget()) {
    var err = new Error('Neue Benutzer können nur zu Hauptlernzielen hinzugefügt werden. Dies ist kein Hauptlernziel.');
    err.status = 409;
    err.name = 'MissingEntryTargetStatus';
    return callback(err);
  }

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}}), (t:Target:EntryTarget {uuid: {targetUUID}})',
    'CREATE UNIQUE (u)-[:HAS_ACCESS]->(t)',
    'RETURN u,t'
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
    if(result.length === 0) {
      err = new Error('Das Lernziel `' + self.uuid + '` oder der User `' + userUUID + '` existiert nicht');
      err.status = 404;
      err.name = 'UserNotFound'; // im Endeffekt kann höchstens der User fehlen, da Target.prototype.addUser()
      return callback(err);
    } else {
      return callback(null, true);
    }
  });

};

/**
 * @function Überprüft ob der User Zugriff auf dieses Lernziel hat
 * @param {string} userUUID UUID des zu überprüfenden Users
 * @returns {boolean} true wenn der User berechtigt ist, andernfalls false
 */
Target.prototype.isAllowedUser = function (userUUID, callback) {

  var self = this;

  var query = [
    'MATCH (t:Target {uuid: {targetUUID}})<-[:HAS_ACCESS]-(u:User {uuid: {userUUID}})',
    'RETURN u'
  ].join('\n');

  var params = {
    targetUUID: self.uuid,
    userUUID: userUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    if(result.length === 0) {
      callback(null, false);
    } else {
      callback(null, true);
    }
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
  links.config = base + '/config';

  if(this.isEntryTarget()) {
    links.users = base + '/users';
    links.globalconfig = base + '/globalconfig';
  }

  this.links = links;

};
