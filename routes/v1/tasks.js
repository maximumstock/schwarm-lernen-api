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
var Rating = require('../../models/rating');

var indicative = require('indicative');
var validator = new indicative();

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

            user.rate(req.params.taskUUID, req.body, config.ratePoints, config.rateCost, config.rateMultiplier, function(err, result) {
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

  // überprüfe ob der Nutzer noch Aufgaben erstellen darf
  // falls < 0: es gibt kein Limit/keine Mindestanzahl um das Paket zu beenden
  // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
  // falls > 0: Einstellung möglich
  if(user.solutionsToDo !== 0) {

    // überprüfe ob der Nutzer noch genug Punkte hat
    user.hasPoints(config.solutionCost, function(err, heDoes) {
      if(err) return next(err);
      if(!heDoes) {
        err = new Error('Du hast nicht genug Punkte um eine Lösung abzugeben');
        err.status = 409;
        err.name = 'MissingPoints';
        return next(err);
      } else {
        Solution.create(req.body, task.uuid, req.user.uuid, config.solutionPoints, config.solutionCost, function(err, solution) {
          if(err) return next(err);
          solution.addMetadata(API_VERSION);
          res.json(solution);
          user.didWorkOnPackage({tasks: 0, infos: 0, solutions: 1, ratings: 0}, config, function(err, result) {
            if(err) console.error(err);
          });
        });
      }
    });

  } else {
    // Nutzer muss erst Paket abarbeiten
    var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Lösungen erstellen darfst');
    err.status = 409;
    err.name = 'WorkPackageNotDone';
    res.json(err);
  }

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
