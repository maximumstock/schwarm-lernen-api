/**
 * @file Enthält das Datenmodell und die Businessregeln für Module.
 * @author Maximilian Stock
 */

var neo4j = require('neo4j');
var config = require('../config/config');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

/**
 * @function Privater Konstruktor für ein Modul
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Modul = module.exports = function Modul(_node) {
  // Speichern der Node als Instanzvariable
  // Dadurch werden alle Labels und Properties aus der Datenbank in diesem Objekt gespeichert
  this._node = _node;
}

// Öffentliche Instanzvariablen mit Gettern und Settern

/**
 * @function
 * Propertydefinition für den Namen des Moduls
 * @prop {string} name Name des Moduls
 */
Object.defineProperty(Modul.prototype, 'name', {
  get: function() {
    return this._node.properties['name'];
  }
});

// Öffentliche Methoden

// Statische Methoden

/**
 * @function
 * @name get
 * @param {string} name Name des gesuchten Moduls
 * @param {callback} callback Callbackfunktion die das Ergebnis entgegen nimmt
 */
Modul.get = function(name, callback) {

  var query = [
    'MATCH (m:Modul {name: {name}})',
    'RETURN m'
  ].join('\n');

  var params = {
    name: name
  };

  db.cypher({
    query: query,
    params: params
  }, function(err, result) {
    if (err) return callback(err);
    if (result.length === 0) {
      err = new Error('Es wurde kein Modul namens %s gefunden', name);
      return callback(err);
    }
    // erstelle neue Modulinstanz und gib diese zurück
    var m = new Modul(result[0]['m']);
    callback(null, m);
  })

}
