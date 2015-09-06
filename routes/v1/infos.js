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
    result.forEach(function(t) {
      t.addMetadata(apiVersion);
      t.author.addMetadata(apiVersion);
    });
    res.json(result);

  });

});

// Gibt eine bestimmte Info zurück
router.get('/infos/:uuid', function(req, res, next) {

  Info.get(req.params.uuid, function(err, t) {
    if(err) return next(err);
    t.addMetadata(apiVersion);
    t.author.addMetadata(apiVersion);
    res.json(t);
  });

});

// Gibt das Lernziel für eine bestimmte Info zurück
router.get('/info/:uuid/target', function(req, res, next) {

  Info.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.getTarget(function(err, a) {
      if(err) return next(err);
      a.addMetadata(apiVersion);
      res.json(a);
    });
  });

});

// Gibt alle Kommentare für eine bestimmte Info zurück
router.get('/infos/:uuid/comments', function(req, res, next) {

  Info.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.getComments(function(err, comments) {
      if(err) return next(err);
      res.json(comments);
    });
  });

});

// Info erstellen
router.post('/infos', function(req, res, next) {

  req.checkBody('description', 'Inhalt der Info fehlt').notEmpty();
  req.checkBody('target', 'UUID des Lernziels fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var targetUUID = req.body.target;
  var properties = req.body;
  
  Info.create(properties, targetUUID, req.user.uuid, function(err, s) {

    if(err) return next(err);
    s.addMetadata(apiVersion);
    res.status(201).json(s);

  });

});

// TODO überhaupt iwas löschen/updaten?!

module.exports = router;
