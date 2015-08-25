/**
 * @file Validierungsmodul für z.B. Modelleigenschaften
 * @description Hiermit können die Attribute für Datenmodellfunktionen wie z.B. `Modul#create` beschränkt/überprüft werden.
 */

var errors = require('../errors/errors');

// Helferfunktion

/**
 * @function valdiateProp
 * @param {string} prop Name des Attributs
 * @param {mixed} val Wert des Attributs
 * @param {boolean} require Angabe ob das Attribut erforderlich ist oder nicht
 * @param {object} validationInfo Ein Objekt dass die Anforderungen an die Attribute beschreibt
 * @throws ValidationError
 * @description Validiert das gegebene Attribute.
 * Standardmäßig werden leere/undefiniert/NULL-Werte ignoriert.
 */
function validateProp(validationInfo, prop, val, required) {
    var info = validationInfo[prop];
    var message = info.message;

    if (!val) {
        if (info.required && required) {
            throw new errors.ValidationError(
                'Fehlendes Attribut ' + prop + ' (erforderlich).');
        } else {
            return;
        }
    }

    if (info.minLength && val.length < info.minLength) {
        throw new errors.ValidationError(
            'Ungültiges Attribut ' + prop + ' (zu kurz). Anforderungen: ' + message);
    }

    if (info.maxLength && val.length > info.maxLength) {
        throw new errors.ValidationError(
            'Ungültiges Attribut ' + prop + ' (zu lang). Anforderungen: ' + message);
    }

    if (info.pattern && !info.pattern.test(val)) {
        throw new errors.ValidationError(
            'Ungültiges Attribut ' + prop + ' (Format). Anforderungen: ' + message);
    }
}

module.exports = {

  /**
   * @function Validiert ein JSON-Objekt von Attributen gemäß Vorgaben
   * @param {object} validationInfo Ein Objekt dass die Anforderungen an die Attribute beschreibt
   * @param {object} props Die zu validierenden Eigenschaften
   * @param {boolean} required Falls `true` müssen alle `required` Attribute vorhanden sein
   */
  validate: function(validationInfo, props, required) {
    var safeProps = {};

    // führt Validierung für alle Attribute aus für die Validierungsinformationen gegeben sind und die in `props`
    // gesendet wurden
    for (var prop in validationInfo) {
        var val = props[prop];
        validateProp(validationInfo, prop, val, required);
        safeProps[prop] = val;
    }

    // jetzt noch alle neuen, unbekannten Attribute aus `props` anhängen
    for(var newProp in props) {

      // die uuid sollte nie vom Client im Request-Body (nur bei POST, PUT) gesendet werden
      // da die uuid nur von NEO4J gesetzt und niemals geupdated werden sollte
      if (newProp === 'uuid') {
        throw new errors.ValidationError(
          'Ungültiges Attribut ' + prop + '. Die UUID darf nie selbst gesetzt oder aktualisiert werden'
        );
      }

      // falls das Attribut in der oberen Schleife noch nicht hinzugefügt wurde, ist es neu
      if(safeProps.hasOwnProperty(newProp) === false) {
        safeProps[newProp] = props[newProp];
      }
    }

    return safeProps;
  }

};
