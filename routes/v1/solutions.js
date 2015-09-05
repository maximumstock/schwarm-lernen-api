'use strict';

/**
 * @file Routen für Lösungen anlegen
 */

var express = require('express');
var router = express.Router();
var Solution = require('../../models/solution');
var config = require('../../config/config');

var apiVersion = config.HOST_URL + '/api/v1';

// Alle Lösungen zurückgeben
router.get('/solutions', function(req, res, next) {

  Solution.getAll(function(err, result) {

    if(err) return next(err);
    result.forEach(function(t) {
      t.addMetadata(apiVersion);
      t.author.addMetadata(apiVersion);
    });
    res.json(result);

  });

});

// Gibt eine bestimmte Lösung zurück
router.get('/solutions/:uuid', function(req, res, next) {

  Solution.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.addMetadata(apiVersion);
    t.author.addMetadata(apiVersion);
    res.json(t);
  });

});

// Gibt den Autor für eine bestimmte Lösung zurück
router.get('/solutions/:uuid/author', function(req, res, next) {

  Solution.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.author(function(err, u) {
      if(err) return next(err);
      u.addMetadata(apiVersion);
      res.json(u._node);
    });
  });

});

// Gibt die Aufgabe für eine bestimmte Lösung zurück
router.get('/solutions/:uuid/task', function(req, res, next) {

  Solution.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.task(function(err, a) {
      if(err) return next(err);
      a.addMetadata(apiVersion);
      res.json(a._node);
    });
  });

});

// Gibt alle Kommentare für eine bestimmte Lösung zurück
router.get('/solutions/:uuid/comments', function(req, res, next) {

  Solution.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.comments(function(err, comments) {
      if(err) return next(err);
      comments = comments.map(function(c) {
        c.addMetadata(apiVersion);
        return c._node;
      });
      res.json(comments);
    });
  });

});


// Aufgaben erstellen
router.post('/solutions', function(req, res, next) {

  req.checkBody('description', 'Inhalt der Lösung fehlt').notEmpty();
  req.checkBody('task', 'UUID der Aufgabe fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var taskUUID = req.body.task;
  var properties = req.body;

  Solution.create(properties, taskUUID, req.user.uuid, function(err, s) {

    if(err) return next(err);
    res.status(201).json(s);

  });

});

// TODO überhaupt iwas löschen/updaten?!

module.exports = router;
