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

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
              DEGREE RESTRICTED ROUTES
**************************************************/

// Gibt ein bestimmtes Lernziel zurück
router.get('/targets/:targetUUID', helper.prefetchTarget, auth.restricted, function(req, res, next) {
  var target = req._target;
  target.addMetadata(API_VERSION);
  res.json(target);
});

// Gibt alle weiteren Kinder 1 Ebene unter aktuellem Lernziel zurück
router.get('/targets/:targetUUID/children', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  var target = req._target;
  target.getChildren(1, function(err, children) {
    if(err) return next(err);

    var keys = Object.keys(children);
    keys.forEach(function(k) {
      children[k].forEach(function(i) {
        i.addMetadata(API_VERSION);
      });
    });
    res.json(children);
  });

});

// Gibt die Parent-Node des jeweiligen Lernziels zurück
router.get('/targets/:targetUUID/parent', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  var target = req._target;
  target.getParent(function(err, p) {
    if(err) return next(err);
    p.addMetadata(API_VERSION);
    res.json(p);
  });

});

// Fügt eine neue Info hinzu
router.post('/targets/:targetUUID/infos', helper.prefetchTarget, auth.restricted, helper.prefetchConfig, function(req, res, next) {

  req.checkBody('description', 'Inhalt der neuen Info fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var target = req._target;
  var config = req._config;
  var user = req.user;

  // überprüfe ob der Nutzer noch Infos erstellen darf
  // falls < 0: es gibt kein Limit/keine Mindestanzahl um das Paket zu beenden
  // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
  // falls > 0: Einstellung möglich
  if(user.infosToDo !== 0) {
    // überprüfe ob der Nutzer noch genug Punkte hat
    user.hasPoints(config.infoCost, function(err, heDoes) {
      if(err) return next(err);
      if(!heDoes) {
        err = new Error('Du hast nicht genug Punkte um eine Info einzustellen');
        err.status = 409;
        err.name = 'MissingPoints';
        return next(err);
      } else {
        Info.create(req.body, target.uuid, req.user.uuid, config.infoPoints, config.infoCost, function(err, info) {
          if(err) return next(err);
          info.addMetadata(API_VERSION);
          res.json(info);
          // Arbeitspaketstatus aktualisieren
          user.didWorkOnPackage({tasks: 0, infos: 1, solutions: 0, ratings: 0}, config, function(err, result) {
            if(err) console.error(err);
          });
        });
      }
    });
  } else {
    // Nutzer muss erst Paket abarbeiten
    var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Infos erstellen darfst');
    err.status = 409;
    err.name = 'WorkPackageNotDone';
    res.json(err);
  }

});

// Fügt eine neue Aufgabe hinzu
router.post('/targets/:targetUUID/tasks', helper.prefetchTarget, auth.restricted, helper.prefetchConfig, function(req, res, next) {

  req.checkBody('description', 'Inhalt der neuen Aufgabe fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var target = req._target;
  var config = req._config;
  var user = req.user;

  // überprüfe ob der Nutzer noch Aufgaben erstellen darf
  // falls < 0: es gibt kein Limit/keine Mindestanzahl um das Paket zu beenden
  // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
  // falls > 0: Einstellung möglich
  if(user.tasksToDo !== 0) {

    // überprüfe ob der Nutzer noch genug Punkte hat
    user.hasPoints(config.taskCost, function(err, heDoes) {
      if(err) return next(err);
      if(!heDoes) {
        err = new Error('Du hast nicht genug Punkte um eine Aufgabe einzustellen');
        err.status = 409;
        err.name = 'MissingPoints';
        return next(err);
      } else {
        Task.create(req.body, target.uuid, req.user.uuid, config.taskPoints, config.taskCost, function(err, task) {
          if(err) return next(err);
          task.addMetadata(API_VERSION);
          res.json(task);
          // Arbeitspaketstatus aktualisieren
          user.didWorkOnPackage({tasks: 1, infos: 0, solutions: 0, ratings: 0}, config, function(err, result) {
            if(err) console.error(err);
          });
        });
      }
    });

  } else {
    // Nutzer muss erst Paket abarbeiten
    var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Aufgaben erstellen darfst');
    err.status = 409;
    err.name = 'WorkPackageNotDone';
    res.json(err);
  }

});


/**************************************************
              ADMIN ONLY ROUTES
**************************************************/

// Fügt ein neues Lernziel hinzu
router.post('/targets/:targetUUID/targets', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  req.checkBody('name', 'Name des neuen Lernziels fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var target = req._target;
  Target.create(req.body, target.uuid, function(err, info) {
    if(err) return next(err);
    info.addMetadata(API_VERSION);
    res.json(info);
  });

});

// Lernziel löschen
router.delete('/targets/:targetUUID', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;
  target.del(function(err, result) {
    if(err) return next(err);
    res.json({});
  });

});

// Lernziel aktualisieren
router.put('/targets/:targetUUID', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;

  var newParentUUID = req.body.parent;
  var properties = req.body;
  delete properties.parent; // Attribut entfernen damit es nicht in den Node-Properties steht

  // Properties aktualisieren
  target.patch(properties, function(err, nt) {
    if(err) return next(err);

    nt.addMetadata(API_VERSION);
    if(newParentUUID) {
      // falls eine neue Parent-UUID gegeben ist muss diese die neue Beziehung sein
      nt.changeParent(newParentUUID, function(err, nnt) {
        if(err) return next(err);
        nnt.addMetadata(API_VERSION);
        return res.json(nnt);
      });
    } else {
      res.json(nt);
    }
  });

});

module.exports = router;
