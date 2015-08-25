/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var Studiengang = require('../../models/studiengang');

var apiVersion = '/api/v1';

// Alle Studiengänge zurückgeben
router.get('/degrees', function(req, res, next) {

  Studiengang.getAll(function(err, result) {
    if (err) return next(err);
    result = result.map(function(val) {
      val.addMetadata(apiVersion);
      return val._node;
    });
    res.json(result);
  });

})

// Gibt einen bestimmten Studiengang zurück
router.get('/degrees/:uuid', function(req, res, next) {

  Studiengang.get(req.params.uuid, function(err, s) {
    if (err) return next(err);
    s.addMetadata(apiVersion);
    res.json(s._node);
  });

});

// Gibt alle Lernziele eines Studiengangs auf 1. Ebene zurück
router.get('/degrees/:uuid/targets', function(req, res, next) {

  Studiengang.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.targets(1, function(err, targets) {
      if(err) return next(err);
      // Referenzen an die Targets hängen
      targets = targets.map(function(t) {
        t.addMetadata(apiVersion);
        return t._node;
      });
      s._node.targets = targets;
      res.json(s._node.targets);
    });
  })

});

// Studiengang erstellen
router.post('/degrees', function(req, res, next) {

  Studiengang.create(req.body, function(err, result) {
    if (err) return next(err);
    res.status(201).json(s._node);
  });

});

// Studiengang löschen
router.delete('/degrees/:uuid', function(req, res, next) {

  Studiengang.get(req.params.uuid, function(err, s) {
    if (err) return next(err);
    s.del(function(err, result) {
      if (err) return next(err);
      res.json({
        success: true
      });
    });
  });

});

// Studiengang aktualisieren
router.put('/degrees/:uuid', function(req, res, next) {

  Studiengang.get(req.params.uuid, function(err, s) {
    if (err) return next(err);
    s.patch(req.body, function(err, ns) {
      if (err) return next(err);
      addMetadata(ns);
      res.json(ns._node);
    });
  });

});

module.exports = router;
