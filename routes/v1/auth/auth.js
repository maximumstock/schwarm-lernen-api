'use strict';

/**
 * @file Middleware für Authentifizierung per Token
 */

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var config = require('../../../config/config');
var User = require('../../../models/user');
var Degree = require('../../../models/degree');

/**
 * @function Middleware die das gesendete Token validiert
 */
exports.auth = function(req, res, next) {

  // falls Authentifizierung ausgeschaltet wurde
  if(config.DISABLE_AUTH) {
    return next();
  }

  // Token aus HTTP-Header
  var token = req.headers['x-access-token'];
  if(token) {

    // token verifizieren
    jwt.verify(token, config.API_SECRET, function(err, decoded) {
      if(err) {
        return next(err);
      } else {
        req.user = new User(decoded);
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

  // falls Authentifizierung ausgeschaltet wurde -> einfach weitermachen
  if(config.DISABLE_AUTH) {
    return next();
  }

  // falls die Middleware ohne exports.auth genutzt wurde und kein Userobjekt im Request steckt -> Fehler
  if(!req.user) {
    return next(new Error('adminOnly Middleware sollte nicht standalone genutzt werden'));
  } else {
    if(req.user.isAdmin) {
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

/**
 * @function Überprüft ob der User überhaupt auf Ressourcen des aktuellen Studiengangs zugreifen darf
 * Um diese Middleware nutzen zu können muss das jeweilige Objekt zum Überprüfen der Zugriffsrechte
 * als req._checker im Request-Objekt liegen
 */
exports.restricted = function(req, res, next) {

  if(!req.user || !req._checker) {
    return next(new Error('Konte keinen req.user oder req._checker finden. Sollte nicht passieren :/'));
  }

  if(req.user.isAdmin) {
    return next();
  }

  if(!req.user.isActive()) {
    var err = new Error('Dieses Benutzerkonto wurde deaktiviert');
    err.status = 401;
    err.name = 'UserDeactived';
    return next(err);
  }

  var user = req.user;
  var checker = req._checker;

  checker.getParentDegree(function(err, degree) {
    if(err) return next(err);
    degree.isAllowedUser(user.uuid, function(err, result) {
     if(err) return next(err);
     if(result) {
       next();
     } else {
       err = new Error('Du bist nicht für diesen Studiengang eingetragen - Kein Zutritt');
       err.status = 401;
       err.name = 'MissingMemberStatus';
       next(err);
     }
    });
  });

};


/**
 * @function Überprüft ob der User der Autor der angefragten Ressource ist. Falls nicht gibt es einen Fehler
 * Wird nur in Verwendung mit exports.restricted genutzt um zu gewährleisten, dass generell Zugriff auf die Ressourcen des
 * Studiengangs gewährt ist, aber der Nutzer keine Aufgaben, Infos, Lösungen oder Kommentare anderer Nutzer im gleichen
 * Studiengang löschen oder ändern kann.
 */
exports.authorRestricted = function(req, res, next) {

  if(!req.user) {
    return next(new Error('authorRestricted Middleware sollte nicht standalone genutzt werden'));
  }

  if(req.user.isAdmin) {
    return next(); // Admins dürfen eh alles
  } else {

    // exports.restricted garantiert bereits, dass sich der User berechtigterweise für diesen Studiengang Zugriff hat
    // Jetzt muss noch überprüft werden, ob er auch der Autor der jeweiligen Ressource ist
    var id = req.params.taskUUID || req.params.infoUUID || req.params.solutionUUID || req.params.commentUUID; // ID der zu ändernden/löschenden Ressource

    if(!id) {
      // falls weder eine taskUUID, infoUUID, solutionUUID oder commentUUID existiert, ist etwas schief gelaufen oder die Middleware wurde falsch verwendet
      var err = new Error('Es gibt keine Ressourcen-ID die geprüft werden kann (authorRestricted Middleware)');
      return next(err);
    }

    req.user.hasCreated(id, function(err, result) {
      if(err) return next(err);
      if(result) {
        // user ist der Autor
        return next(); // einfach durchwinken
      } else {
        // user ist NICHT! der Autor
        err = new Error('Du bist nicht der Autor dieser Ressource und kannst sie deshalb weder löschen noch ändern');
        err.status = 401;
        err.name = 'MissingAuthorStatus';
        return next(err);
      }
    });

  }

};
