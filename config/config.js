/**
 * @file Modul zum Laden der Serverkonfiguration
 * @author Maximilian Stock
 * Dieses Modul lädt die jeweilige Konfiguration basierend auf der Umgebungsvariable `NODE_ENV`.
 * Durch das Setzen der Umgebungsvariable `NODE_ENV` kann die Auswahl beeinflusst werden.
 */

module.exports = function() {

  var config = {};

  // `development` als Default, falls die Umgebungsvariable nicht gesetzt ist
  switch (process.NODE_ENV || 'development') {
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

  return config;

}(process.env);
