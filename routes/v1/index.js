'use strict';

/**
 * @file Sammelt alle Routendefinitionen im Verzeichnis und exportiert einen Router der alle Routen beinhaltet nach außen.
 */

var express = require('express');
var router = express.Router();
var degrees = require('./degrees');
var targets = require('./targets');
var tasks = require('./tasks');
var solutions = require('./solutions');
var infos = require('./infos');
var users = require('./users');

var register = require('./auth/register');
var login = require('./auth/login');
var auth = require('./auth/auth');

// Registrierung- und Login-Endpunkte müssen öffentlich sein
router.use('/', login);
router.use('/', register);

// API Routen
if(!process.env.DISABLE_AUTH) {
  router.use(auth); // API Routen mit Auth-Middleware schützen
}
router.use('/', degrees);
router.use('/', targets);
router.use('/', tasks);
router.use('/', solutions);
router.use('/', infos);
router.use('/', users);

module.exports = router;
