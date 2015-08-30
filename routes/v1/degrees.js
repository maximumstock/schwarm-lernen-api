'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var Degree = require('../../models/degree');
var config = require('../../config/config');

var apiVersion = config.HOST_URL + '/api/v1';

// Alle Studiengänge zurückgeben
router.get('/degrees', function(req, res, next) {

  Degree.getAll(function(err, result) {
    if (err) return next(err);
    result = result.map(function(val) {
      val.addMetadata(apiVersion);
      return val._node;
    });
    res.json(result);
  });

});

// Gibt einen bestimmten Studiengang zurück
router.get('/degrees/:uuid', function(req, res, next) {

  Degree.get(req.params.uuid, function(err, s) {
    if (err) return next(err);
    s.addMetadata(apiVersion);
    res.json(s._node);
  });

});

// Gibt alle Lernziele eines Studiengangs auf 1. Ebene zurück
router.get('/degrees/:uuid/targets', function(req, res, next) {

  Degree.get(req.params.uuid, function(err, d) {
    if(err) return next(err);
    d.targets(1, function(err, targets) {
      if(err) return next(err);
      // Referenzen an die Targets hängen
      targets = targets.map(function(t) {
        t.addMetadata(apiVersion);
        return t._node;
      });
      d._node.targets = targets;
      res.json(d._node.targets);
    });
  });

});

// Studiengang erstellen
router.post('/degrees', function(req, res, next) {

  Degree.create(req.body, function(err, result) {
    if (err) return next(err);
    result.addMetadata(apiVersion);
    res.status(201).json(result._node);
  });

});

// Studiengang löschen
router.delete('/degrees/:uuid', function(req, res, next) {

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
router.put('/degrees/:uuid', function(req, res, next) {

  Degree.get(req.params.uuid, function(err, d) {
    if (err) return next(err);
    d.patch(req.body, function(err, nd) {
      if (err) return next(err);
      nd.addMetadata(apiVersion);
      res.json(nd._node);
    });
  });

});

module.exports = router;
