'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Bewertungen.
 */

/**
 * @function Konstruktor für ein Rating
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Rating = module.exports = function Rating(_node) {
  Node.apply(this, arguments);
};


var neo4j = require('neo4j');
var config = require('../config/config');
var dbhelper = require('../lib/db');
var moment = require('moment');
var is = require('is_js');

var Node = require('./node');
var Target = require('./target');
var Task = require('./task');
var Info = require('./info');
var Solution = require('./solution');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

Rating.prototype = Object.create(Node.prototype);

Rating.PROTECTED_ATTRIBUTES = ['uuid', 'createdAt', 'author', 'target'];

Object.defineProperty(Node.prototype, 'comment', {
  get: function () {
    return this.properties.comment;
  }
});

Object.defineProperty(Node.prototype, 'names', {
  get: function () {
    return this.properties.names;
  }
});

Object.defineProperty(Node.prototype, 'values', {
  get: function () {
    return this.properties.values;
  }
});

Object.defineProperty(Rating.prototype, 'author', {
  get: function () {
    return this.properties.author;
  }
});

// Statische Methoden

// Helferfunktion, die die Nutzdaten für ein Rating validiert
function customValidation(properties) {

  var err;

  // properties.comment muss ein String sein
  if(!properties.comment || is.not.string(properties.comment) || properties.comment.length === 0 || properties.comment.length > 1000) {
    err = new Error('`comment` muss ein nicht-leerer String sein.');
    err.status = 400;
    throw err;
  }

  // properties.values und properties.names müssen beide Arrays sein
  if(!properties.values || !properties.names || is.not.array(properties.values) || is.not.array(properties.names)) {
    err = new Error('`values` und `names` müssen beides Arrays sein.');
    err.status = 400;
    throw err;
  }

  // properties.values und properties.names müssen noch die gleiche Länge haben
  if(properties.values.length !== properties.names.length) {
    err = new Error('`values` und `names` haben nicht die gleiche Länge.');
    err.status = 400;
    throw err;
  }

  // properties.values darf nur aus Integern zwischen 1 und 5 bestehen
  properties.values.forEach(function(i) {
    if(is.not.integer(i) || is.not.within(i, 0, 6)) {
      var err = new Error('Alle Werte in `values` müssen aus Ganzzahlen zwischen 1 und 5 bestehen');
      err.status = 400;
      throw err;
    }
  });

  // properties.names darf nur aus Strings bestehen
  properties.names.forEach(function(i) {
    if(is.not.string(i) || i.length === 0) {
      var err = new Error('Alle Werte in `names` müssen aus Strings bestehen');
      err.status = 400;
      throw err;
    }
  });

  return;

}

/**
 * @function Liefert die Bewertung {ratingUUID}
 */
Rating.get = function(ratingUUID, cb) {

  var query = [
    'MATCH (r:Rating {uuid: {ratingUUID}})',
    'RETURN r'
  ].join('\n');

  var params = {
    ratingUUID: ratingUUID
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return cb(err);
    if(result.length === 0) {
       err = new Error('Die Bewertung `'+ratingUUID+'` existiert nicht');
       err.status = 404;
       err.name = 'RatingNotFound';
       return cb(err);
    }
    var r = new Rating(result[0].r);
    cb(null, r);
  });

};


/**
 * @function Erstellt ein neues Rating
 * @param {object} properties Der Inhalt der Bewertung
 * @param {string} authorUUID UUID des Autors
 * @param {string} targetUUID UUID des zu bewertenden Inhalts
 */
Rating.create = function(properties, authorUUID, targetUUID, cb) {

    if(!properties || !authorUUID || !targetUUID || !cb) {
      var err = new Error('Rating.create fehlende Aufrufparemeter.');
      err.status = 500;
      return cb(err);
    }

    // Validierung
    try {
      customValidation(properties);
    } catch(e) {
      return cb(e);
    }

    properties.author = authorUUID;
    properties.createdAt = moment().format('X');
    properties.target = targetUUID;

    var self = this;

    var query = [
      'MATCH (u:User {uuid: {authorUUID}}), (n {uuid: {targetUUID}})',
      'OPTIONAL MATCH (u)-[r2:CREATED]->(r3:Rating)-[r4:RATES]->(n)',
      'OPTIONAL MATCH (r3)-[r5:GIVES_POINTS]->()',
      'OPTIONAL MATCH (r3)-[r6:COSTS_POINTS]->()',
      'OPTIONAL MATCH (r3)-[r7:GIVES_PRESTIGE]->()',
      'DELETE r2, r4, r3, r5, r6, r7', // hiermit wird das aktuell noch bestehende Rating mit allen Beziehungen gelöscht
      'CREATE UNIQUE (u)-[:CREATED]->(r:Rating {properties})-[:RATES]->(n)',
      'RETURN r'
    ].join('\n');

    var params = {
      authorUUID: authorUUID,
      targetUUID: targetUUID,
      properties: properties
    };

    db.cypher({
      query: query,
      params: params
    }, function(err, result) {
      if(err) return cb(err);
      if(result.length === 0) {
        err = new Error('Der User `'+authorUUID+'` oder die zu bewertende Node `'+targetUUID+'` konnte nicht gefunden werden');
        err.status = 404;
        err.name = 'NodeNotFound';
        return cb(err);
      }

      dbhelper.getNodeByID(result[0].r._id, function (err, node) {
        if (err) return cb(err);
        var r = new Rating(node);
        return cb(null, r);
      });

    });

};


