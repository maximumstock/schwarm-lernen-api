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

  // falls :degreeUUID fehlt-> nicht weiterleiten
  if(!req.params.degreeUUID) {
    // falsches URL Schema bzw. falsche Anwendung dieser Middleware
    var err = new Error('prefetchDegree Middleware kann keine :degreeUUID auflösen');
    return next(err);
  }

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

  // falls :targetUUID fehlt -> nicht weiterleiten
  if(!req.params.targetUUID) {
    // falsches URL Schema bzw. falsche Anwendung dieser Middleware
    var err = new Error('prefetchTarget Middleware kann keine :targetUUID auflösen');
    return next(err);
  }

  Target.get(req.params.targetUUID, function(err, target) {
    if(err) return next(err);
    req._target = target;
    req._checker = target;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Aufgaben
exports.prefetchTask = function(req, res, next) {

  // falls taskUUID fehlt -> nicht weiterleiten
  if(!req.params.taskUUID) {
    // falsches URL Schema bzw. falsche Anwendung dieser Middleware
    var err = new Error('prefetchTask Middleware kann keine :taskUUID auflösen');
    return next(err);
  }

  Task.get(req.params.taskUUID, function(err, task) {
    if(err) return next(err);
    req._task = task;
    req._checker = task;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Lösungen
exports.prefetchSolution = function(req, res, next) {

  // falls solutionUUID fehlt -> nicht weiterleiten
  if(!req.params.solutionUUID) {
    // falsches URL Schema bzw. falsche Anwendung dieser Middleware
    var err = new Error('prefetchTask Middleware kann keine :solutionUUID auflösen');
    return next(err);
  }

  Solution.get(req.params.solutionUUID, function(err, solution) {
    if(err) return next(err);
    req._solution = solution;
    req._checker = solution;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Infos
exports.prefetchInfo = function(req, res, next) {

  // falls infoUUID fehlt -> nicht weiterleiten
  if(!req.params.infoUUID) {
    // falsches URL Schema bzw. falsche Anwendung dieser Middleware
    var err = new Error('prefetchTask Middleware kann keine :infoUUID auflösen');
    return next(err);
  }

  Info.get(req.params.infoUUID, function(err, info) {
    if(err) return next(err);
    req._info = info;
    req._checker = info;
    next();
  });

};

// siehe exports.prefetchTarget, jedoch für Kommentare
exports.prefetchComment = function(req, res, next) {

  // falls commentUUID fehlt -> nicht weiterleiten
  if(!req.params.commentUUID) {
    // falsches URL Schema bzw. falsche Anwendung dieser Middleware
    var err = new Error('prefetchTask Middleware kann keine :commentUUID auflösen');
    return next(err);
  }

  Comment.get(req.params.commentUUID, function(err, comment) {
    if(err) return next(err);
    req._comment = comment;
    req._checker = comment;
    next();
  });

};
