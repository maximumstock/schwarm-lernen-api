'use strict';

/**
 * @file Sammelt alle Routendefinitionen im Verzeichnis und exportiert einen Router der alle Routen beinhaltet nach außen.
 */

var express = require('express');
var router = express.Router();

var register = require('./auth/register');
var login = require('./auth/login');
var auth = require('./auth/auth');

var users = require('./users');
var degrees = require('./degrees');
var targets = require('./targets');
var tasks = require('./tasks');
var solutions = require('./solutions');
var infos = require('./infos');
var comments = require('./comments');

// API Index Route
router.get('/', function(req, res, next) {
  var prefix = '/api/v1';
  res.json({
    degrees: prefix + '/degrees',
    targets: prefix + '/targets',
    solutions: prefix + '/solutions',
    tasks: prefix + '/tasks',
    infos: prefix + '/infos',
    users: prefix + '/users'
  });
});

// Registrierung- und Login-Endpunkte müssen öffentlich sein
router.use('/', login);
router.use('/', register);

// API Routen
router.use(auth.auth); // API Routen mit Auth-Middleware schützen
router.use('/', users);
router.use('/', degrees); // Degrees nur durch Admins erstell-/änderbar (siehe degrees.js)
router.use('/', targets);
router.use('/', tasks);
router.use('/', solutions);
router.use('/', infos);
router.use('/', comments);

module.exports = router;
