'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');

var Task = require('../../models/task');
var Comment = require('../../models/comment');
var Solution = require('../../models/solution');

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
              DEGREE RESTRICTED ROUTES
**************************************************/

// Gibt eine bestimmte Lösung zurück
router.get('/solutions/:solutionUUID', helper.prefetchSolution, auth.restricted, function(req, res, next) {
  var solution = req._solution;
  solution.addMetadata(API_VERSION);
  res.json(solution);
});

// Gibt Bewertung der Aufgabe zurück
router.get('/solutions/:solutionUUID/rating', helper.prefetchSolution, auth.restricted, function(req, res, next) {

  var task = req._task;
  task.getRating(function(err, rating) {
    if(err) return next(err);
    res.json(rating);
  });

});

// Gibt Kommentare zu der Aufgabe zurück
router.get('/solutions/:solutionUUID/comments', helper.prefetchSolution, auth.restricted, function(req, res, next) {

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
router.post('/solutions/:solutionUUID/rating', helper.prefetchSolution, auth.restricted, function(req, res, next) {

  req.checkBody('rating', 'Bewertung fehlt').notEmpty();
  req.checkBody('rating', 'Der Bewertungsparameter muss ein Ganzzahlwert sein').isInt();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var user = req.user;
  user.rate(req.params.solutionUUID, parseInt(req.body.rating), function(err, result) {
    if(err) return next(err);
    res.status(201).json({success: true});
  });

});

// Fügt Kommentar hinzu
router.post('/solutions/:solutionUUID/comments', helper.prefetchSolution, auth.restricted, function(req, res, next) {

  req.checkBody('comment', 'Inhalt des Kommentars fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  Comment.create(req.body, req.params.solutionUUID, req.user.uuid, function(err, comment) {
    if(err) return next(err);
    comment.addMetadata(API_VERSION);
    res.status(201).json(comment);
  });

});

// Aufgabe an dem die Lösung hängt
router.get('/solutions/:solutionUUID/task', helper.prefetchSolution, auth.restricted, function(req, res, next) {

  var task = req._task;
  task.getParent(function(err, target) {
    if(err) return next(err);
    target.addMetadata(API_VERSION);
    res.json(target);
  });

});

module.exports = router;
