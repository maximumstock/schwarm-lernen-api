'use strict';

/**
 * @file Routen für Infos anlegen
 */

var express = require('express');
var router = express.Router();
var Info = require('../../models/info');
var config = require('../../config/config');

var apiVersion = config.HOST_URL + '/api/v1';

// Alle Infos zurückgeben
router.get('/infos', function(req, res, next) {

  Info.getAll(function(err, result) {

    if(err) return next(err);
    var ret = result.map(function(t) {
      t.addMetadata(apiVersion);
      return t._node;
    });
    res.json(ret);

  });

});

// Gibt eine bestimmte Info zurück
router.get('/infos/:uuid', function(req, res, next) {

  Info.get(req.params.uuid, function(err, t) {
    if(err) return next(err);

    t.addMetadata(apiVersion);
    res.json(t._node);
  });

});

// Gibt den Autor für eine bestimmte Info zurück
router.get('/infos/:uuid/author', function(req, res, next) {

  Info.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.author(function(err, u) {
      if(err) return next(err);
      u.addMetadata(apiVersion);
      res.json(u._node);
    });
  });

});

// Gibt das Lernziel für eine bestimmte Info zurück
router.get('/info/:uuid/target', function(req, res, next) {

  Info.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.target(function(err, a) {
      if(err) return next(err);
      a.addMetadata(apiVersion);
      res.json(a._node);
    });
  });

});

// Gibt alle Kommentare für eine bestimmte Info zurück
router.get('/infos/:uuid/comments', function(req, res, next) {

  Info.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.comments(function(err, comments) {
      if(err) return next(err);
      res.json(comments);
    });
  });

});

// Info erstellen
router.post('/infos', function(req, res, next) {

  req.checkBody('description', 'Inhalt der Info fehlt').notEmpty();
  req.checkBody('author', 'UUID des Autors fehlt').notEmpty();
  req.checkBody('target', 'UUID des Lernziels fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var authorUUID = req.body.author;
  var targetUUID = req.body.target;
  var properties = req.body;

  Info.create(properties, targetUUID, authorUUID, function(err, s) {

    if(err) return next(err);
    s.addMetadata(apiVersion);
    res.status(201).json(s);

  });

});

// TODO überhaupt iwas löschen/updaten?!

module.exports = router;
