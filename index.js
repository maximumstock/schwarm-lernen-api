'use strict';

/**
 * @file Einstiegspunkt für die V8-Runtime. Startet den Webserver.
 */

// Laden der Middleware
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var compression = require('compression');
var validator = require('express-validator');

// Erstellen des Serverinstanz
var app = express();

// Einbinden der Middleware in die Requestverarbeitung
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(validator());
app.use(compression()); // Gzip Kompression

// immer mit Content-Type application/json antworten da JSON-only
app.use(function(req, res, next) {
  res.set('Content-Type', 'application/json');
  res.set('X-Content-Type-Options', 'nosniff'); // Damit IE kein JSON als HTML missversteht
  next();
});

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

// Fehlerbehandlung von Requests mit fehlenden Informationen (express-validator gibt Array zurück)
app.use(function(err, req, res, next) {
  if(Array.isArray(err)) {
    res.status(400);
    res.json(err);
  } else {
    next(err);
  }
});

// Fehlerhandler für Testumgebung
// hierbei wird der Stacktrace des Fehlers ausgegeben
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
  console.log('Server läuft auf Port %d', server.address().port);
});

module.exports = app;
