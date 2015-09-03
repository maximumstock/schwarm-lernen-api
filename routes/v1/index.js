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
router.use(auth.auth); // API Routen mit Auth-Middleware schützen
router.use('/', degrees); // Degrees nur durch Admins erstell-/änderbar (siehe degrees.js)
router.use('/', targets);
router.use('/', tasks);
router.use('/', solutions);
router.use('/', infos);
router.use('/', users); // User nur durch Admins erstellbar (siehe auth/register.js)

module.exports = router;
