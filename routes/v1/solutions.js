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
var Rating = require('../../models/rating');

var indicative = require('indicative');
var validator = new indicative();

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

  validator
    .validate(Rating.VALIDATION_RULES, req.body)
    .then(function() {

      var user = req.user;
      var config = req._config;

      // überprüfe ob der Nutzer noch Bewertungen erstellen darf
      // falls < 0: es gibt kein Limit/keine Mindestanzahl um das Paket zu beenden
      // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
      // falls > 0: Einstellung möglich
      if(user.ratingsToDo !== 0) {

        // überprüfe ob der Nutzer noch genug Punkte hat
        user.hasPoints(config.ratingCost, function(err, heDoes) {
          if(err) return next(err);
          if(!heDoes) {
            err = new Error('Du hast nicht genug Punkte um eine Bewertung abzugeben');
            err.status = 409;
            err.name = 'MissingPoints';
            return next(err);
          } else {

            user.rate(req.params.solutionUUID, req.body, config.ratePoints, config.rateCost, config.rateMultiplier, function(err, result) {
              if(err) return next(err);
              res.status(201).json({success: true});

              user.didWorkOnPackage({tasks: 0, infos: 0, solutions: 0, ratings: 1}, config, function(err, result) {
                if(err) console.error(err);
              });
            });
          }
        });

      } else {
        // Nutzer muss erst Paket abarbeiten
        var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Bewertungen erstellen darfst');
        err.status = 409;
        err.name = 'WorkPackageNotDone';
        res.json(err);
      }

    })
    .catch(function(errors) {
      return next(errors);
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
