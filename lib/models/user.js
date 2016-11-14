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
var dbhelper = require('../db');
var moment = require('moment');
var pwgen = require('password-generator');
var _ = require('lodash');
var async = require('async');

var Node = require('./node');
var Task = require('./task');
var Info = require('./info');
var Solution = require('./solution');
var Package = require('./package');
var Rating = require('./rating');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

User.prototype = Object.create(Node.prototype);

// Öffentliche Konstanten

// Enthält Informationen zum Validieren von Attributen neuer Kommentar-Nodes für Comment#create
User.VALIDATION_RULES = {
  username: 'required|string|alpha_numeric|min:' + config.DEFAULT_USERNAME_LENGTH,
  password: 'required|string|alpha_numeric|min:' + config.DEFAULT_PASSWORD_LENGTH
};

// Öffentliche Instanzvariablen mit Gettern und Settern

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

Object.defineProperty(User.prototype, 'prestige', {
  get: function () {
    return this.properties.prestige || 1; // 1 ist Default Wert
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
User.findByUsername = function (username, callback) {

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
User.isValidUsername = function (username, callback) {

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
  }, function (err, result) {
    if (err) return callback(err);
    if (result.length === 0) return callback(null, true);
    return callback(null, false);
  });

};

/**
 * @function Generiert {number} username-password Kombinationen
 * @param {int} number Anzahl an zu generierenden Kombinationen
 */
User.generate = function (number, callback) {

  if (typeof (number) !== 'number') {
    var err = new Error('User.generate muss mit einem Ganzzahlwert aufgerufen werden');
    err.status = 400;
    err.name = 'N00bUser';
    return callback(err);
  }

  if (number > 50) {
    var err2 = new Error('Es können maximal 50 Accounts gleichzeitig angelegt werden');
    err2.status = 400;
    err2.name = 'N00bUser';
    return callback(err2);
  }

  var accounts = [];
  for (var i = 0; i < number; i++) {
    accounts.push({
      username: pwgen(config.DEFAULT_USERNAME_LENGTH),
      password: pwgen(config.DEFAULT_PASSWORD_LENGTH)
    });
  }

  // überprüfe ob usernamen unique sind
  _.uniq(accounts, 'username');
  if (accounts.length !== number) {
    // min. 1 username wurde doppelt generiert
    return User.generate(number, callback); // einfach nochmal probieren
  }

  // überprüfen ob Usernamen valide sind (aka noch nicht verwendet sind)
  // alle Usernames mit User.isValidUsername überprüfen
  var todo = accounts.map(function (i) {
    return function (cb) {
      User.isValidUsername(i.username, cb);
    };
  });

  async.parallel(todo, function (err, result) {
    if (err) return callback(err);
    // falls alle Usernames valide sind, ist result in Array von {number} true-Werten
    // falls ein false dabei ist -> nochmal probieren
    var b = true;
    result.forEach(function (i) {
      b = b & i;
    });
    if (b === false) {
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
    .then(function () {

      // gewählten Nutzernamen überprüfen
      User.isValidUsername(properties.username, function (err, bool) {
        if (err) return callback(err);
        if (!bool) {
          // Username bereits verwendet
          err = new Error('Username `' + properties.username + '` wird bereits verwendet');
          err.status = 409;
          err.name = 'UsernameAlreadyExists';
          callback(err, null);
        } else {

          // User erstellen
          properties.createdAt = moment().format('X');

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
    .catch(function (errors) {
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
    result = result.map(function (i) {
      return new Info(i.i);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle Infos zurück, die dieser User erstellt hat aber noch nicht abgegeben hat
 */
User.prototype.getUnfinishedInfos = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {uuid}})-[:CREATED]->(i:Info:Unfinished)',
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
    result = result.map(function (i) {
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
    result = result.map(function (i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle Aufgaben zurück, die dieser User erstellt hat aber noch nicht abgegeben hat
 */
User.prototype.getOwnUnfinishedTasks = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {uuid}})-[:CREATED]->(t:Task:Unfinished)',
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
    result = result.map(function (i) {
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
    result = result.map(function (i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};

/**
 * @function Gibt alle Aufgaben zurück, die dieser User im Lernziel `targetUUID` bearbeitet hat
 * @param {string} targetUUID UUID des Lernziels auf die die Suche beschränkt werden soll
 */
User.prototype.getSolvedTasksByTarget = function (targetUUID, callback) {

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
  }, function (err, result) {
    if (err) return callback(err);
    result = result.map(function (i) {
      return new Task(i.t);
    });
    callback(null, result);
  });

};

/**
 * @function Liefert eine Lösung des Users aufgrund einer Aufgaben-UUID
 * @param {string} taskUUID UUID der Aufgabe
 */
User.prototype.getSolutionByTask = function (taskUUID, callback) {

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
  }, function (err, result) {
    if (err) return callback(err);
    if (result.length === 0) {
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
User.prototype.getSolutions = function (callback) {

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
  }, function (err, result) {
    if (err) return callback(err);
    var solutions = result.map(function (i) {
      return new Solution(i.s);
    });
    callback(null, solutions);
  });

};

/**
 * @function Liefert alle Lösungen des Users, die noch nicht abgegeben wurden
 */
User.prototype.getUnfinishedSolutions = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[:CREATED]->(s:Solution:Unfinished)',
    'RETURN s'
  ].join('\n');

  var params = {
    userUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return callback(err);
    var solutions = result.map(function (i) {
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
User.prototype.getPoints = function (callback) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})<-[r:GIVES_POINTS]-(n) WHERE NOT n:Inactive AND NOT n:Unfinished',
    'RETURN collect(r) as r'
  ].join('\n');

  var query2 = [
    'MATCH (u:User {uuid: {userUUID}})<-[r:COSTS_POINTS]-(n) WHERE NOT n:Inactive AND NOT n:Unfinished',
    'RETURN collect(r) as r'
  ].join('\n');

  var params = {
    userUUID: self.uuid
  };

  db.cypher([{
    query: query,
    params: params
  }, {
    query: query2,
    params: params
  }], function (err, result) {
    if (err) return callback(err);

    var points = {
      spent: 0,
      gained: 0
    };

    var gains = result[0][0].r,
      costs = result[1][0].r;

    // gesammelte Punkte zusammenzählen
    var sum = 0,
    num = 0,
    prestigeSum = 0;
    for (var i = 0; i < gains.length; i++) {
      // fürs erste werden nur die :GIVES_POINTS Relationen beachtet, welche von Bewertungen eigener Inhalte stammen
      // alle anderen :GIVES_POINTS Relationen (z.B. für das Einstellen von Aufgaben), können ohne Prestigewert nicht so einfach verrechnet werden
      // Rechenbeispiel: Bei zwei Bewertungen (3 Punkte bei 4 Prestige und 2 Punkte bei 5 Prestige): (3P * 4R * x + 2P * 5R * y) / (4R + 5R)
      // wobei x und y die jeweilige Anzahl an Punkten ist, die zu dem Zeitpunkt laut Konfiguration maximal für einen Contenttyp (Aufgabe, Lösung, Inhalt)
      // erreichbar ist
      if (gains[i].properties.points && gains[i].properties.prestige && gains[i].properties.maxpoints) {
        num++;
        prestigeSum += gains[i].properties.prestige;
        sum += gains[i].properties.points * gains[i].properties.prestige * gains[i].properties.maxpoints; // durch `maxpoints`
      }
    }
    points.gained = (sum / prestigeSum / 5) || 0;  // Teilen durch 5, da 5 der Maximalwert für eine Einzelwertung ist

    // ausgegebene Punkte zusammenzählen
    sum = 0;
    num = 0;
    for (i = 0; i < costs.length; i++) {
      // hier können wir alle Relationen nehmen, da Punkte immer nur linear abgezogen werden
      // entgegen der :GIVES_POINTS Relationen müssen wir diese auch jetzt schon beachten, da man sonst immer genug Punkte für alles hätte
      if (costs[i].properties.points) {
        num++;
        sum += costs[i].properties.points;
      }
    }
    points.spent = (sum / num) || 0;
    return callback(null, points);

  });

};

/**
 * @function Helferfunktion die überprüft ob der User noch {points} Punkte hat
 * @param {integer} amount Anzahl der Punkte die der User mindestens haben soll
 */
User.prototype.hasPoints = function (amount, cb) {

  if (amount === 0 || this.isAdmin()) return cb(null, true);

  this.getPoints(function (err, points) {
    if (err) return cb(err);
    var total = points.gained - points.spent;
    if (total < amount) {
      return cb(null, false);
    } else {
      return cb(null, true);
    }
  });

};

/**
 * @function Überprüft ob der User die Node {nodeUUID} erstellt hat oder nicht
 * @param {string} nodeUUID UUID der zu überprüfenden Node
 * @returns true/false
 */
User.prototype.hasCreated = function (nodeUUID, callback) {

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
  }, function (err, result) {
    if (err) return callback(err);
    return callback(null, result.length === 0 ? false : true);
  });

};

/**
 * @function Überprüft ob der User die Node {nodeUUID} bereits bewertet hat
 * @param {string} nodeUUID UUID der zu überprüfenden Node
 * @returns true/false
 */
User.prototype.hasRated = function(nodeUUID, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[:CREATED]->(r:Rating)-[:RATES]->(n {uuid: {nodeUUID}})',
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
    return cb(null, result.length === 0 ? false : true);
  });

};

/**
 * @function Überprüft ob ein User eine Lösung für {taskUUID} eingestellt hat oder nicht
 */
User.prototype.hasSolved = function (taskUUID, cb) {

  var self = this;

  var query = [
    'MATCH (t:Task {uuid: {taskUUID}})<-[:SOLVES]-(s:Solution)<-[:CREATED]-(u:User {uuid: {userUUID}})',
    'RETURN s'
  ].join('\n');

  var params = {
    taskUUID: taskUUID,
    userUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return cb(err);
    return cb(null, result.length === 0 ? false : true);
  });

};

/**
 * @function Aktualisiert das Attribut `lastLogin` des Nutzers
 */
User.prototype.updateLoginTimestamp = function (cb) {

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
  }, function (err, result) {
    if (err) return cb(err);
    return cb(null, true);
  });

};

/**
 * @function Liefert das aktuelle Arbeitspaket des Nutzers
 * @returns Das aktuelle Package als Package-Objekt, falls noch keins existiert null
 */
User.prototype.getPackage = function (cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})<-[:BELONGS_TO]-(p:Package)',
    'WHERE NOT p:Finished',
    'RETURN p'
  ].join('\n');

  var params = {
    userUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return cb(err);
    cb(null, new Package(result[0].p));
  });

};

/**
 * @function Liefert den aktuellen Prestige Wert des Nutzers
 */
User.prototype.getPrestige = function (cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})<-[r:GIVES_PRESTIGE]-()',
    'RETURN r'
  ].join('\n');

  var params = {
    userUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return cb(err);
    var i = 1,
      prestigePoints = 2.5; // default wert
    // alle GIVES_PRESTIGE Relationships aufaddieren und den Durchschnitt bilden
    // der Prestigewert der Bewerter wird hierfür nicht benötigt, befindet sich aber auch in der Relation
    result.forEach(function (r) {
      i++;
      prestigePoints += r.r.properties.points;
    });
    // falls es schon GIVES_PRESTIGE Relationen gibt, wird der Defaultwert gestrichen
    if (i > 1) {
      i--;
      prestigePoints -= 2.5;
    }
    // jetzt noch Durschnitt bilden
    var prestige = prestigePoints / i;
    return cb(null, prestige);
  });

};

/**
 * @function Liefert die Bewertung des Users für eine Node {nodeUUID} zurück
 * @param {string} nodeUUID UUID der Node für die die Bewertung des Nutzers gesucht werden soll
 */
User.prototype.getMyRatingFor = function (nodeUUID, cb) {

  var self = this;

  var query = [
    'MATCH (u:User {uuid: {userUUID}})-[:CREATED]->(rating:Rating)-[:RATES]->(n {uuid: {nodeUUID}})',
    'RETURN rating'
  ].join('\n');

  var params = {
    userUUID: self.uuid,
    nodeUUID: nodeUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function (err, result) {
    if (err) return cb(err);
    if (result.length === 0) {
      err = new Error('Du hast noch keine Bewertung für diesen Inhalt');
      err.status = 404;
      err.name = 'RatingNotFound';
      return cb(err);
    }
    return cb(null, new Rating(result[0].rating));
  });

};


/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
User.prototype.addMetadata = function (apiVersion) {

  if (this.properties.password) {
    delete this.properties.password;
  }

  apiVersion = apiVersion ||  '';
  var base = apiVersion + '/users/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  this.links = links;

};
