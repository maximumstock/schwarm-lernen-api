'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Arbeitspakete.
 */

/**
 * @function Konstruktor für ein Arbeitspaket
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Package = module.exports = function Package(_node) {
  Node.apply(this, arguments);
};

var neo4j = require('neo4j');
var config = require('../config/config');
var indicative = require('indicative');
var validator = new indicative();
var dbhelper = require('../db');
var moment = require('moment');

var Node = require('./node');
var User = require('./user');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Package.prototype = Object.create(Node.prototype);

// Enthält Informationen zum Validieren von Attributen neuer Package-Nodes
Package.VALIDATION_RULES = {
  tasksToDo: 'required|integer|min:0',
  solutionsToDo: 'required|integer|min:0',
  infosToDo: 'required|integer|min:0',
  ratingsToDo: 'required|integer|min:0',
  tasksDone: 'required|integer',
  solutionsDone: 'required|integer',
  infosDone: 'required|integer',
  ratingsDone: 'required|integer'
};

Package.PROTECTED_ATTRIBUTES = ['uuid', 'owner', 'createdAt'];

// Propertydefinition für die UUID des Besitzers des Arbeitspakets
Object.defineProperty(Package.prototype, 'owner', {
  get: function () {
    return this.properties.owner;
  }
});

Object.defineProperty(Package.prototype, 'tasksToDo', {
  get: function() {
    return this.properties.tasksToDo;
  }
});

Object.defineProperty(Package.prototype, 'tasksDone', {
  get: function() {
    return this.properties.tasksDone;
  }
});

Object.defineProperty(Package.prototype, 'solutionsToDo', {
  get: function() {
    return this.properties.solutionsToDo;
  }
});

Object.defineProperty(Package.prototype, 'solutionsDone', {
  get: function() {
    return this.properties.solutionsDone;
  }
});

Object.defineProperty(Package.prototype, 'ratingsToDo', {
  get: function() {
    return this.properties.ratingsToDo;
  }
});

Object.defineProperty(Package.prototype, 'ratingsDone', {
  get: function() {
    return this.properties.ratingsDone;
  }
});

Object.defineProperty(Package.prototype, 'infosToDo', {
  get: function() {
    return this.properties.infosToDo;
  }
});

Object.defineProperty(Package.prototype, 'infosDone', {
  get: function() {
    return this.properties.infosDone;
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function create Methode zum Erstellen eines neuen Arbeitspakets für einen User
 * @param {object} config Für das neue Paket geltenden Konfiguration (wieviel von was zu tun ist)
 * @param {string} userUUID UUID des Users der ein neues Arbeitspaket bekommen soll
 */
 Package.create = function(config, userUUID, cb) {

   var self = this;

   var query = [
     'MATCH (u1:User {uuid: {userUUID}})<-[:BELONGS_TO]-(op:Package)',
     'SET op:Finished' // alle alten Packages auf `finished` setzen
  ].join('\n');

  var query2 = [
     'MATCH (u:User {uuid: {userUUID}})',
     'CREATE (p:Package {properties})-[:BELONGS_TO]->(u)',
     'RETURN p'
   ].join('\n');

   // Der Einfachheit halber wird der Rundungswert aus Paketgröße * gewünschtem Paketanteil als Menge gesetzt
   // falls dieser auf 0 gerundet wird -> Pech gehabt, keine dieser Aktionen kann durchgeführt werden
   var params = {
     userUUID: userUUID,
     properties: {
       tasksToDo: Math.round(config.packageSize * config.taskShare),
       infosToDo: Math.round(config.packageSize * config.infoShare),
       solutionsToDo: Math.round(config.packageSize * config.solutionShare),
       ratingsToDo: Math.round(config.packageSize * config.rateShare),
       tasksDone: 0,
       infosDone: 0,
       solutionsDone: 0,
       ratingsDone: 0,
       owner: userUUID,
       createdAt: moment().format('X')
     }
   };

   db.cypher([{
     query: query,
     params: params
   }, {
     query: query2,
     params: params
   }], function(err, result) {
     if(err) return cb(err);
     if(result.length === 0) {
       err = new Error('Der User mit der UUID `'+userUUID+'` kann nicht gefunden werden. Sollte nicht passieren');
       err.status = 404;
       err.name = 'UserNotFound';
       return cb(err);
     }
     // hole gerade erstellte Info aus der Datenbank
     dbhelper.getNodeByID(result[1][0].p._id, function (err, node) {
       if (err) return cb(err);
       // erstelle neue Infosinstanz und gib diese zurück
       var p = new Package(node);
       cb(null, p); // 2D-Array weil oben 2 Queries durchgeführt wurden
     });

   });

 };


