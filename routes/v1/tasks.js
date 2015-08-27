/**
 * @file Routen für Aufgaben anlegen
 */

var express = require('express');
var router = express.Router();
var Task = require('../../models/task');

var apiVersion = '/api/v1';

// Alle Aufgaben zurückgeben
router.get('/tasks', function(req, res, next) {

  Task.getAll(function(err, result) {

    if(err) return next(err);
    var ret = result.map(function(t) {
      t.addMetadata(apiVersion);
      return t._node;
    });
    res.json(ret);

  });

})

// Gibt eine bestimmte Aufgabe zurück
router.get('/tasks/:uuid', function(req, res, next) {

  Task.get(req.params.uuid, function(err, t) {
    if(err) return next(err);

    t.addMetadata(apiVersion);
    res.json(t._node);
  });

});

// Gibt alle Lösungen für eine Aufgabe zurück
router.get('/tasks/:uuid/solutions', function(req, res, next) {

  Task.get(req.params.uuid, function(err, a) {

    if(err) return next(err);
    a.solutions(function(err, solutions) {
      if(err) return next(err);
      solutions = solutions.map(function(s) {
        s.addMetadata(apiVersion);
        return s._node;
      });
      res.json(solutions);
    });

  });

});


// Aufgaben erstellen
router.post('/tasks', function(req, res, next) {

  req.checkBody('description', 'Inhalt der Aufgabe fehlt').notEmpty();
  req.checkBody('parent', 'UUID des Parents fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var parentUUID = req.body.parent;
  var properties = req.body;

  Task.create(properties, parentUUID, function(err, t) {

    if(err) return next(err);
    res.status(201).json(t);

  });

});

// TODO überhaupt Aufgaben updaten/löschen?!
// // Aufgabe löschen
// router.delete('/tasks/:uuid', function(req, res, next) {
//
//   Aufgabe.get(req.params.uuid, function(err, a) {
//     if(err) return next(err);
//     a.del(function(err, result) {
//       if(err) return next(err);
//       res.json({});
//     });
//   });
//
// });
//
// // Aufgabe aktualisieren
// router.put('/tasks/:uuid', function(req, res, next) {
//
//   Aufgabe.get(req.params.uuid, function(err, t) {
//     if(err) return next(err);
//
//     var newParentUUID = req.body.parent;
//     var properties = req.body;
//     delete properties.parent;
//
//     // Properties aktualisieren
//     t.patch(properties, function(err, nt) {
//       if(err) return next(err);
//
//       if(newParentUUID) {
//         // falls eine neue Parent-UUID gegeben ist muss diese die neue Beziehung sein
//         t.changeParent(newParentUUID, function(err, nnt) {
//           if(err) return next(err);
//
//           return res.json(nnt);
//         })
//       } else {
//         res.json(nt);
//       }
//     });
//
//   });
//
// });

module.exports = router;
