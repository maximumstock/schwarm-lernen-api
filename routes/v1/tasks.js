'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');

var Target = require('../../models/target');
var Info = require('../../models/info');
var Task = require('../../models/task');
var Comment = require('../../models/comment');
var Solution = require('../../models/solution');

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
              DEGREE RESTRICTED ROUTES
**************************************************/

// Gibt eine bestimmte Aufgabe zurück
router.get('/tasks/:taskUUID', helper.prefetchTask, auth.restricted, function(req, res, next) {
  var task = req._task;
  task.addMetadata(API_VERSION);
  res.json(task);
});

// Gibt Bewertung der Aufgabe zurück
router.get('/tasks/:taskUUID/rating', helper.prefetchTask, auth.restricted, function(req, res, next) {

  var task = req._task;
  task.getRating(function(err, rating) {
    if(err) return next(err);
    res.json(rating);
  });

});

// Gibt Kommentare zu der Aufgabe zurück
router.get('/tasks/:taskUUID/comments', helper.prefetchTask, auth.restricted, function(req, res, next) {

  var task = req._task;
  task.getComments(function(err, comments) {
    if(err) return next(err);
    comments.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(comments);
  });

});

// Fügt Rating hinzu
router.post('/tasks/:taskUUID/rating', helper.prefetchTask, auth.restricted, function(req, res, next) {

  req.checkBody('rating', 'Bewertung fehlt').notEmpty();
  req.checkBody('rating', 'Der Bewertungsparameter muss ein Ganzzahlwert sein').isInt();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var user = req.user;
  user.rate(req.params.taskUUID, parseInt(req.body.rating), function(err, result) {
    if(err) return next(err);
    res.status(201).json({success: true});
  });

});

// Fügt Kommentar hinzu
router.post('/tasks/:taskUUID/comments', helper.prefetchTask, auth.restricted, function(req, res, next) {

  req.checkBody('comment', 'Inhalt des Kommentars fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  Comment.create(req.body, req.params.taskUUID, req.user.uuid, function(err, comment) {
    if(err) return next(err);
    comment.addMetadata(API_VERSION);
    res.status(201).json(comment);
  });

});

// Alle Lösungen für eine Aufgabe
router.get('/tasks/:taskUUID/solutions', helper.prefetchTask, auth.restricted, function(req, res, next) {

  var task = req._task;
  task.getSolutions(function(err, solutions) {
    if(err) return next(err);
    solutions.forEach(function(s) {
      s.addMetadata(API_VERSION);
    });
    res.json(solutions);
  });

});

// Lösung des aktuellen Users für eine bestimmte Aufgabe
router.get('/tasks/:taskUUID/solution', helper.prefetchTask, auth.restricted, function(req, res, next) {

  var task = req._task;
  var user = req.user;

  user.getSolutionByTask(task.uuid, function(err, solution) {
    if(err) return next(err);
    solution.addMetadata(API_VERSION);
    res.json(solution);
  });

});

// Neue Lösung für Aufgabe
router.post('/tasks/:taskUUID/solutions', helper.prefetchTask, auth.restricted, function(req, res, next) {

  req.checkBody('description', 'Inhalt der Lösung fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var task = req._task;
  Solution.create(req.body, task.uuid, req.user.uuid, function(err, solution) {
    if(err) return next(err);
    solution.addMetadata(API_VERSION);
    res.json(solution);
  });

});

// Lernziel an dem die Aufgabe hängt
router.get('/tasks/:taskUUID/target', helper.prefetchTask, auth.restricted, function(req, res, next) {

  var task = req._task;
  task.getParent(function(err, target) {
    if(err) return next(err);
    target.addMetadata(API_VERSION);
    res.json(target);
  });

});

module.exports = router;
