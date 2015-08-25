/* Helferfunktionen für die Nutzung mit den Datenmodellen */

var neo4j = require('neo4j');
var config = require('../config/config');
var db = new neo4j.GraphDatabase(config.NEO4J_URL);

module.exports = {

  /**
   * @function Gibt die Node mit der ID @id zurück
   * @param {number} id Die ID der Node
   */
  getNodeById: function(id, callback) {

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
    }, callback);

  }

};
