'use strict';

/**
 * @file Routen für Registrierung anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../../config/config');
var User = require('../../../models/user');

var auth = require('./auth');

var apiVersion = config.HOST_URL + '/api/v1';

// User registrieren
router.post('/register', function(req, res, next) {

  req.checkBody('username', 'Username fehlt').notEmpty();
  req.checkBody('password', 'Passwort fehlt').notEmpty();

  var errors = req.validationErrors();
  if(errors) {
    errors.status = 400;
    return next(errors);
  }

  var properties = req.body;

  User.create(properties, function(err, s) {

    if(err) return next(err);
    s.addMetadata(apiVersion);
    res.status(201).json(s._node);

  });

});

module.exports = router;
