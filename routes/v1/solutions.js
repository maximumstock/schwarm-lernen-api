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

  var solution = req._solution;
  var user = req.user;

  solution.getRating(function(err, rating) {
    if(err) return next(err);
    user.getMyRatingFor(solution.uuid, function(err, myrating) {
      if(err) return next(err);
      rating.myRating = myrating;
      res.json(rating);
    });
  });

});

// Gibt Kommentare zu der Aufgabe zurück
router.get('/solutions/:solutionUUID/comments', helper.prefetchSolution, auth.restricted, function(req, res, next) {

  var solution = req._solution;
  solution.getComments(function(err, comments) {
    if(err) return next(err);
    comments.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(comments);
  });

});

// Fügt Rating hinzu
router.post('/solutions/:solutionUUID/rating', helper.prefetchSolution, auth.restricted, helper.prefetchConfig, function(req, res, next) {

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

  user.rate(req.params.solutionUUID, req.body, config.ratePoints, function(err, result) {
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

  var solution = req._solution;
  solution.getParent(function(err, target) {
    if(err) return next(err);
    target.addMetadata(API_VERSION);
    res.json(target);
  });

});


/**************************************************
              ADMIN ONLY ROUTES
**************************************************/

// Toggled den Status der Ressource zu inaktiv/aktiv
router.put('/solutions/:solutionUUID/status', helper.prefetchSolution, auth.adminOnly, function(req, res, next) {

  var solution = req._solution;
  solution.toggle(function(err, result) {
    if(err) return next(err);
    Solution.get(solution.uuid, function(err, s) {
      if(err) return next(err);
      s.addMetadata(API_VERSION);
      res.json(s);
    });
  });

});

module.exports = router;
