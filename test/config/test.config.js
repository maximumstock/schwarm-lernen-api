/**
 * @file Testdatei für ddie korrekte Einbindung der jeweiligen Konfigurationsdatei für den Server aus dem Verzeichnis `./config`.
 * @author Maximilian Stock
 * Es wird jedoch lediglich die Einbindung der Konfiguration `development.json`
 * getestet, da die Einbindung aller anderen Dateien analog funktionieren.
 */

var expect = require('chai').expect;

describe('Konfiguration', function() {

  it('sollte JSON-Konfigurationsdatei korrekt laden', function(done) {

    // Konfiguration laden
    var config = require('../../config/config');

    // Testcases
    expect(config).to.be.an('object');
    expect(config.environment).to.be.a('string');

    // Fertig
    done();

  });

});
