'use strict';

/**
 * @file Routen für Aufgaben anlegen
 */

var express = require('express');
var router = express.Router();
var Task = require('../../models/task');
var config = require('../../config/config');

var apiVersion = config.HOST_URL + '/api/v1';

// Alle Aufgaben zurückgeben
router.get('/tasks', function(req, res, next) {

  Task.getAll(function(err, result) {

    if(err) return next(err);
    result.forEach(function(e) {
      e.addMetadata(apiVersion);
      e.author.addMetadata(apiVersion);
    });
    res.json(result);

  });

});

// Gibt eine bestimmte Aufgabe zurück
router.get('/tasks/:uuid', function(req, res, next) {

  Task.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.addMetadata(apiVersion);
    t.author.addMetadata(apiVersion);
    res.json(t);
  });

});

// Gibt den Autor für eine bestimmte Aufgabe zurück
router.get('/tasks/:uuid/author', function(req, res, next) {

  Task.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.getAuthor(function(err, u) {
      if(err) return next(err);
      u.addMetadata(apiVersion);
      res.json(u);
    });
  });

});

// Gibt alle Lösungen für eine Aufgabe zurück
router.get('/tasks/:uuid/solutions', function(req, res, next) {

  Task.get(req.params.uuid, function(err, a) {

    if(err) return next(err);
    a.getSolutions(function(err, solutions) {
      if(err) return next(err);
      solutions.forEach(function(s) {
        s.addMetadata(apiVersion);
      });
      res.json(solutions);
    });

  });

});

// Gibt alle Kommentare für eine Aufgabe zurück
router.get('/tasks/:uuid/comments', function(req, res, next) {

  Task.get(req.params.uuid, function(err, a) {

    if(err) return next(err);
    a.getComments(function(err, comments) {
      if(err) return next(err);
      comments.forEach(function(s) {
        s.addMetadata(apiVersion);
      });
      res.json(comments);
    });

  });

});


// Aufgaben erstellen
router.post('/tasks', function(req, res, next) {

  req.checkBody('description', 'Inhalt der Aufgabe fehlt').notEmpty();
  req.checkBody('parent', 'UUID des Parents fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) {
    errors.status = 400;
    return next(errors);
  }

  var parentUUID = req.body.parent;
  var properties = req.body;

  Task.create(properties, parentUUID, req.user.uuid, function(err, t) {

    if(err) return next(err);
    res.status(201).json(t);

  });

});

module.exports = router;
