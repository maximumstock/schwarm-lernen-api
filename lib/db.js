'use strict';

/* Helferfunktionen für die Nutzung mit den Datenmodellen */

var neo4j = require('neo4j');
var config = require('../lib/config/config');
var db = new neo4j.GraphDatabase(config.NEO4J_URL);

module.exports = {

  /**
   * @function Gibt die Node mit der ID @id zurück
   * @param {number} id Die ID der Node
   */
  getNodeByID: function(id, callback) {

    var query = [
      'MATCH (x)',
      'WHERE ID(x) = {id}',
      'RETURN x'
    ].join('\n');

    var params = {
      id: id
    };

    db.cypher({
      query: query,
      params: params
    }, function(err, result) {
      callback(err, result[0].x);
    });

  },


  /**
   * @function Überprüft ob eine ID eine Info, ein Task, eine Solution, o.ä. kommentierbares ist
   * @param {number} id Die ID der Node
   */
  isCommentable: function(uuid, callback) {

    var query = [
      'MATCH (x {uuid: {uuid}})',
      'WHERE x:Info or x:Task or x:Solution',
      'RETURN x'
    ].join('\n');

    var params = {
      uuid: uuid
    };

    db.cypher({
      query: query,
      params: params
    }, function(err, result) {
      if(err) return callback(err);
      if(result.length === 0) return callback(null, false);
      else callback(null, true);
    });

  }
};