/**
 * @function Liefert ein Objekt mit den aktuellen Werten für die einzelnen Kriterien und einen Durchschnitt
 */
Rating.prototype.getRating = function() {

  var self = this;

  var res = {}, sum = 0;

  // baut ein Objekt aus den Arrays `names` und `values`
  for(var i = 0; i < self.names.length; i++) {
    res[self.names[i]] = self.values[i];
    sum += self.values[i];
  }

  return {
    ratings: res,
    avg: sum / self.names.length
  };

};

/**
 * @function Liefert alle Bewertungen einer Bewertung, falls welche bestehen
 */
Rating.prototype.getRatings = function(callback) {

  var self = this;

  var query = [
    'MATCH (n {uuid: {selfUUID}})<-[:RATES]-(r:Rating)',
    'RETURN r'
  ].join('\n');

  var params = {
    selfUUID: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    var ratings = result.map(function(i) {
      var r = new Rating(i.r);
      return r;
    });
    return callback(null, ratings);
  });

};

/**
 * @function Helferfunktion um das Hauptlernziel, zu dem dieses Rating gehört, zu erhalten
 */
Rating.prototype.getParentEntryTarget = function(callback) {

  var self = this;

  var query = [
    'MATCH (r:Rating {uuid: {uuid}})-[:RATES]->(n)',
    'RETURN n'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    // da Ratings an verschiedenen Nodes hängen können (Aufgaben, Lösungen, Infos oder anderen Ratings),
    // ist es am Besten die jeweilige getParentEntryTarget()-Funktion des jeweiligen Typs aufzurufen
    var node = result[0].n;
    var labels = node.labels;

    if(labels.indexOf('Task') > -1) {
       node = new Task(node);
    } else if(labels.indexOf('Solution') > -1) {
      node = new Solution(node);
    } else if(labels.indexOf('Info') > -1) {
      node = new Info(node);
    } else {
      node = new Rating(node);
    }

    node.getParentEntryTarget(callback);
  });

};

/**
 * @function Helferfunktion um das unmittelbar nächste Lernziel, zu dem dieses Rating gehört, zu erhalten
 */
Rating.prototype.getParentTarget = function(callback) {

  var self = this;

  var query = [
    'MATCH (r:Rating {uuid: {uuid}})-[:RATES]->(n)',
    'RETURN n'
  ].join('\n');

  var params = {
    uuid: self.uuid
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if(err) return callback(err);
    // da Ratings an verschiedenen Nodes hängen können (Aufgaben, Lösungen, Infos oder anderen Ratings),
    // ist es am Besten die jeweilige getParentTarget()-Funktion des jeweiligen Typs aufzurufen
    var node = result[0].n;
    var labels = node.labels;

    if(labels.indexOf('Task') > -1) {
       node = new Task(node);
    } else if(labels.indexOf('Solution') > -1) {
      node = new Solution(node);
    } else if(labels.indexOf('Info') > -1) {
      node = new Info(node);
    } else {
      node = new Rating(node);
    }

    node.getParentTarget(callback);
  });

};

/**
 * @function Fügt Metadaten hinzu
 * @param {string} apiVersion Ein vorangestellter String zur Vervollständigung der URL
 */
Rating.prototype.addMetadata = function (apiVersion) {

  // Bewertungen sollen anonym sein
  if(this.properties.author) {
    delete this.properties.author;
  }

  apiVersion = apiVersion || '';
  var base = apiVersion + '/ratings/' + encodeURIComponent(this.uuid);

  var links = {};
  links.ref = base;
  // links.author = apiVersion + '/users/' + encodeURIComponent(this.properties.author); // Bewertungen sollen anonym sein
  links.ratings = base + '/ratings';
  links.rating = base + '/rating';
  links.status = base + '/status';
  this.links = links;

};
