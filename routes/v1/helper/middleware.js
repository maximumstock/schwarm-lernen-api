'use strict';

/**
 * @file Hier sind Middleware Funktionen zum Vereinfachen einiger Auflösungsprozesse von URLs definiert
 */

var Degree = require('../../../models/degree');
var Target = require('../../../models/target');
var Task = require('../../../models/task');
var Solution = require('../../../models/solution');
var Info = require('../../../models/info');
var Comment = require('../../../models/comment');


/**
 * @function Middleware die den gesuchten Studiengang-Lernziel-Pfad direkt auflöst und das Lernziel-Objekt im Request platziert.
 * Dies spart Code in der eigentlichen Endpunkt-Implementierung.
 * Diese Middleware wird nur genutzt wenn URLs mit /degrees/:degreeUUID/targets/:targetUUID beginnen.
 */
exports.prefetchDegree = function(req, res, next) {

  Degree.get(req.params.degreeUUID, function(err, degree) {
    if(err) return next(err);
    req._degree = degree;
    req._checker = degree;
    next();
  });

};

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

// siehe exports.prefetchTarget, jedoch für Kommentare
exports.prefetchComment = function(req, res, next) {

  Comment.get(req.params.commentUUID, function(err, comment) {
    if(err) return next(err);
    req._comment = comment;
    req._checker = comment;
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

  req._checker.getParentDegree(function(err, degree) {
    if(err) return next(err);
    degree.getConfig(function(err, config) {
      if(err) return next(err);
      req._config = config;
      next();
    });
  });

};
