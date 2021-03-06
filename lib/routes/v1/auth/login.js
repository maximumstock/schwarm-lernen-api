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
  if(errors) {
    return next(errors);
  }

  // existiert der User?
  User.findByUsername(req.body.username, function(err, user) {
    if(err) return next(err);

    // ist Nutzeraccount deaktiviert?
    if(!user.isActive()) {
      err = new Error('Dieses Benutzerkonto wurde deaktiviert');
      err.status = 401;
      err.name = 'UserDeactivated';
      return next(err);
    }

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
        admin: user.isAdmin(),
        user: user,
        token: token
      });

      // User-Login Zeitstempel aktualisieren
      user.updateLoginTimestamp(function(err, result) {
        if(err) return console.error(err);
        console.log('Zeitstempel aktualisiert für', user.username);
      });

    }
  });

});

module.exports = router;
