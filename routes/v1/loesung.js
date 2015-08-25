/**
 * @file Routen für Aufgaben anlegen
 */

var express = require('express');
var router = express.Router();
var Loesung = require('../../models/loesung');

var apiVersion = '/api/v1';

// Alle Lösungen zurückgeben
router.get('/solutions', function(req, res, next) {

  Loesung.getAll(function(err, result) {

    if(err) return next(err);
    var ret = result.map(function(t) {
      t.addMetadata(apiVersion);
      return t._node;
    });
    res.json(ret);

  });

})

// Gibt eine bestimmte Lösung zurück
router.get('/solutions/:uuid', function(req, res, next) {

  Loesung.get(req.params.uuid, function(err, t) {
    if(err) return next(err);

    t.addMetadata(apiVersion);
    res.json(t._node);
  });

});

// Gibt den Autor für eine bestimmte Lösung zurück
router.get('/solutions/:uuid/author', function(req, res, next) {

  Loesung.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.author(function(err, u) {
      if(err) return next(err);
      u.addMetadata();
      res.json(u._node);
    });
  });

});

// Gibt die Aufgabe für eine bestimmte Lösung zurück
router.get('/solutions/:uuid/task', function(req, res, next) {

  Loesung.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.task(function(err, a) {
      if(err) return next(err);
      a.addMetadata();
      res.json(a._node);
    });
  });

});

// Gibt alle Reviews für eine bestimmte Lösung zurück
router.get('/solutions/:uuid/reviews', function(req, res, next) {

  Loesung.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.reviews(function(err, reviews) {
      if(err) return next(err);
      reviews.forEach(function(r) {
        r.addMetadata();
        r = r._node;
      });
      res.json(reviews);
    });
  });

});

// Gibt alle Lösungen für eine Aufgabe zurück
router.get('/tasks/:uuid/solutions', function(req, res, next) {

  Aufgabe.get(req.params.uuid, function(err, a) {

    if(err) return next(err);
    a.solutions(function(err, solutions) {
      if(err) return next(err);
      res.json(solutions);
    });

  });

});


// Aufgaben erstellen
router.post('/solutions', function(req, res, next) {

  req.checkBody('description', 'Inhalt der Lösung fehlt').notEmpty();
  req.checkBody('author', 'UUID des Autors fehlt').notEmpty();
  req.checkBody('task', 'UUID der Aufgabe fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var authorUUID = req.body.author;
  var taskUUID = req.body.task;
  var properties = req.body;

  Aufgabe.create(properties, taskUUID, authorUUID, function(err, s) {

    if(err) return next(err);
    res.status(201).json(s);

  });

});

// Aufgabe löschen
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
