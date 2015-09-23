'use strict';

/**
 * @file Validierungsmodul für z.B. Modelleigenschaften
 * @description Hiermit können die Attribute für Datenmodellfunktionen wie z.B. `Modul#create` beschränkt/überprüft werden.
 */

var indicative = new(require('indicative'));

module.exports = {

  /**
   * @function Validiert ein JSON-Objekt von Attributen gemäß Vorgaben
   * @param {object} validationInfo Ein Objekt dass die Anforderungen an die Attribute beschreibt
   * @param {object} props Die zu validierenden Eigenschaften
   */
  validate: function(rules, props, cb) {

    return indicative
      .validate(rules, props)
      .then(function(success) {

      })
      .error(function(errors) {
        cb(errors);
      });

  }

};
