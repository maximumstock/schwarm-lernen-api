/**
 * @file Einstiegspunkt für die V8-Runtime. Startet den Webserver.
 */

// Laden der Middleware
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var compression = require('compression');
var validator = require('express-validator');

// Erstellen des Serverinstanz
var app = express();

// Einbinden der Middleware in die Requestverarbeitung
// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(validator());
app.use(compression()); // Gzip Kompression

// Konfigurationsdatei laden
var config = require('./config/config');

// Routen einbinden
var apiv1 = require('./routes/v1/index');
app.use('/api/v1', apiv1);

// 404 Fehler abfangen
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Fehlerbehandlung

// Fehlerhandler für Testumgebung
// hierbei wird der Stacktrace des Fehlers mit ausgegeben
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: err.message,
      error: err
    });
  });
}

// Fehlerhandler für Produktivbetrieb (kein Stacktrace)
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: {}
  });
});

// Starten des Webservers
var server = app.listen(config.port || 4003, function(error) {
  // Fehler beim Starten
  if (error) {
    throw error;
  }
  // Keine Fehler
  console.log('Webserver läuft auf Port %d', server.address().port);
});

module.exports = app;
