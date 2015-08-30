'use strict';

/**
 * @file Routen für User anlegen
 */

var express = require('express');
var router = express.Router();
var User = require('../../models/user');

var apiVersion = '/api/v1';

// Alle User zurückgeben
router.get('/users', function(req, res, next) {

  User.getAll(function(err, result) {

    if(err) return next(err);
    var ret = result.map(function(t) {
      t.addMetadata(apiVersion);
      return t._node;
    });
    res.json(ret);

  });

});

// Gibt einen bestimmten User zurück
router.get('/users/:uuid', function(req, res, next) {

  User.get(req.params.uuid, function(err, t) {
    if(err) return next(err);

    t.addMetadata(apiVersion);
    res.json(t._node);
  });

});

// Gibt alle Aufgaben des Users zurück
router.get('/users/:uuid/tasks', function(req, res, next) {

  User.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.tasks(function(err, a) {
      if(err) return next(err);
      a.addMetadata(apiVersion);
      res.json(a._node);
    });
  });

});

// Gibt alle Infos des Users zurück
router.get('/users/:uuid/infos', function(req, res, next) {

  User.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.infos(function(err, a) {
      if(err) return next(err);
      a.addMetadata(apiVersion);
      res.json(a._node);
    });
  });

});

// Gibt alle Lösungen des Users zurück
router.get('/users/:uuid/solutions', function(req, res, next) {

  User.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.solutions(function(err, a) {
      if(err) return next(err);
      a.addMetadata(apiVersion);
      res.json(a._node);
    });
  });

});

// User erstellen
router.post('/users', function(req, res, next) {

  req.checkBody('username', 'Inhalt des Komentars fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) return next(errors);

  var properties = req.body;

  User.create(properties, function(err, s) {

    if(err) return next(err);
    s.addMetadata(apiVersion);
    res.status(201).json(s);

  });

});

// TODO überhaupt iwas löschen/updaten?!

module.exports = router;
