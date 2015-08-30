'use strict';

/**
 * @file Modul zum Laden der Serverkonfiguration
 * Dieses Modul lädt die jeweilige Konfiguration basierend auf der Umgebungsvariable `NODE_ENV`.
 * Durch das Setzen der Umgebungsvariable `NODE_ENV` kann die Auswahl beeinflusst werden.
 */

module.exports = function() {
  var config = {};

  console.log(process.env.NODE_ENV);
  // `development` als Default, falls die Umgebungsvariable nicht gesetzt ist
  switch (process.env.NODE_ENV || 'development') {
    case 'development':
      config = require('./env/development');
      break;
    case 'production':
      config = require('./env/production');
      break;
    case 'testing':
      config = require('./env/testing');
      break;
  }

  console.log(config);
  return config;

}(process.NODE_ENV);
