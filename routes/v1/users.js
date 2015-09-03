'use strict';

/**
 * @file Routen für User anlegen
 */

var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var config = require('../../config/config');

var apiVersion = config.HOST_URL + '/api/v1';

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

// Gibt alle eigenen Aufgaben des Users zurück
router.get('/users/:uuid/tasks/created', function(req, res, next) {

  User.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.ownTasks(function(err, a) {
      if(err) return next(err);
      a = a.map(function(i) {
        i.addMetadata(apiVersion);
        return i._node;
      });
      res.json(a);
    });
  });

});

// Gibt alle bearbeiteten Aufgaben des Users zurück
router.get('/users/:uuid/tasks/solved', function(req, res, next) {

  User.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.solvedTasks(function(err, a) {
      if(err) return next(err);
      a = a.map(function(i) {
        i.addMetadata(apiVersion);
        return i._node;
      });
      res.json(a);
    });
  });

});

// Gibt alle Infos des Users zurück
router.get('/users/:uuid/infos', function(req, res, next) {

  User.get(req.params.uuid, function(err, s) {
    if(err) return next(err);
    s.infos(function(err, a) {
      if(err) return next(err);
      a = a.map(function(i) {
        i.addMetadata(apiVersion);
        return i._node;
      });
      res.json(a);
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

// TODO überhaupt iwas löschen/updaten?!

module.exports = router;
