'use strict';

/**
 * @file Routen für User anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');

var User = require('../../models/user');

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
                PUBLIC ROUTES
**************************************************/

// // Alle User
// router.get('/users', function(req, res, next) {
//
//   User.getAll(function(err, users) {
//     if(err) return next(err);
//     users.forEach(function(u) {
//       u.addMetadata(API_VERSION);
//     });
//     res.json(users);
//   });
// 
// });
//
// // Ein bestimmter User
// router.get('/users/:userUUID', function(req, res, next) {
//
//   User.get(req.params.userUUID, function(err, user) {
//     if(err) return next(err);
//     user.getPrestige(function(err, prestige) {
//       if(err) return next(err);
//       user.properties.prestige = prestige;
//       user.addMetadata(API_VERSION);
//       res.json(user);
//     });
//   });
//
// });


/**************************************************
                ADMIN ONLY ROUTES
**************************************************/

// Einen bestimmten Useraccount deaktivieren (nicht löschen)
router.delete('/users/:userUUID', auth.adminOnly, function(req, res, next) {

  User.get(req.params.userUUID, function(err, user) {
    if(err) return next(err);
    user.toggleInactive(function(err, result) {
      if(err) return next(err);
      User.get(req.params.userUUID, function(err, nuser) {
        if(err) return next(err);
        nuser.addMetadata(API_VERSION);
        res.json(nuser);
      });
    });
  });

});

module.exports = router;
