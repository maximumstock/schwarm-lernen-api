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
var _ = require('lodash');
var async = require('async');

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
  username: {
    required: true,
    minLength: config.DEFAULT_USERNAME_LENGTH,
    message: 'Muss einen Username haben.'
  },
  password: {
    required: true,
    minLength: config.DEFAULT_PASSWORD_LENGTH,
    message: 'Muss ein Passwort haben'
  }
};

// Öffentliche Instanzvariablen mit Gettern und Settern

//Propertydefinition für die UUID der Node ist
Object.defineProperty(User.prototype, 'uuid', {
  get: function () {
    return this.properties.uuid;
  }
});

// Propertydefinition für den Name des Users
Object.defineProperty(User.prototype, 'username', {
  get: function () {
    return this.properties.username;
  }
});

/**
 * @function Propertydefinition für das Passwort des Nutzers
 * @prop {string} password Passwort
 */
Object.defineProperty(User.prototype, 'password', {
  get: function () {
    return this.properties.password;
  },
  set: function (value) {
    this.properties.password = value;
  },
  configurable: true
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function get Statische Gettermethode für User
 * @param {string} uuid UUID des gesuchten Users
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
 * @function findByUsername Statische Gettermethode für User per Username
 * @param {string} username gesuchter Username
 */
User.findByUsername = function(username, callback) {

  var query = [
    'MATCH (u:User {username: {username}})',
    'RETURN u'
  ].join('\n');

  var params = {
    username: username
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    if (result.length === 0) {
      err = new Error('Es wurde kein User `' + username + '` gefunden');
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
      return new User(e.u);
    });
    callback(null, users);
  });

};

/**
 * @function Überprüft ob der User mit dem entsprechenden Usernamen bereits besteht
 * @param {string} username Zu überprüfender Username
 */
User.isValidUsername = function(username, callback) {

  var query = [
    'MATCH (x:User {username: {username}})',
    'RETURN x'
  ].join('\n');

  var params = {
    username: username
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    if(result.length === 0) return callback(null, true);
    return callback(null, false);
  });

};

/**
 * @function Generiert {number} username-password Kombinationen
 * @param {int} number Anzahl an zu generierenden Kombinationen
 */
User.generate = function(number, callback) {

  var accounts = [];
  for(var i = 0; i < number; i++) {
    accounts.push({
      username: pwgen(config.DEFAULT_USERNAME_LENGTH),
      password: pwgen(config.DEFAULT_PASSWORD_LENGTH)
    });
  }

  // überprüfe ob usernamen unique sind
  _.uniq(accounts, 'username');
  if(accounts.length !== number) {
    // min. 1 username wurde doppelt generiert
    return User.generate(number, callback); // einfach nochmal probieren
  }

  // überprüfen ob Usernamen valide sind (aka noch nicht verwendet sind)
  // alle Usernames mit User.isValidUsername überprüfen
  var todo = accounts.map(function(i) {
    return function(cb) {
      User.isValidUsername(i.username, cb);
    };
  });

  async.parallel(todo, function(err, result) {
    if(err) return callback(err);
    // falls alle Usernames valide sind, ist result in Array von {number} true-Werten
    // falls ein false dabei ist -> nochmal probieren
    var b = true;
    result.forEach(function(i) {
      b = b & i;
    });
    if(b === false) {
      return User.generate(number, callback);
    }
    callback(null, accounts);
  });

};

/**
 * @function
 * @name create Erstellt einen neuen User und speichert es in der Datenbank
 * @param {object} properties Attribute der anzulegenden Node
 */
User.create = function (properties, callback) {

  // Validierung
  // `validate()` garantiert unter anderem:
  try {
    properties = validate.validate(User.VALIDATION_INFO, properties, true);
  } catch (e) {
    return callback(e);
  }

  // gewählten Nutzernamen überprüfen
  User.isValidUsername(properties.username, function(err, bool) {
    if(err) return callback(err);
    if(!bool) {
      // Username bereits verwendet
      err = new Error('Username `' + properties.username + '` wird bereits verwendet');
      err.status = 409;
      err.name = 'UsernameAlreadyExists';
      callback(err, null);
    } else {

      // User erstellen
      properties.createdAt = parseInt(moment().format('X'));

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
        dbhelper.getNodeByID(result[0].u._id, function (err, node) {
          if (err) return callback(err);
          // erstelle neue Userinstanz und gib diese zurück
          var u = new User(node);
          callback(null, u);
        });
      });


    }
  });

};

