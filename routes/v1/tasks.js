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

var Target = require('../../models/target');
var Info = require('../../models/info');
var Task = require('../../models/task');
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
router.get('/tasks/:taskUUID/ratings', helper.prefetchTask, auth.restricted, function(req, res, next) {

  var task = req._task;
  var user = req.user;

  task.getRatings(function(err, ratings) {
    if(err) return next(err);
    ratings.forEach(function(r) {
      r.addMetadata(API_VERSION);
    });
    res.json(ratings);
  });

});

// Gibt eigene Bewertung für die Aufgabe zurück, falls eine existiert
router.get('/tasks/:taskUUID/rating', helper.prefetchTask, auth.restricted, function(req, res, next) {

  var task = req._task;
  var user = req.user;

  user.getMyRatingFor(task.uuid, function(err, myrating) {
    if(err) return next(err);
    myrating.addMetadata(API_VERSION);
    res.json(myrating);
  });

});

// Fügt Rating hinzu
router.post('/tasks/:taskUUID/ratings', helper.prefetchTask, auth.restricted, helper.prefetchConfig, helper.prefetchPackage, function(req, res, next) {

  var user = req.user;
  var config = req._config;
  var pack = req._package;
  var task = req._task;

  // eigentliche Funktion die die Bewertung erstellt, Punkte verteilt, etc.
  function create() {
    Rating.create(req.body, user.uuid, task.uuid, function(err, rating) {
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
        function(_cb) { rating.givePointsTo(user.uuid, {points: config.ratingPoints}, _cb); },
        function(_cb) { rating.takePointsFrom(user.uuid, {points: config.ratingCost}, _cb); },
        function(_cb) { rating.givePointsTo(task.author, {points: rating.getRating().avg, prestige: user.prestige}, _cb); }
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
    user.hasCreated(task.uuid, function(err, hasCreated) {
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
      user.hasPoints(config.ratingCost, function(err, heDoes) {
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
router.post('/tasks/:taskUUID/solutions', helper.prefetchTask, auth.restricted, helper.prefetchConfig, helper.prefetchPackage, function(req, res, next) {

  req.checkBody('description', 'Inhalt der Lösung fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var task = req._task;
  var config = req._config;
  var user = req.user;
  var pack = req._package;

  // eigentliche Funktion die Lösung erstellt und Punktevergabe, etc. ausführt
  function create() {
    Solution.create(req.body, task.uuid, req.user.uuid, function(err, solution) {
      if(err) return next(err);
      solution.addMetadata(API_VERSION);

      // Admins brauchen keine Punkte, etc
      if(user.isAdmin()) {
        return res.status(201).json(solution);
      }

      // arbeitspaket aktualisieren
      // Punkte an den User verteilen, der die Lösung eingestellt hat
      // Punkte vom User als Gebühr abzwicken, der die Lösung eingestellt hat
      async.parallel([
        function(_cb) {pack.updatePackage({solutions: 1}, config, _cb);},
        function(_cb) {solution.givePointsTo(user.uuid, config.solutionPoints, _cb);},
        function(_cb) {solution.takePointsFrom(user.uuid, config.solutionCost, _cb);}
      ], function(errors, results) {
        if(errors) return next(errors);
        res.json(solution);
      });
    });
  }

  // Admins dürfen sowieso
  if(user.isAdmin()) {
    create();
  } else {
    // für normale User:
    // überprüfe ob der Nutzer noch Lösungen erstellen darf
    // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
    // falls > 0: Einstellung möglich
    if(pack.solutionsToDo === 0) {
      // Nutzer muss erst Paket abarbeiten
      var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Lösungen erstellen darfst');
      err.status = 409;
      err.name = 'WorkPackageNotDone';
      res.json(err);
    }

    // der Nutzer sollte nicht seine eigenen Aufgaben lösen
    user.hasCreated(task.uuid, function(err, heHas) {
      if(err) return next(err);
      if(heHas) {
        err = new Error('Du darfst nicht deine eigenen Aufgaben lösen');
        err.status = 409;
        return next(err);
      } else {
        // überprüfe ob der Nutzer schon eine Lösung für diese Aufgabe hat
        user.hasSolved(task.uuid, function(err, hasSolved) {
          if(err) return next(err);
          if(hasSolved) {
            err = new Error('Du hast diese Aufgabe bereits gelöst');
            err.status = 409;
            return next(err);
          } else {
            // überprüfe ob der Nutzer noch genug Punkte hat
            user.hasPoints(config.solutionCost, function(err, heDoes) {
              if(err) return next(err);
              if(!heDoes) {
                err = new Error('Du hast nicht genug Punkte um eine Lösung abzugeben');
                err.status = 409;
                err.name = 'MissingPoints';
                return next(err);
              } else {
                create();
              }
            });
          }
        });
      }
    });

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
router.put('/tasks/:taskUUID/status', helper.prefetchTask, auth.adminOnly, helper.prefetchConfig, helper.prefetchPackage, function(req, res, next) {

  var task = req._task;
  var pack = req._package;
  var config = req._config;

  task.toggle(function(err, result) {
    if(err) return next(err);
    // ACHTUNG: das obige task ist nocht die alte Version
    // falls die Node vorher aktiv war, müssen zusätzliche Aufgaben vom User in dem aktuellen Arbeitspaket verrichtet werden
    // Admins haben keine Packages
    if(req.user.isAdmin()) {
      return res.json({success: true});
    }

    var update = {};
    if(task.isActive()) {
      update.tasks = -1; // '-' damit intern hochgezählt wird
    } else {
      // da die Aufgabe vorher `inactive` war, muss er jetzt eine Aufgabe weniger bearbeiten
      update.tasks = 1; // runtergezählt
    }
    pack.updatePackage(update, config, function(err, result) {
      if(err) return next(err);
      res.json({success: true});
    });
  });

});


/**************************************************
              AUTHOR ONLY ROUTES
**************************************************/

// Finalisiert die Aufgabe und macht sie öffentlich
router.put('/tasks/:taskUUID/submit', helper.prefetchTask, auth.authorOnly, function(req, res, next) {

  var task = req._task;
  var user = req.user;

  task.finalize(function(err, result) {
    if(err) return next(err);
    Task.get(task.uuid, function(err, task) {
      if(err) return next(err);
      task.addMetadata(API_VERSION);
      res.json(task);
    });
  });

});

// Aktualisiert die Aufgabe
router.put('/tasks/:taskUUID', helper.prefetchTask, auth.authorOnly, function(req, res, next) {

  var task = req._task;

  if(task.isFinished()) {
    var err = new Error('Diese Aufgabe wurde bereits abgegeben. Du kannst sie nicht mehr verändern.');
    err.status = 409;
    err.name = 'AlreadySubmitted';
    return next(err);
  }

  task.patch(req.body, function(err, ntask) {
    if(err) return next(err);
    ntask.addMetadata(API_VERSION);
    res.json(ntask);
  });

});

module.exports = router;
