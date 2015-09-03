'use strict';

/**
 * @file Middleware für Authentifizierung per Token
 */

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var config = require('../../../config/config');
var User = require('../../../models/user');

/**
 * @function Middleware die das gesendete Token validiert
 */
exports.auth = function(req, res, next) {

  // Token aus HTTP-Header, URL-Query oder POST-Body lesen
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  if(token) {

    // token verifizieren
    jwt.verify(token, config.API_SECRET, function(err, decoded) {
      if(err) {
        return next(err);
      } else {
        req.user = new User(decoded._node);
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

};

/**
 * @function Überprüft ob ein valides Token zu einem Admin gehört
 */
exports.adminOnly = function(req, res, next) {

  // falls die Middleware ohne exports.auth genutzt wurde und kein Userobjekt im Request steckt -> Fehler
  if(!req.user) {
    return next(new Error('adminOnly Middleware sollte nicht standalone genutzt werden'));
  } else {
    if(req.user.isAdmin()) {
      next(); // falls Admin -> weitermachen
    } else {
      // falls kein Admin
      var e = new Error('Du bist kein Admin');
      e.status = 401;
      e.name = 'MissingAdminStatus';
      next(e);
    }
  }

};
