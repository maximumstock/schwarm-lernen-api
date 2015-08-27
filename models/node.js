'use strict';

/**
 * @file Basisprototyp für alle weiteren Datenmodelle.
 */

/**
 * @function Konstruktor
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Node = module.exports = function Node(_node) {
  // Speichern der Node als Instanzvariable
  // Dadurch werden alle Labels und Properties aus der Datenbank in diesem Objekt gespeichert
  this._node = _node;
  delete this._node._id;
};

// Öffentliche Konstanten

// Öffentliche Instanzvariablen mit Gettern und Settern
/**
 * @function Propertydefinition für die UUID der Node
 * @prop {string} uuid UUID der Node
 */
Object.defineProperty(Node.prototype, 'uuid', {
  get: function () {
    return this._node.properties.uuid;
  }
});

/**
 * @function Propertydefinition für den Zeitstempel der Erstellung
 * @prop {string} created_at Zeitstempel der Erstellung
 */
Object.defineProperty(Node.prototype, 'createdAt', {
  get: function () {
    return this._node.properties.createdAt;
  }
});

/**
 * @function Propertydefinition für den Zeitstempel der letzen Änderung
 * @prop {string} created_at Zeitstempel der letzten Änderung
 */
Object.defineProperty(Node.prototype, 'changedAt', {
  get: function () {
    return this._node.properties.changedAt;
  }
});
