'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');
var async = require('async');

var Task = require('../../models/task');
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

// Gibt Bewertung der Lösung zurück
router.get('/solutions/:solutionUUID/ratings', helper.prefetchSolution, auth.restricted, helper.alreadyRatedRestricted, function(req, res, next) {

  var solution = req._solution;
  var user = req.user;

  solution.getRatings(function(err, ratings) {
    if(err) return next(err);
    ratings.forEach(function(r) {
      r.addMetadata(API_VERSION);
    });
    res.json(ratings);
  });

});

// Gibt eigene Bewertung für die Lösung zurück, falls eine existiert
router.get('/solutions/:solutionUUID/rating', helper.prefetchSolution, auth.restricted, function(req, res, next) {

  var solution = req._solution;
  var user = req.user;

  user.getMyRatingFor(solution.uuid, function(err, myrating) {
    if(err) return next(err);
    myrating.addMetadata(API_VERSION);
    res.json(myrating);
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
router.post('/solutions/:solutionUUID/ratings', helper.prefetchSolution, auth.restricted, helper.prefetchConfig, function(req, res, next) {

  var user = req.user;
  var config = req._config;
  var pack = req._package;
  var solution = req._solution;

  // eigentliche Funktion die die Bewertung erstellt, Punkte verteilt, etc.
  function create() {
    Rating.create(req.body, user.uuid, solution.uuid, function(err, rating) {
      if(err) return next(err);
      rating.addMetadata(API_VERSION);
      // Admins brauchen keine Punkte, etc
      if(user.isAdmin()) {
        return res.status(201).json(rating);
      }

      // Arbeitspaket aktualisieren
      // Punkte an den Ersteller der Bewertung verteilen
      // Punkte vom Ersteller der Bewertung abziehen
      // Punkte an den Ersteller des bewerteten Inhalts verteilen
      async.parallel([
        function(_cb) { pack.updatePackage({ratings: 1}, config, _cb); },
        function(_cb) { rating.givePointsTo(user.uuid, {points: config.ratePoints}, _cb); },
        function(_cb) { rating.takePointsFrom(user.uuid, {points: config.rateCost}, _cb); },
        function(_cb) { rating.givePointsTo(solution.author, {points: rating.getRating().avg, prestige: user.prestige, maxpoints: config.solutionMaxPoints}, _cb); }
      ], function(errors, results) {
        if(errors) next(errors);
        return res.status(201).json({success: true});
      });
    });
  }

  // Admins dürfen sowieso
  if(user.isAdmin()) {
    create();
  } else {
    // der User sollte seine eigenen Inhalte nicht bewerten dürfen
    user.hasCreated(solution.uuid, function(err, hasCreated) {
      if(err) return next(err);
      if(hasCreated) {
        err = new Error('Du darfst nicht deine eigenen Inhalte bewerten.');
        err.status = 409;
        return next(err);
      }

      // überprüfe ob der Nutzer noch Bewertungen erstellen darf
      // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
      if(user.ratingsToDo === 0) {
        // Nutzer muss erst Paket abarbeiten
        err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Bewertungen erstellen darfst');
        err.status = 409;
        err.name = 'WorkPackageNotDone';
        return next(err);
      }
      // falls > 0: Einstellung möglich
      // überprüfe ob der Nutzer noch genug Punkte hat
      user.hasPoints(config.rateCost, function(err, heDoes) {
        if(err) return next(err);
        if(!heDoes) {
          err = new Error('Du hast nicht genug Punkte um eine Bewertung abzugeben');
          err.status = 409;
          err.name = 'MissingPoints';
          return next(err);
        }

        create();

      });
    });
  }

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

/**************************************************
              AUTHOR ONLY ROUTES
**************************************************/

// Finalisiert die Aufgabe und macht sie öffentlich
router.put('/solutions/:solutionUUID/submit', helper.prefetchSolution, auth.authorOnly, function(req, res, next) {

  var solution = req._solution;
  var user = req.user;

  solution.finalize(function(err, result) {
    if(err) return next(err);
    Solution.get(solution.uuid, function(err, solution) {
      if(err) return next(err);
      solution.addMetadata(API_VERSION);
      res.json(solution);
    });
  });

});

// Aktualisiert die Lösung
router.put('/solutions/:solutionUUID', helper.prefetchSolution, auth.authorOnly, function(req, res, next) {

  var solution = req._solution;

  if(solution.isFinished()) {
    var err = new Error('Diese Lösung wurde bereits abgegeben. Du kannst sie nicht mehr verändern.');
    err.status = 409;
    err.name = 'AlreadySubmitted';
    return next(err);
  }

  solution.patch(req.body, function(err, nsolution) {
    if(err) return next(err);
    nsolution.addMetadata(API_VERSION);
    res.json(nsolution);
  });

});

module.exports = router;