/**
 * @function Aktualisiert den Arbeitspaketstatus des Nutzers und weist gegebenenfalls ein neues Arbeitspaket zu
 * Falls mit dieser Funktion zu viel auf einmal abgearbeitet wird (also z.B. 3 Infos und 1 Aufgabe in das AP eingetragen werden),
 * wird der
 * @param {object} job Ein Objekt welches beschreibt was der Nutzer in der Zwischenzeit bearbeitet hat
 * Beispiel {tasks: 0, solutions: 0, infos: 0, ratings: 1}, falls der Nutzer eine Bewertung erstellt hat
 * @param {object} config Das Konfigurationsobjekt der jeweiligen Konfiguration für das ggf. neue Arbeitspaket
 */
Package.prototype.updatePackage = function(job, config, cb) {


  var self = this;

  var query = [
    'MATCH (p:Package {uuid: {packageUUID}})',
    'SET p = {properties}',
    'RETURN p'
  ].join('\n');

  var params = self.properties; // Parameter einfach die Attribute des aktuellen Pakets zuweisen damit es später überschrieben werden kann

  // je nachdem was "angekreuzt" wurde, muss das Arbeitspaket aktualisiert werden
  if(job.tasks) {
    params.tasksToDo -= job.tasks;
    // falls der todo counter negativ ist -> auf 0 setzen
    // so kann der Nutzer nichts mehr in diesem Paket erstellen, aber wir speichern trotzdem seine Beiträge
    if(params.tasksToDo < 0) params.tasksToDo = 0;
    params.tasksDone += job.tasks;
  }
  if(job.infos) {
    params.infosToDo -= job.infos;
    if(params.infosToDo < 0) params.infosToDo = 0;
    params.infosDone += job.infos;
  }
  if(job.solutions) {
    params.solutionsToDo -= job.solutions;
    if(params.solutionsToDo < 0) params.solutionsToDo = 0;
    params.solutionsDone += job.solutions;
  }
  if(job.ratings){
    params.ratingsToDo -= job.ratings;
    if(params.ratingsToDo < 0) params.ratingsToDo = 0;
    params.ratingsDone += job.ratings;
  }

  db.cypher({
    query: query,
    params: {
      properties: params,
      packageUUID: self.uuid
    }
  }, function(err, result) {
    if(err) return cb(err);
    if(result.length === 0) {
      console.error('Package.updatePackage: Package nicht gefunden, sollte nicht passieren, uuid:', self.uuid);
      return;
    }
    // Arbeitspaket wurde aktualisiert
    var p = new Package(result[0].p);
    if(p.isFinished()) {
      // neues Paket erstellen
      return Package.create(config, self.owner, cb);
    } else {
      // das alte Paket des Users ist noch nicht abgearbeitet, aktualisiert zurückgeben
      return cb(null, p);
    }
  });

};

/**
 * @function Helferfunktion, die die Helferfunktion `isFinished` in node.js überschreibt, da diese Funktion anders funktioniert
 * @TODO Sollte gegenüber node.isFinished() angepasst werden
 */
Package.prototype.isFinished = function() {
  return this.ratingsToDo === 0 && this.infosToDo === 0 && this.tasksToDo === 0 && this.solutionsToDo === 0;
};