// Instanzmethoden

/**
 * @function Gibt an ob der User ein Admin ist
 */
User.prototype.isAdmin = function () {

  return this.labels.indexOf('Admin') > -1;

};

/**
 * @function Gibt alle Kommentare dieses Users zurück
 */
User.prototype.getComments = function (callback) {

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
User.prototype.getInfos = function (callback) {

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
User.prototype.getOwnTasks = function (callback) {

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
User.prototype.getSolvedTasks = function (callback) {

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
 * @function Gibt alle Aufgaben zurück, die dieser User im Lernziel `targetUUID` bearbeitet hat
 * @param {string} targetUUID UUID des Lernziels auf die die Suche beschränkt werden soll
 */
User.prototype.getSolvedTasksByTarget = function(targetUUID, callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {uuid}})-[:CREATED]->(s:Solution)-[:SOLVES]->(t:Task)<-[:BELONGS_TO]-(target:Target {uuid: {targetUUID}})',
    'RETURN t'
  ].join('\n');

  var params = {
    uuid: self.uuid,
    targetUUID: targetUUID
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
 * @function Liefert eine Lösung des Users aufgrund einer Aufgaben-UUID
 * @param {string} taskUUID UUID der Aufgabe
 */
User.prototype.getSolutionByTask = function(taskUUID, callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[:CREATED]->(s:Solution)-[:SOLVES]->(t:Task {uuid: {taskUUID}})',
    'RETURN s'
  ].join('\n');

  var params = {
    userUUID: self.uuid,
    taskUUID: taskUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    if(result.length === 0) {
      err = new Error('Du hast noch keine Lösung für diese Aufgabe');
      err.status = 404;
      err.name = 'SolutionNotFound';
      return callback(err);
    }
    callback(null, new Solution(result[0].s));
  });

};

/**
 * @function Liefert alle Lösungen des Users
 */
User.prototype.getSolutions = function(callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[:CREATED]->(s:Solution)',
    'RETURN s'
  ].join('\n');

  var params = {
    userUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    var solutions = result.map(function(i) {
      return new Solution(i.s);
    });
    callback(null, solutions);
  });

};

/**
 * @function Liefert Aufschlüsselung über das Punktekonto des Nutzers
 * @returns Ein Objekt mit den Punkten für Aufgaben, Lösungen, Infos
 */
User.prototype.getPoints = function(callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})',
    'OPTIONAL MATCH (u)-[r:CREATED]-(n)',
    'OPTIONAL MATCH (u)-[r2:RATES]-(n2)',
    'OPTIONAL MATCH (u)-[:CREATED]->(n3)<-[r3:RATES]-(u2:User)',
    'RETURN r,n,r2,r3'
  ].join('\n');

  var params = {
    userUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);

    var points = {
      tasks: 0,
      solutions: 0, // Summe aller Punkte die zum Einstellen von Lösungen ausgegeben wurde
      infos: 0,
      ratings: 0,
      total: 0
    };

    result.forEach(function(i) {

      // Punkte kommen entweder vom Erstellen von Content -> i.r2 ist NULL
      if(i.n && i.r) {
        var labels = i.n.labels;
        var p = parseInt(i.r.properties.points || 0);
        points.total += p;

        if(labels.indexOf('Task') > -1) {
          points.tasks += p;
        } else if(labels.indexOf('Solution') > -1) {
          points.solutions += p;
        } else if(labels.indexOf('Info') > -1){
          points.infos += p;
        }

        // oder von den Bewertungen anderer des eigenen Contents
        if(i.r3) {
          var rating = i.r3.properties;
          var avg = (rating.r1 + rating.r2 + rating.r3 + rating.r4 + rating.r5) / 5;
          points.total += avg;

          if(labels.indexOf('Task') > -1) {
            points.tasks += avg;
          } else if(labels.indexOf('Solution') > -1) {
            points.solutions += avg;
          } else if(labels.indexOf('Info') > -1){
            points.infos += avg;
          }

        }
      }


      // oder Punkte kommen von gegebenen Bewertungen -> dann ist i.r & i.n NULL
      if(i.r2) {
        var ratePoints = parseInt(i.r2.properties.points || 0);
        points.ratings += ratePoints;
        points.total += ratePoints;
      }

    });

    callback(null, points);
  });

};

