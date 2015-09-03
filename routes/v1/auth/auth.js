'use strict';

/**
 * @file Middleware für Authentifizierung Token
 */

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var config = require('../../../config/config');
var User = require('../../../models/user');

router.use(function(req, res, next) {

  // Token aus HTTP-Header, URL-Query oder POST-Body lesen
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  if(token) {

    // token verifizieren
    jwt.verify(token, config.API_SECRET, function(err, decoded) {
      if(err) {
        return next(err);
      } else {
        req.user = new User(decoded);
        next();
      }
    });

  } else {
    // kein Token vorhanden -> nicht autorisiert -> 401
    var err = new Error('Nicht autorisiert');
    err.status = 401;
    err.name = 'Unauthorized';
    next(err);
  }

});

module.exports = router;
