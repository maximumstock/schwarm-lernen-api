'use strict';

/**
 * @file Routen für Profile der angemeldeten User anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');

var User = require('../../models/user');

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
            DEGREE RESTRICTED ROUTES
**************************************************/

// Einfaches Inhaltsverzeichnis
router.get('/self', function(req, res, next) {
  res.json({
    tasks: {
      created: {
        all: API_VERSION + '/self/tasks/created',
        unfinished: API_VERSION + '/self/tasks/created/unfinished'
      },
      solved: API_VERSION + '/self/tasks/solved'
    },
    solutions: {
      all: API_VERSION + '/self/solutions',
      unfinished: API_VERSION + '/self/solutions/unfinished'
    },
    infos: {
      all: API_VERSION + '/self/infos',
      unfinished: API_VERSION + '/self/infos/unfinished'
    },
    points: API_VERSION + '/self/points',
    prestige: API_VERSION + '/self/prestige',
    workpackage: API_VERSION + '/self/workpackage'
  });
});

// Alle selbst erstellten Aufgaben des aktuellen Users
router.get('/self/tasks/created', function(req, res, next) {

  var user = req.user;
  user.getOwnTasks(function(err, tasks) {
    if(err) return next(err);
    tasks.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(tasks);
  });

});

// Alle selbst erstellten Aufgaben des aktuellen Users, die noch nicht abgegeben wurden
router.get('/self/tasks/created/unfinished', function(req, res, next) {

  var user = req.user;
  user.getOwnUnfinishedTasks(function(err, tasks) {
    if(err) return next(err);
    tasks.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(tasks);
  });

});

// Alle gelösten Aufgaben des aktuellen Users
router.get('/self/tasks/solved', function(req, res, next) {

  var user = req.user;
  user.getSolvedTasks(function(err, tasks) {
    if(err) return next(err);
    tasks.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(tasks);
  });

});

// Alle selbst erstellten Lösungen des aktuellen Users
router.get('/self/solutions', function(req, res, next) {

  var user = req.user;
  user.getSolutions(function(err, solutions) {
    if(err) return next(err);
    solutions.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(solutions);
  });

});

// Alle selbst erstellten Lösungen des aktuellen Users, die noch nicht abgegeben wurden
router.get('/self/solutions/unfinished', function(req, res, next) {

  var user = req.user;
  user.getUnfinishedSolutions(function(err, solutions) {
    if(err) return next(err);
    solutions.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(solutions);
  });

});

// Alle selbst erstellten Infos des aktuellen Users
router.get('/self/infos', function(req, res, next) {

  var user = req.user;
  user.getInfos(function(err, infos) {
    if(err) return next(err);
    infos.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(infos);
  });

});

// Alle selbst erstellten Infos des aktuellen Users, die noch nicht abgegeben wurden
router.get('/self/infos/unfinished', function(req, res, next) {

  var user = req.user;
  user.getUnfinishedInfos(function(err, infos) {
    if(err) return next(err);
    infos.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(infos);
  });

});

// Alle erspielten Punkte des aktuellen Users
router.get('/self/points', function(req, res, next) {

  var user = req.user;
  user.getPoints(function(err, points) {
    if(err) return next(err);
    res.json(points);
  });

});

// Aktueller Ruf-/Prestige-Wert
router.get('/self/prestige', function(req, res, next) {

  var user = req.user;
  user.getPrestige(function(err, prestige) {
    if(err) return next(err);
    res.json({prestige: prestige});
  });

});

// Die aktuelle Arbeitspaketsituation zurückliefern
router.get('/self/workpackage', function(req, res, next) {

  var user = req.user;

  // Admins haben keine Packages
  if(user.isAdmin()) {
    var err = new Error('Als Admin hast man kein Arbeitspaket. Du kannst ungehindert Inhalte erstellen');
    err.status = 404;
    return next(err);
  }

  user.getPackage(function(err, p) {
    if(err) return next(err);
    res.json({
      tasks: {
        done: p.tasksDone,
        todo: p.tasksToDo
      },
      infos: {
        done: p.infosDone,
        todo: p.infosToDo
      },
      solutions: {
        done: p.solutionsDone,
        todo: p.solutionsToDo
      },
      ratings: {
        done: p.ratingsDone,
        todo: p.ratingsToDo
      }
    });
  });


});



module.exports = router;
