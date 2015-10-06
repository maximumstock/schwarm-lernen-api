'use strict';

/**
 * @file Routen für Infos anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');
var async = require('async');

var Target = require('../../models/target');
var Info = require('../../models/info');
var Rating = require('../../models/rating');

var indicative = require('indicative');
var validator = new indicative();

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
              DEGREE RESTRICTED ROUTES
**************************************************/

// Gibt eine bestimmte Info zurück
router.get('/infos/:infoUUID', helper.prefetchInfo, auth.restricted, function(req, res, next) {
  var info = req._info;
  info.addMetadata(API_VERSION);
  res.json(info);
});

// Gibt Bewertung der Info zurück
router.get('/infos/:infoUUID/ratings', helper.prefetchInfo, auth.restricted, function(req, res, next) {

  var info = req._info;
  var user = req.user;

  info.getRatings(function(err, ratings) {
    if(err) return next(err);
    ratings.forEach(function(r) {
      r.addMetadata(API_VERSION);
    });
    res.json(ratings);
  });

});

// Gibt eigene Bewertung für die Info zurück, falls eine existiert
router.get('/infos/:infoUUID/rating', helper.prefetchInfo, auth.restricted, function(req, res, next) {

  var info = req._info;
  var user = req.user;

  user.getMyRatingFor(info.uuid, function(err, myrating) {
    if(err) return next(err);
    myrating.addMetadata(API_VERSION);
    res.json(myrating);
  });

});

// Gibt Kommentare zu der Info zurück
router.get('/infos/:infoUUID/comments', helper.prefetchInfo, auth.restricted, function(req, res, next) {

  var info = req._info;
  info.getComments(function(err, comments) {
    if(err) return next(err);
    comments.forEach(function(i) {
      i.addMetadata(API_VERSION);
    });
    res.json(comments);
  });

});

// Fügt Rating hinzu
router.post('/infos/:infoUUID/ratings', helper.prefetchInfo, auth.restricted, helper.prefetchConfig, helper.prefetchConfig, function(req, res, next) {

  var user = req.user;
  var config = req._config;
  var pack = req._package;
  var info = req._info;

  // eigentliche Funktion die die Bewertung erstellt, Punkte verteilt, etc.
  function create() {
    Rating.create(req.body, user.uuid, info.uuid, function(err, rating) {
      if(err) return next(err);
      rating.addMetadata(API_VERSION);
      // Admins brauchen keine Punkte, etc
      if(user.isAdmin()) {
        return res.status(201).json(rating);
      }

      // Arbeitspaket aktualisieren
      // Punkte an den Ersteller der Bewertung verteilen
      // Punkte vom Ersteller der Bewertung abziehen
      // Punkte an den Ersteller des bewerteten Inhalts verteilen
      async.parallel([
        function(_cb) { pack.updatePackage({ratings: 1}, config, _cb); },
        function(_cb) { rating.givePointsTo(user.uuid, {points: config.ratingPoints}, _cb); },
        function(_cb) { rating.takePointsFrom(user.uuid, {points: config.ratingCost}, _cb); },
        function(_cb) { rating.givePointsTo(info.author, {points: rating.getRating().avg, prestige: user.prestige, maxpoints: config.infoPoints}, _cb); }
      ], function(errors, results) {
        if(errors) next(errors);
        return res.status(201).json({success: true});
      });
    });
  }

  // Admins dürfen sowieso
  if(user.isAdmin()) {
    create();
  } else {
    // der User sollte seine eigenen Inhalte nicht bewerten dürfen
    user.hasCreated(info.uuid, function(err, hasCreated) {
      if(err) return next(err);
      if(hasCreated) {
        err = new Error('Du darfst nicht deine eigenen Inhalte bewerten.');
        err.status = 409;
        return next(err);
      }

      // überprüfe ob der Nutzer noch Bewertungen erstellen darf
      // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
      if(user.ratingsToDo === 0) {
        // Nutzer muss erst Paket abarbeiten
        err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Bewertungen erstellen darfst');
        err.status = 409;
        err.name = 'WorkPackageNotDone';
        return next(err);
      }
      // falls > 0: Einstellung möglich
      // überprüfe ob der Nutzer noch genug Punkte hat
      user.hasPoints(config.ratingCost, function(err, heDoes) {
        if(err) return next(err);
        if(!heDoes) {
          err = new Error('Du hast nicht genug Punkte um eine Bewertung abzugeben');
          err.status = 409;
          err.name = 'MissingPoints';
          return next(err);
        }

        create();

      });
    });
  }
});

// Aufgabe an dem die Lösung hängt
router.get('/infos/:infoUUID/target', helper.prefetchInfo, auth.restricted, function(req, res, next) {

  var info = req._info;
  info.getParent(function(err, target) {
    if(err) return next(err);
    target.addMetadata(API_VERSION);
    res.json(target);
  });

});

/**************************************************
              ADMIN ONLY ROUTES
**************************************************/

// Toggled den Status der Ressource zu inaktiv/aktiv
router.put('/infos/:infoUUID/status', helper.prefetchInfo, auth.adminOnly, function(req, res, next) {

  var info = req._info;
  info.toggle(function(err, result) {
    if(err) return next(err);
    Info.get(info.uuid, function(err, i) {
      if(err) return next(err);
      i.addMetadata(API_VERSION);
      res.json(i);
    });
  });

});

/**************************************************
              AUTHOR ONLY ROUTES
**************************************************/

// Finalisiert die Aufgabe und macht sie öffentlich
router.put('/infos/:infoUUID/submit', helper.prefetchInfo, auth.authorOnly, function(req, res, next) {

  var info = req._info;
  var user = req.user;

  info.finalize(function(err, result) {
    if(err) return next(err);
    Info.get(info.uuid, function(err, info) {
      if(err) return next(err);
      info.addMetadata(API_VERSION);
      res.json(info);
    });
  });

});

// Aktualisiert die Info
router.put('/infos/:infoUUID', helper.prefetchInfo, auth.authorOnly, function(req, res, next) {

  var info = req._info;

  if(info.isFinished()) {
    var err = new Error('Diese Info wurde bereits abgegeben. Du kannst sie nicht mehr verändern.');
    err.status = 409;
    err.name = 'AlreadySubmitted';
    return next(err);
  }

  info.patch(req.body, function(err, ninfo) {
    if(err) return next(err);
    ninfo.addMetadata(API_VERSION);
    res.json(ninfo);
  });

});

module.exports = router;
