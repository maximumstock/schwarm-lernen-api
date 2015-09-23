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
var indicative = require('indicative');
var validator = new indicative();
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
User.VALIDATION_RULES = {
  username: 'required|string|alpha_numeric|min:'+config.DEFAULT_USERNAME_LENGTH,
  password: 'required|string|alpha_numeric|min:'+config.DEFAULT_PASSWORD_LENGTH
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

// Propertydefinition für das Passwort des Nutzers
Object.defineProperty(User.prototype, 'password', {
  get: function () {
    return this.properties.password;
  }
});

Object.defineProperty(User.prototype, 'tasksToDo', {
  get: function () {
    return this.properties.tasksToDo;
  }
});

Object.defineProperty(User.prototype, 'tasksDone', {
  get: function () {
    return this.properties.tasksDone;
  }
});

Object.defineProperty(User.prototype, 'solutionsToDo', {
  get: function () {
    return this.properties.solutionsToDo;
  }
});

Object.defineProperty(User.prototype, 'solutionsDone', {
  get: function () {
    return this.properties.solutionsDone;
  }
});

Object.defineProperty(User.prototype, 'infosToDo', {
  get: function () {
    return this.properties.infosToDo;
  }
});

Object.defineProperty(User.prototype, 'infosDone', {
  get: function () {
    return this.properties.infosDone;
  }
});

Object.defineProperty(User.prototype, 'ratingsToDo', {
  get: function () {
    return this.properties.ratingsToDo;
  }
});

Object.defineProperty(User.prototype, 'ratingsDone', {
  get: function () {
    return this.properties.ratingsDone;
  }
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

  if(typeof(number) !== 'number') {
    var err = new Error('User.generate muss mit einem Ganzzahlwert aufgerufen werden');
    err.status = 400;
    err.name = 'N00bUser';
    return callback(err);
  }

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
  validator
    .validate(User.VALIDATION_RULES, properties)
    .then(function() {

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

    })
    .catch(function(errors) {
      return callback(errors);
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
 * Als `inaktiv` markierte Nodes sind hierbei ausgenommen
 * @returns Ein Objekt mit den Punkten für Aufgaben, Lösungen, Infos
 */
User.prototype.getPoints = function(callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})',
    'OPTIONAL MATCH (u)-[r:CREATED]-(n) WHERE NOT n:Inactive',
    'OPTIONAL MATCH (u)-[r2:RATES]-(n2) WHERE NOT n2:Inactive',
    'OPTIONAL MATCH (u)-[:CREATED]->(n3)<-[r3:RATES]-(u2:User) WHERE NOT n3:Inactive',
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
      tasks: {spent: 0, gained: 0},
      solutions: {spent: 0, gained: 0},
      infos: {spent: 0, gained: 0},
      ratings: {spent: 0, gained: 0},
      total: {spent: 0, gained: 0}
    };

    result.forEach(function(i) {

      var gain = 0;
      var cost = 0;

      // Punkte kommen entweder vom Erstellen von Content -> i.r2 ist NULL
      if(i.n && i.r) {
        var labels = i.n.labels;

        gain = parseInt(i.r.properties.gainedPoints);
        cost = parseInt(i.r.properties.spentPoints);

        points.total.gained += gain;
        points.total.spent += cost;

        if(labels.indexOf('Task') > -1) {
          points.tasks.gained += gain;
          points.tasks.spent += cost;
        } else if(labels.indexOf('Solution') > -1) {
          points.solutions.gained += gain;
          points.solutions.spent += cost;
        } else if(labels.indexOf('Info') > -1){
          points.infos.gained += gain;
          points.infos.spent += cost;
        }

        // oder von den Bewertungen anderer des eigenen Contents
        if(i.r3) {
          var rating = i.r3.properties;
          gain = (rating.r1 + rating.r2 + rating.r3 + rating.r4 + rating.r5) / 5 * rating.rateMultiplier;
          points.total.gained += gain;

          if(labels.indexOf('Task') > -1) {
            points.tasks.gained += gain;
          } else if(labels.indexOf('Solution') > -1) {
            points.solutions.gained += gain;
          } else if(labels.indexOf('Info') > -1){
            points.infos.gained += gain;
          }

        }
      }

      // oder Punkte kommen von gegebenen Bewertungen -> dann ist i.r & i.n NULL
      if(i.r2) {
        gain = parseInt(i.r2.properties.gainedPoints);
        cost = parseInt(i.r2.properties.spentPoints);

        points.ratings.gained += gain;
        points.ratings.spent += cost;

        points.total.gained += gain;
        points.total.spent += cost;
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

  if(amount === 0) return cb(null, true);

  this.getPoints(function(err, points) {
    if(err) return cb(err);
    var total = points.total.gained - points.total.spent;
    console.log(total);
    if(total < amount) {
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
 * @param {integer} gainedPoints Anzahl der Punkte die der Ersteller der Bewertung erhalten soll
 * @param {integer} spentPoints Anzahl der Punkte die die Bewertung dem Ersteller kosten soll
 * @param {integer} rateMultiplier Multiplikator für die aktuelle Bewertung
 */
User.prototype.rate = function(nodeUUID, rating, gainedPoints, spentPoints, rateMultiplier, callback) {

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
        'ON CREATE SET r = {rating}, r.gainedPoints = {gainedPoints}, r.spentPoints = {spentPoints}, r.rateMultiplier = {rateMultiplier}',
        'ON MATCH SET r = {rating}'
      ].join('\n');

      var params = {
        nodeUUID: nodeUUID,
        userUUID: self.uuid,
        rating: rating,
        gainedPoints: gainedPoints,
        spentPoints: spentPoints,
        rateMultiplier: rateMultiplier
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
 * @function Aktualisiert das Attribut `lastLogin` des Nutzers
 */
User.prototype.updateLoginTimestamp = function(cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})',
    'SET u.lastLogin = {timestamp}'
  ].join('\n');

  var params = {
    userUUID: self.uuid,
    timestamp: require('moment')().format('X')
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return cb(err);
    return cb(null, true);
  });

};

/**
 * @function Erneuert die Einstellungslimits (Aufgaben, Infos, Bewertungen) des Nutzers
 * @param {object} config Das Konfigurationsobjekt des betreffenden Studiengangs mit den Werten für
 * taskShare, infoShare, rateShare
 */
User.prototype.refreshPackage = function(config, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})',
    'SET u.tasksToDo = {tasksToDo}, u.infosToDo = {infosToDo}, u.solutionsToDo = {solutionsToDo}, u.ratingsToDo = {ratingsToDo}, u.ratingsDone = 0, u.tasksDone = 0, u.infosDone = 0, u.solutionsDone = 0',
    'RETURN u'
  ].join('\n');

  // falls für Aufgaben, Lösungen, Infos oder Bewertungen keine maximale Anzahl gegeben ist, wird das Limit des Pakets auf -1 gesetzt
  // mit einem negativen Wert kann später der Fall behandelt werden, dass es für diese Aktion kein Limit/keine Mindestanzahl gibt
  var params = {
    userUUID: self.uuid,
    tasksToDo: Math.round(config.packageSize * config.taskShare) === 0 ? -1 : Math.round(config.packageSize * config.taskShare),
    infosToDo: Math.round(config.packageSize * config.infoShare) === 0 ? -1 : Math.round(config.packageSize * config.infoShare),
    solutionsToDo: Math.round(config.packageSize * config.solutionShare) === 0 ? -1 : Math.round(config.packageSize * config.solutionShare),
    ratingsToDo: Math.round(config.packageSize * config.rateShare) === 0 ? -1 : Math.round(config.packageSize * config.rateShare)
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return cb(err);
    cb(null, new User(result[0].u));
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
 * @function Helferfunktion die überprüft ob das aktuelle Arbeitspaket abgearbeitet wurde
 */
User.prototype.hasFinishedPackage = function() {

  var self = this;

  return self.tasksToDo === 0 && self.infosToDo === 0 && self.solutionsToDo === 0 && self.ratingsToDo === 0;

};

/**
 * @function Aktualisiert den Arbeitspaketstatus des Nutzers und weist gegebenenfalls ein neues Arbeitspaket zu
 * Mit einem Aufruf dieser Funktionen kann lediglich eine Arbeitspaket-Aktion registriert werden. Falls also
 * der Nutzer 2 Aufgaben einstellt obwohl das Arbeitspaket nur noch 1 Aufgabe verlangt und der Nutzer vor
 * Beendigung des aktuellen Pakets noch anderweitige Punkte abzuarbeiten hat, muss diese Funktion erneut aufgerufen werden.
 * @param {object} job Ein Objekt welches beschreibt was der Nutzer in der Zwischenzeit bearbeitet hat
 * @param {object} config Das Konfigurationsobjekt der jeweiligen Konfiguration für das ggf. neue Arbeitspaket
 */
User.prototype.didWorkOnPackage = function(job, config, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})',
    'SET u.tasksToDo = {tasksToDo}, u.infosToDo = {infosToDo}, u.ratingsToDo = {ratingsToDo}, u.solutionsToDo = {solutionsToDo}',
    'RETURN u'
  ].join('\n');

  var params = self.properties; // Parameter einfach die Attribute des aktuellen Nutzers zuweisen damit später überschrieben werden kann was sich verändert
  params.userUUID = self.uuid;

  // je nachdem was "angekreuzt" wurde, muss das Arbeitspaket aktualisiert werden
  // außerdem dürfen die Limits nicht auf -1 stehen, da dies der Fall ist, dass es auf dieser Aktion kein Limit/keine Mindestanzahl gibt

  if(job.tasks && self.tasksToDo !== -1) {
    params.tasksToDo = self.tasksToDo - 1;
    params.tasksDone = params.taskDone + 1;
  } else if(job.infos && self.infosToDo !== -1) {
    params.infosToDo = self.infosToDo - 1;
    params.infosDone = params.infosDone + 1;
  } else if(job.solutions && self.solutionsToDo !== -1) {
    params.solutionsToDo = self.solutionsToDo - 1;
    params.solutionsDone = params.solutionsDone + 1;
  } else if(job.ratings && self.ratingsToDo !== -1){
    params.ratingsToDo = self.ratingsToDo - 1;
    params.ratingsDone = params.ratingsDone + 1;
  }

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return cb(err);
    if(result.length === 0) {
      console.error('User.didWorkOnPackage: user nichte gefunden, sollte nicht passieren, uuid:', self.uuid);
    }
    // Arbeitspaket wurde aktualisiert
    var newUser = new User(result[0].u); // neues User-Objekt mit neuen Daten
    if(newUser.hasFinishedPackage()) {
      // neues Paket erstellen
      newUser.refreshPackage(config, cb);
    } else {
      // das alte Paket des Users ist noch nicht abgearbeitet
      return cb(null, null);
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
