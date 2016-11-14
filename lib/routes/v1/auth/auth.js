'use strict';

/**
 * @file Middleware für Authentifizierung per Token
 */

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var config = require('../../../config/config');
var User = require('../../../models/user');
var Target = require('../../../models/target');

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
        var user = new User(decoded);

        // falls das Konto des Users in der Zwischenzeit deaktiviert wurde, muss er hier gestoppt werden
        if(!user.isActive()) {
          err = new Error('Dein Konto wurde deaktiviert');
          err.status = 401;
          err.name = 'InactiveUserAccount';
          return next(err);
        }

        // Für das Einstellen von Bewertungen wird der Ruf-Wert des Nutzers benötigt
        // dementsprechend macht es Sinn den Wert gleich hier abzugreifen
        user.getPrestige(function(err, prestige) {
          if(err) return next(err);
          user.properties.prestige = prestige;
          req.user = user;
          return next();
        });
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
    if(req.user.isAdmin()) {
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
 * @function Überprüft ob der User überhaupt auf Ressourcen des aktuellen Lernziels zugreifen darf
 * Um diese Middleware nutzen zu können muss das jeweilige Objekt zum Überprüfen der Zugriffsrechte
 * als req._checker im Request-Objekt liegen
 */
exports.restricted = function(req, res, next) {

  if(!req.user || !req._checker) {
    return next(new Error('Konte keinen req.user oder req._checker finden. Sollte nicht passieren :/'));
  }

  if(req.user.isAdmin()) {
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

  checker.getParentEntryTarget(function(err, target) {
    if(err) return next(err);
    target.isAllowedUser(user.uuid, function(err, result) {
     if(err) return next(err);
     if(result) {
       next();
     } else {
       err = new Error('Du bist nicht für dieses Lernziel eingetragen - Kein Zutritt');
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
exports.authorOnly = function(req, res, next) {

  if(!req.user) {
    return next(new Error('authorOnly Middleware sollte nicht standalone genutzt werden'));
  }

  // exports.restricted garantiert bereits, dass sich der User berechtigterweise auf dieses Lernziel Zugriff hat
  // Jetzt muss noch überprüft werden, ob er auch der Autor der jeweiligen Ressource ist
  var id = req.params.taskUUID || req.params.infoUUID || req.params.solutionUUID || req.params.ratingUUID; // ID der zu ändernden/löschenden Ressource

  if(!id) {
    // falls weder eine taskUUID, infoUUID, solutionUUID oder commentUUID existiert, ist etwas schief gelaufen oder die Middleware wurde falsch verwendet
    var err = new Error('Es gibt keine Ressourcen-ID die geprüft werden kann (authorOnly Middleware)');
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

};


/**
 * @function Überprüft ob der User der Autor der angefragten Ressource ist. Falls nicht gibt es einen Fehler
 * Wird nur in Verwendung mit exports.restricted genutzt um zu gewährleisten, dass generell Zugriff auf die Ressourcen des
 * Studiengangs gewährt ist, aber der Nutzer keine Aufgaben, Infos, Lösungen oder Kommentare anderer Nutzer im gleichen
 * Studiengang löschen oder ändern kann.
 */
exports.authorRestricted = function(req, res, next) {

  if(!req.user) {
    return next(new Error('authorOnly Middleware sollte nicht standalone genutzt werden'));
  }

  if(req.user.isAdmin()) {
    return next();
  }

  // exports.restricted garantiert bereits, dass sich der User berechtigterweise auf dieses Lernziel Zugriff hat
  // Jetzt muss noch überprüft werden, ob er auch der Autor der jeweiligen Ressource ist
  var id = req.params.taskUUID || req.params.infoUUID || req.params.solutionUUID || req.params.ratingUUID; // ID der zu ändernden/löschenden Ressource

  if(!id) {
    // falls weder eine taskUUID, infoUUID, solutionUUID oder commentUUID existiert, ist etwas schief gelaufen oder die Middleware wurde falsch verwendet
    var err = new Error('Es gibt keine Ressourcen-ID die geprüft werden kann (authorOnly Middleware)');
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

};
