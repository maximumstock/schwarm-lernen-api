'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var Target = require('../../models/target');
var config = require('../../config/config');

var apiVersion = config.HOST_URL + '/api/v1';

// Alle Lernziele zurückgeben
router.get('/targets', function(req, res, next) {

  Target.getAll(function(err, result) {

    if(err) return next(err);
    result = result.map(function(t) {
      t.addMetadata(apiVersion);
      return t._node;
    });
    res.json(result);

  });

});

// Gibt ein bestimmtes Lernziel zurück
router.get('/targets/:uuid', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.addMetadata(apiVersion);
    res.json(t._node);
  });

});

// Gibt alle weiteren Kinder 1 Ebene unter aktuellem Lernziel zurück
router.get('/targets/:uuid/children', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.children(1, function(err, children) {
      if(err) return next(err);

      var keys = Object.keys(children);
      keys.forEach(function(k) {
        children[k] = children[k].map(function(i) {
          i.addMetadata(apiVersion);
          return i._node;
        });
      });
      res.json(children);
    });
  });

});

// Gibt die Parent-Node des jeweiligen Lernziels zurück
router.get('/targets/:uuid/parent', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.parents(function(err, p) {
      if(err) return next(err);
      p.addMetadata(apiVersion);
      res.json(p._node);
    });
  });

});

// Lernziel erstellen
router.post('/targets', function(req, res, next) {

  req.checkBody('name', 'Name des neuen Lernziels fehlt').notEmpty();
  req.checkBody('parent', 'UUID des Parents fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var parentUUID = req.body.parent;
  var properties = req.body;

  Target.create(properties, parentUUID, function(err, t) {

    if(err) return next(err);
    res.status(201).json(t);

  });

});

// Lernziel löschen
router.delete('/targets/:uuid', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.del(function(err, result) {
      if(err) return next(err);
      res.json({});
    });
  });

});

// Lernziel aktualisieren
router.put('/targets/:uuid', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);

    var newParentUUID = req.body.parent;
    var properties = req.body;
    delete properties.parent; // Attribut entfernen damit es nicht in den Node-Properties steht

    // Properties aktualisieren
    t.patch(properties, function(err, nt) {
      if(err) return next(err);

      if(newParentUUID) {
        // falls eine neue Parent-UUID gegeben ist muss diese die neue Beziehung sein
        t.changeParent(newParentUUID, function(err, nnt) {
          if(err) return next(err);
          return res.json(nnt);
        });
      } else {
        res.json(nt);
      }
    });

  });

});

module.exports = router;
