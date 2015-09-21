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
      created: API_VERSION + '/self/tasks/created',
      solved: API_VERSION + '/self/tasks/solved'
    },
    solutions: API_VERSION + '/self/solutions',
    infos: API_VERSION + '/self/infos',
    points: API_VERSION + '/self/points',
    package: API_VERSION + '/self/package'
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

// Alle erspielten Punkte des aktuellen Users
router.get('/self/points', function(req, res, next) {

  var user = req.user;
  user.getPoints(function(err, points) {
    if(err) return next(err);
    res.json(points);
  });

});



module.exports = router;
