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
    result.forEach(function(t) {
      t.addMetadata(apiVersion);
    });
    res.json(result);

  });

});

// Gibt ein bestimmtes Lernziel zurück
router.get('/targets/:uuid', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.addMetadata(apiVersion);
    res.json(t);
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
        children[k].forEach(function(i) {
          i.addMetadata(apiVersion);
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
      res.json(p);
    });
  });

});

// Gibt alle Infos für das Lernziel
router.get('/targets/:uuid/infos', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.infos(function(err, infos) {
      if(err) return next(err);
      infos.forEach(function(i) {
        i.addMetadata(apiVersion);
      });
      res.json(infos);
    });
  });

});

// Gibt alle Aufgaben für das Lernziel
router.get('/targets/:uuid/tasks', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.tasks(function(err, tasks) {
      if(err) return next(err);
      tasks.forEach(function(i) {
        i.addMetadata(apiVersion);
      });
      res.json(tasks);
    });
  });

});

// Gibt alle weiteren direkt unterstellten Lernziele für das Lernziel
router.get('/targets/:uuid/targets', function(req, res, next) {

  Target.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.targets(1, function(err, targets) {
      if(err) return next(err);
      targets.forEach(function(i) {
        i.addMetadata(apiVersion);
      });
      res.json(targets);
    });
  });

});

// Lernziel erstellen
router.post('/targets', function(req, res, next) {

  req.checkBody('name', 'Name des neuen Lernziels fehlt').notEmpty();
  req.checkBody('parent', 'UUID des Parents fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

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
