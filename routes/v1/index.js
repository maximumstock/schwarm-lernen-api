/**
 * @file Sammelt alle Routendefinitionen im Verzeichnis und exportiert einen Router der alle Routen beinhaltet nach außen.
 */

var express = require('express');
var router = express.Router();
var degreeRoutes = require('./studiengang');
var targetRoutes = require('./lernziel');
var taskRoutes = require('./aufgabe');
var solutionRoutes = require('./loesung');

router.use('/', degreeRoutes);
router.use('/', targetRoutes);
router.use('/', taskRoutes);
router.use('/', solutionRoutes);

module.exports = router;
