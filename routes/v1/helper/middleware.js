'use strict';

/**
 * @file Hier sind Middleware Funktionen zum Vereinfachen einiger Auflösungsprozesse von URLs definiert
 */

var Target = require('../../../models/target');
var Task = require('../../../models/task');
var Solution = require('../../../models/solution');
var Info = require('../../../models/info');
var Rating = require('../../../models/rating');

/**
 * @function Middleware die den gesuchten Studiengang-Lernziel-Pfad direkt auflöst und das Lernziel-Objekt im Request platziert.
 * Dies spart Code in der eigentlichen Endpunkt-Implementierung.
 * Diese Middleware wird nur genutzt wenn URLs mit /degrees/:degreeUUID/targets/:targetUUID beginnen.
 */
exports.prefetchTarget = function(req, res, next) {

  Target.get(req.params.targetUUID, function(err, target) {
    if(err) return next(err);
    req._target = target;
    req._checker = target;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Aufgaben
exports.prefetchTask = function(req, res, next) {

  Task.get(req.params.taskUUID, function(err, task) {
    if(err) return next(err);
    req._task = task;
    req._checker = task;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Lösungen
exports.prefetchSolution = function(req, res, next) {

  Solution.get(req.params.solutionUUID, function(err, solution) {
    if(err) return next(err);
    req._solution = solution;
    req._checker = solution;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Infos
exports.prefetchInfo = function(req, res, next) {

  Info.get(req.params.infoUUID, function(err, info) {
    if(err) return next(err);
    req._info = info;
    req._checker = info;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Ratings
exports.prefetchRating = function(req, res, next) {

  Rating.get(req.params.ratingUUID, function(err, rating) {
    if(err) return next(err);
    req._rating = rating;
    req._checker = rating;
    next();
  });

};

// holt das config objekt vom req._checker objekt
// sollte nur nach einer der oberen prefetch-Middleware-Funktionen genutzt werden
exports.prefetchConfig = function(req, res, next) {

  if(!req._checker) {
    var err = new Error('exports.prefetchConfig-Middleware sollte nicht standalone verwendet werden');
    err.status = 500;
    err.name = 'N00bAdmin';
    return next(err);
  }

  req._checker.getParentTarget(function(err, target) {
    if(err) return next(err);
    target.getConfig(function(err, config) {
      if(err) return next(err);
      req._config = config;
      next();
    });
  });

};

// Helferfunktion, die das aktuelle Arbeitspaket des Users (req.user) in req._package speichert
exports.prefetchPackage = function(req, res, next) {

  if(!req.user) {
    var err = new Error('exports.prefetchPackage-Middleware sollte nicht standalone verwendet werden');
    err.status = 500;
    err.name = 'N00bAdmin';
    return next(err);
  }

  // Admins haben keine Arbeitspakete
  if(req.user.isAdmin()) {
    return next();
  }

  var user = req.user;
  user.getPackage(function(err, workpackage) {
    if(err) return next(err);
    req._package = workpackage;
    return next();
  });

};
