'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var async = require('async');

var Degree = require('../../models/degree');
var Target = require('../../models/target');
var User = require('../../models/user');
var Config = require('../../models/config');

var auth = require('./auth/auth');
var helper = require('./helper/middleware');

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
                  PUBLIC ROUTES
**************************************************/

// Alle Studiengänge zurückgeben
router.get('/degrees', function(req, res, next) {

  Degree.getAll(function(err, result) {
    if (err) return next(err);
    result.forEach(function(e) {
      e.addMetadata(API_VERSION);
    });
    res.json(result);
  });

});

// Gibt einen bestimmten Studiengang zurück
router.get('/degrees/:degreeUUID', helper.prefetchDegree, function(req, res, next) {
  req._degree.addMetadata(API_VERSION);
  res.json(req._degree);
});

// // User für Studiengang anmelden
// router.post('/degrees/:degreeUUID/signin', helper.prefetchDegree, function(req, res, next) {
//
//   req.checkBody('entryKey', 'Anmeldeschlüssel des Studiengangs fehlt').notEmpty();
//   var errors = req.validationErrors();
//   if(errors) {
//     return next(errors);
//   }
//
//   var degree = req._degree;
//   degree.addUser(req.user.uuid, req.body.entryKey, function(err, result) {
//     if(err) return next(err);
//     res.json({success: true});
//   });
//
// });


/**************************************************
              DEGREE RESTRICTED ROUTES
**************************************************/

// Gibt alle Lernziele eines Studiengangs auf 1. Ebene zurück
router.get('/degrees/:degreeUUID/targets', helper.prefetchDegree, auth.restricted, function(req, res, next) {

  var degree = req._degree;
  degree.getTargets(1, function(err, targets) {
    if(err) return next(err);
    targets.forEach(function(t) {
      t.addMetadata(API_VERSION);
    });
    res.json(targets);
  });

});

// Gibt alle Nutzer die Zugriff auf diesen Studiengang haben zurück
router.get('/degrees/:degreeUUID/users', helper.prefetchDegree, auth.restricted, function(req, res, next) {

  var degree = req._degree;
  degree.getUsers(function(err, users) {
    if(err) return next(err);
    users.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(users);
  });

});

// Gibt Konfiguration des Studiengangs zurück
router.get('/degrees/:degreeUUID/config', helper.prefetchDegree, auth.restricted, function(req, res, next) {

  var degree = req._degree;
  degree.getConfig(function(err, config) {
    if(err) return next(err);
    config.addMetadata(API_VERSION);
    res.json(config);
  });

});

/**************************************************
              ADMIN ONLY ROUTES
**************************************************/

// Studiengang erstellen
router.post('/degrees', auth.adminOnly, function(req, res, next) {

  req.checkBody('name', 'Name des neuen Studiengangs fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var conf = req.body.config || Config.DEFAULT_CONFIG;
  delete req.body.config;

  Degree.create(req.body, function(err, degree) {
    if (err) return next(err);
    // create config
    Config.create(conf, degree.uuid, function(actualError, config) {
      if(actualError) {
        return degree.del(function(err, result) {
          if(err) return next(err);
          return next(actualError);
        });
      }
      config.addMetadata(API_VERSION);
      degree.addMetadata(API_VERSION);
      degree.properties.config = config;
      res.status(201).json(degree);
    });
  });

});

// Studiengang löschen
router.delete('/degrees/:degreeUUID', auth.adminOnly, function(req, res, next) {

  Degree.get(req.params.degreeUUID, function(err, d) {
    if (err) return next(err);
    d.del(function(err, result) {
      if (err) return next(err);
      res.json({
        success: true
      });
    });
  });

});

// Studiengang aktualisieren
router.put('/degrees/:degreeUUID', auth.adminOnly, function(req, res, next) {

  Degree.get(req.params.degreeUUID, function(err, d) {
    if (err) return next(err);
    d.patch(req.body, function(err, nd) {
      if (err) return next(err);
      nd.addMetadata(API_VERSION);
      res.json(nd);
    });
  });

});

// Config aktualsieren
router.put('/degrees/:degreeUUID/config', auth.adminOnly, function(req, res, next) {

  try {
    if(req.body.solutionShare) req.body.solutionShare = parseInt(req.body.solutionShare);
    if(req.body.taskShare) req.body.taskShare = parseInt(req.body.taskShare);
    if(req.body.infoShare) req.body.infoShare = parseInt(req.body.infoShare);
    if(req.body.infoPoints) req.body.infoPoints = parseInt(req.body.infoPoints);
    if(req.body.taskPoints) req.body.taskPoints = parseInt(req.body.taskPoints);
    if(req.body.solutionPoints) req.body.solutionPoints = parseInt(req.body.solutionPoints);
  } catch (e) {
    return next(e);
  }

  Degree.get(req.params.degreeUUID, function(err, d) {
    if (err) return next(err);
    d.getConfig(function(err, config) {
      if(err) return next(err);
      config.patch(req.body, function(err, nconfig) {
        if(err) return next(err);
        nconfig.addMetadata(API_VERSION);
        res.json(nconfig);
      });
    });
  });

});

// Lernziele an Studiengang hängen
router.post('/degrees/:degreeUUID/targets', auth.adminOnly, function(req, res, next) {

  req.checkBody('name', 'Name des neuen Lernziels fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  Degree.get(req.params.degreeUUID, function(err, d) {
    if (err) return next(err);
    Target.create(req.body, d.uuid, function(err, target) {
      if(err) return next(err);
      target.addMetadata(API_VERSION);
      res.status(201).json(target);
    });
  });

});

// User für Studiengang erstellen
router.put('/degrees/:degreeUUID/users', auth.adminOnly, helper.prefetchDegree, function(req, res, next) {

  req.checkBody('amount', 'Anzahl der anzulegenden Accounts fehlt').notEmpty();
  req.checkBody('amount', 'Parameter muss ein Ganzzahlwert sein').isInt();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var degree = req._degree;

  User.generate(parseInt(req.body.amount), function(err, users) {
    if(err) return next(err);
    // User erstmal erstellen
    var todo = users.map(function(i) {

      return function(cb) {
        User.create(i, function(err, user) {
          if(err) return cb(err);
          degree.addUserWithoutKey(user, cb); // neuen User zum Studiengang hinzufügen
        });
      };

    });

    async.parallel(todo, function(errors, results) {
      if(errors) {
        console.error(errors);
        var err = new Error('Beim Erstellen von neuen Usern für den Studiengang `'+degree.uuid+'` ist ein Fehler aufgetreten');
        return next(err);
      }
      res.status(201).json(users);
    });
  });

});

module.exports = router;
