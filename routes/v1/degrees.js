'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var Degree = require('../../models/degree');
var config = require('../../config/config');

var auth = require('./auth/auth');

var apiVersion = config.HOST_URL + '/api/v1';

// Alle Studiengänge zurückgeben
router.get('/degrees', function(req, res, next) {

  Degree.getAll(function(err, result) {
    if (err) return next(err);
    result.forEach(function(e) {
      e.addMetadata(apiVersion);
    });
    res.json(result);
  });

});

// Gibt einen bestimmten Studiengang zurück
router.get('/degrees/:uuid', function(req, res, next) {

  Degree.get(req.params.uuid, function(err, s) {
    if (err) return next(err);
    s.addMetadata(apiVersion);
    res.json(s);
  });

});

// Gibt alle Lernziele eines Studiengangs auf 1. Ebene zurück
router.get('/degrees/:uuid/targets', function(req, res, next) {

  Degree.get(req.params.uuid, function(err, d) {
    if(err) return next(err);
    d.getTargets(1, function(err, targets) {
      if(err) return next(err);
      // Referenzen an die Targets hängen
      targets.forEach(function(t) {
        t.addMetadata(apiVersion);
      });
      d.targets = targets;
      res.json(d.targets);
    });
  });

});

// Gibt alle Nutzer die Zugriff auf diesen Studiengang haben zurück
router.get('/degrees/:uuid/users', function(req, res, next) {

  Degree.get(req.params.uuid, function(err, d) {
    if(err) return next(err);
    d.getUsers(function(err, users) {
      if(err) return next(err);
      users.forEach(function(i) {
        i.addMetadata(apiVersion);
      });
      res.json(users);
    });
  });

});

// Studiengang erstellen
router.post('/degrees', auth.adminOnly, function(req, res, next) {

  req.checkBody('name', 'Name des neuen Studiengangs fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  Degree.create(req.body, function(err, result) {
    if (err) return next(err);
    result.addMetadata(apiVersion);
    res.status(201).json(result);
  });

});

// Studiengang löschen
router.delete('/degrees/:uuid', auth.adminOnly, function(req, res, next) {

  Degree.get(req.params.uuid, function(err, d) {
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
router.put('/degrees/:uuid', auth.adminOnly, function(req, res, next) {

  Degree.get(req.params.uuid, function(err, d) {
    if (err) return next(err);
    d.patch(req.body, function(err, nd) {
      if (err) return next(err);
      nd.addMetadata(apiVersion);
      res.json(nd);
    });
  });

});

module.exports = router;
