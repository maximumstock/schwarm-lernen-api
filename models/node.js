'use strict';

/**
 * @file Basisprototyp für alle weiteren Datenmodelle.
 */

var moment = require('moment');

/**
 * @function Konstruktor
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Node = module.exports = function Node(_node) {
  // Speichern der Node als Instanzvariable
  // Dadurch werden alle Labels und Properties aus der Datenbank in diesem Objekt gespeichert
  this.labels = _node.labels;
  this.properties = _node.properties;
};

// Öffentliche Konstanten

// Öffentliche Instanzvariablen mit Gettern und Settern
/**
 * @function Propertydefinition für die UUID der Node
 * @prop {string} uuid UUID der Node
 */
Object.defineProperty(Node.prototype, 'uuid', {
  get: function () {
    return this.properties.uuid;
  }
});
