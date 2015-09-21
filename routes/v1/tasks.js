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
  var user = req.user;

  task.getRating(function(err, rating) {
    if(err) return next(err);
    user.getMyRatingFor(task.uuid, function(err, myrating) {
      if(err) return next(err);
      rating.myRating = myrating;
      res.json(rating);
    });
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
router.post('/tasks/:taskUUID/rating', helper.prefetchTask, auth.restricted, helper.prefetchConfig, function(req, res, next) {

  req.checkBody('r1', 'Der Bewertungsparameter R1 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r2', 'Der Bewertungsparameter R2 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r3', 'Der Bewertungsparameter R3 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r4', 'Der Bewertungsparameter R4 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r5', 'Der Bewertungsparameter R5 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('comment', 'Der Bewertung muss noch ein Kommentar beiliegen').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  req.sanitizeBody('r1').toInt();
  req.sanitizeBody('r2').toInt();
  req.sanitizeBody('r3').toInt();
  req.sanitizeBody('r4').toInt();
  req.sanitizeBody('r5').toInt();

  var user = req.user;
  var config = req._config;

  user.rate(req.params.taskUUID, req.body, config.ratePoints, function(err, result) {
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
router.post('/tasks/:taskUUID/solutions', helper.prefetchTask, auth.restricted, helper.prefetchConfig, function(req, res, next) {

  req.checkBody('description', 'Inhalt der Lösung fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var task = req._task;
  var config = req._config;
  var user = req.user;

  // überprüfe ob der Nutzer noch genug Punkte hat
  user.hasPoints(config.solutionPoints, function(err, heDoes) {
    if(err) return next(err);
    if(!heDoes) {
      err = new Error('Du hast nicht genug Punkte um eine Lösung abzugeben');
      err.status = 409;
      err.name = 'MissingPoints';
      return next(err);
    } else {
      Solution.create(req.body, task.uuid, req.user.uuid, config.solutionPoints, function(err, solution) {
        if(err) return next(err);
        solution.addMetadata(API_VERSION);
        res.json(solution);
      });
    }
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


/**************************************************
              ADMIN ONLY ROUTES
**************************************************/

// Toggled den Status der Ressource zu inaktiv/aktiv
router.put('/tasks/:taskUUID/status', helper.prefetchTask, auth.adminOnly, function(req, res, next) {

  var task = req._task;
  task.toggle(function(err, result) {
    if(err) return next(err);
    Task.get(task.uuid, function(err, t) {
      if(err) return next(err);
      t.addMetadata(API_VERSION);
      res.json(t);
    });
  });

});

module.exports = router;
