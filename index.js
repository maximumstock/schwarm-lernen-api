/**
 * @file Einstiegspunkt für die V8-Runtime. Startet den Webserver.
 * @author Maximilian Stock
 */

// Laden der Middleware
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');

// Erstellen des Servers
var app = express();

// Einbinden der Middleware in die Requestverarbeitung
// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

// Konfigurationsdatei laden
var config = require('./config/config');

// Routen einbinden
var routes = require('./routes/index');
app.use('/', routes);

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
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// Fehlerhandler für Produktivbetrieb
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
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
})




module.exports = app;
