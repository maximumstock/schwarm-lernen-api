'use strict';

/**
 * @file Enthält das Datenmodell und die Businessregeln für Lösungen.
 */

/**
 * @function Konstruktor für ein Rating
 * @constructs
 * @param {object} _node Das Ergebnisobjekt der Datenbankabfrage, welches die Nutzdaten der Node enthält.
 */
var Rating = module.exports = function (_node) {};

var indicative = require('indicative');
var validator = new indicative();

// Enthält Informationen zum Validieren von Attributen neuer Rating-Nodes
Rating.VALIDATION_RULES = {
  r1: 'required|integer|min:1|max:5',
  r2: 'required|integer|min:1|max:5',
  r3: 'required|integer|min:1|max:5',
  r4: 'required|integer|min:1|max:5',
  r5: 'required|integer|min:1|max:5',
  comment: 'required|string'
};

Rating.PROTECTED_ATTRIBUTES = ['createdAt', 'author', 'task'];
