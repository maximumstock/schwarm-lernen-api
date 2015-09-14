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
router.post('/targets/:targetUUID/infos', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  req.checkBody('description', 'Inhalt der neuen Info fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var target = req._target;
  Info.create(req.body, target.uuid, function(err, info) {
    if(err) return next(err);
    info.addMetadata(API_VERSION);
    res.json(info);
  });

});

// Fügt eine neue Aufgabe hinzu
router.post('/targets/:targetUUID/tasks', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  req.checkBody('description', 'Inhalt der neuen Aufgabe fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var target = req._target;
  Task.create(req.body, target.uuid, function(err, task) {
    if(err) return next(err);
    task.addMetadata(API_VERSION);
    res.json(task);
  });

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
  Info.create(req.body, target.uuid, function(err, info) {
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
