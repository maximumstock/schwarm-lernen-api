'use strict';

/**
 * @file Route für Authentifizierung mit Username + Passwort
 */

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var config = require('../../../config/config');
var User = require('../../../models/user');

router.post('/login', function(req, res, next) {

  req.checkBody('username', 'Username des Nutzers fehlt').notEmpty();
  req.checkBody('password', 'Passwort des Nutzers fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) return next(errors);

  // existiert der User?
  User.findByUsername(req.body.username, function(err, user) {
    if(err) return next(err);

    // Passwort überprüfen
    if(user.password !== req.body.password) {
      res.json({
        success: false,
        message: 'Authentifizierung fehlgeschlagen. Falsches Passwort',
        status: 401
      });
    } else {

      // falls Passwort übereinstimmt
      delete user.properties.password; // Passwort-Property sollte nicht mitgeschickt werden
      var token = jwt.sign(user, config.API_SECRET, {
        expiresInMintues: 1440 // 24 Stunden
      });

      res.json({
        success: true,
        token: token
      });

    }
  });

});

module.exports = router;
