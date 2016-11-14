'use strict';

/**
 * @file Hier sind Middleware Funktionen zum Vereinfachen einiger Auflösungsprozesse von URLs definiert
 */

var Target = require('../../../models/target');
var Task = require('../../../models/task');
var Solution = require('../../../models/solution');
var Info = require('../../../models/info');
var Rating = require('../../../models/rating');

var async = require('async');

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

// holt das config objekt vom Lernziel, welches req._checker.getParentTarget liefert und die globale Config von req._checker.getParentEntryTarget
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

    async.parallel([
      function(_cb) {
        if(req._checker.labels.indexOf('Target') > -1) {
          return req._checker.getConfig(_cb);
        }
        target.getConfig(_cb);
      }, function(_cb) {
        target.getGlobalConfig(_cb);
      }
    ], function(errors, results) {
      if(errors) return next(errors);

      // aus globaler und spezieller Config eine gemeinsame Config bauen (Achtung auf `uuid` und andere spezielle Attribute achten)
      // da `Config` und `GlobalConfig` verschiedene JS Prototypen darstellen, ist es unratsam einfach eine neue Config mit der Schnittmenge
      // der Attribute zu erstellen, da bspw. nicht beide Prototypen die gleichen Getter-Methoden definiert haben
      // daher bietet es sich an in req._config einfach ein reines JS Objekt anstatt eines Prototypen zu speichern
      req._config = results[1].combine(results[0]);
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


// Helferfunktion, die den Request nur weiterleitet, wenn der User ein Admin ist oder der User die Ressource unter `req._checker` bereits bewertet hat
// Damit kann komfortabler garantiert werden, dass Requests unter `GET /{typ}/{uuid}/ratings` nur bearbeitet werden, wenn der Anfragende ein Admin, der Autor der
// Ressource oder ein beliebiger User, der die Ressource bereits selbst bewertet hat, ist.
exports.alreadyRatedRestricted = function(req, res, next) {

  if(!req._checker) {
    var err = new Error('helper.alreadyRatedRestricted sollte nicht ohne mindestens eine `prefetch*`-Middleware benutzt werden');
    err.status = 500;
    err.name = 'N00bAdmin';
    return next(err);
  }

  var resource = req._checker; // die jeweilige Ressource, deren Ratings abgefragt werden
  var user = req.user;

  if(user.isAdmin()) {
    return next(); // Admins dürfen sowieso
  }

  user.hasCreated(resource.uuid, function(err, hasCreated) {
    if(err) return next(err);
    if(hasCreated) {
      return next(); // Autoren dürfen immer die Ratings ihrer eigenen Inhalte sehen
    }
    user.hasRated(resource.uuid, function(err, hasRated) {
      if(err) return next(err);
      if(hasRated) {
        return next(); // falls der User den Inhalt bereits bewertet hat, darf er auch weiter
      }
      err = new Error('Du darfst die Bewertungen dieses Inhalts erst sehen, wenn du den Inhalt selbst bewertet hast');
      err.status = 401;
      return next(err);
    });
  });


};
