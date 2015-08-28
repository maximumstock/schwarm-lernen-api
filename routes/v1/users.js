'use strict';

/**
 * @file Routen für User anlegen
 */

var express = require('express');
var router = express.Router();
var Comment = require('../../models/comment');

var apiVersion = '/api/v1';

// Alle Kommentare zurückgeben
router.get('/comments', function(req, res, next) {

  Comment.getAll(function(err, result) {

    if(err) return next(err);
    var ret = result.map(function(t) {
      t.addMetadata(apiVersion);
      return t._node;
    });
    res.json(ret);

  });

});

// Gibt einen bestimmten Kommentar zurück
router.get('/comments/:uuid', function(req, res, next) {

  Comment.get(req.params.uuid, function(err, t) {
    if(err) return next(err);

    t.addMetadata(apiVersion);
    res.json(t._node);
  });

});

// Gibt den Autor für einen bestimmten Kommentar zurück
router.get('/comments/:uuid/author', function(req, res, next) {

  Comment.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.author(function(err, u) {
      if(err) return next(err);
      u.addMetadata(apiVersion);
      res.json(u._node);
    });
  });

});

// Gibt das kommentierte Ziel eines Kommentars zurück
router.get('/comments/:uuid/target', function(req, res, next) {

  Comment.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.target(function(err, a) {
      if(err) return next(err);
      a.addMetadata(apiVersion);
      res.json(a._node);
    });
  });

});

// Kommentar erstellen
router.post('/comments', function(req, res, next) {

  req.checkBody('description', 'Inhalt des Komentars fehlt').notEmpty();
  req.checkBody('author', 'UUID des Autors fehlt').notEmpty();
  req.checkBody('target', 'UUID des Ziels fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var authorUUID = req.body.author;
  var targetUUID = req.body.target;
  var properties = req.body;

  Comment.create(properties, targetUUID, authorUUID, function(err, s) {

    if(err) return next(err);
    s.addMetadata(apiVersion);
    res.status(201).json(s);

  });

});

// TODO überhaupt iwas löschen/updaten?!

module.exports = router;