/**
 * @function Helferfunktion die überprüft ob der User noch {points} Punkte hat
 * @param {integer} amount Anzahl der Punkte die der User mindestens haben soll
 */
User.prototype.hasPoints = function(amount, cb) {

  this.getPoints(function(err, points) {
    if(err) return cb(err);
    if(points.total < amount) {
      return cb(null, false);
    } else {
      return cb(null, true);
    }
  });

};

/**
 * @function Überprüft ob der User die Node {id} erstellt hat oder nicht
 * @param {string} nodeUUID UUID der zu überprüfenden Node
 * @returns true/false
 */
User.prototype.hasCreated = function(nodeUUID, callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[:CREATED]->(n {uuid: {nodeUUID}})',
    'RETURN n'
  ].join('\n');

  var params = {
    nodeUUID: nodeUUID,
    userUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    return callback(null, result.length === 0 ? false : true);
  });

};

/**
 * @function Bewertet die Node {nodeUUID} mit der Bewertung {rating}
 * Falls bereits eine Bewertung besteht wird sie überschrieben
 * @param {string} nodeUUID UUID der zu bewertenden Node
 * @param {object} rating Objekt mit mehreren Bewertungen (momentan r1-r5) als Integer (1-5)
 * @param {integer} points Anzahl der Punkte die der Ersteller der Bewertung erhalten soll
 */
User.prototype.rate = function(nodeUUID, rating, points, callback) {

  var self = this;

  for(var k in rating) {
    if(rating[k] < 1 || rating[k] > 5) {
      var err = new Error('Die Bewertung muss zwischen 1 und 5 liegen');
      err.status = 409;
      return callback(err);
    }
  }

  // Überprüfe ob der Nutzer die Node selbst erstellt hat, falls ja sollte er sie nicht bewerten können
  this.hasCreated(nodeUUID, function(err, result) {
    if(err) return callback(err);
    if(result) {
      // Fehler
      err = new Error('Du kannst nicht deine eigenen Beiträge bewerten');
      err.status = 409;
      err.name = 'CheekyUser';
      return callback(err);
    } else {

      // User darf bewerten
      var query = [
        'MATCH (u:User {uuid: {userUUID}}), (n {uuid: {nodeUUID}})',
        'MERGE (u)-[r:RATES]->(n)',
        'ON CREATE SET r = {rating}, r.points = {points}',
        'ON MATCH SET r = {rating}'
      ].join('\n');

      var params = {
        nodeUUID: nodeUUID,
        userUUID: self.uuid,
        rating: rating,
        points: points
      };

      db.cypher({
        query: query,
        params: params
      }, function(err, result) {
        return callback(err, true);
      });
    }
  });

};

/**
 * @function Liefert die Bewertung des Users für eine Node {nodeUUID} zurück
 * @param {string} nodeUUID UUID der Node für die die Bewertung des Nutzers gesucht werden soll
 */
User.prototype.getMyRatingFor = function(nodeUUID, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[r:RATES]->(n {uuid: {nodeUUID}})',
    'RETURN r'
  ].join('\n');

  var params = {
    userUUID: self.uuid,
    nodeUUID: nodeUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return cb(err);
    if(result.length === 0) {
      return cb(null, null);
    } else {
      return cb(null, result[0].r.properties);
    }
  });

};


/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
User.prototype.addMetadata = function (apiVersion) {

  delete this.properties.password;

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/users/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  this.links = links;

};
