'use strict';

/**
 * @file Routen für Bewertungen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');
var async = require('async');

var Rating = require('../../models/rating');

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
            DEGREE RESTRICTED ROUTES
**************************************************/

// Eine bestimmte Bewertung
router.get('/ratings/:ratingUUID', helper.prefetchRating, auth.restricted, function(req, res, next) {

  var rating = req._rating;
  rating.addMetadata(API_VERSION);
  res.json(rating);

});

// Gibt eigene Bewertung für die Bewertung zurück, falls eine existiert
router.get('/ratings/:ratingUUID/rating', helper.prefetchRating, auth.restricted, function(req, res, next) {

  var _rating = req._rating;
  var user = req.user;

  user.getMyRatingFor(_rating.uuid, function(err, myrating) {
    if(err) return next(err);
    myrating.addMetadata(API_VERSION);
    res.json(myrating);
  });

});

// Bewertung erstellen
router.post('/ratings/:ratingUUID/ratings', helper.prefetchRating, auth.restricted, helper.prefetchConfig, helper.prefetchPackage, function(req, res, next) {

  var user = req.user;
  var config = req._config;
  var pack = req._package;
  var _rating = req._rating;

  // eigentliche Funktion die die Bewertung erstellt, Punkte verteilt, etc.
  function create() {
    Rating.create(req.body, user.uuid, _rating.uuid, function(err, rating) {
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
        function(_cb) { rating.givePointsTo(user.uuid, {points: config.ratePoints}, _cb); },
        function(_cb) { rating.takePointsFrom(user.uuid, {points: config.rateCost}, _cb); },
        function(_cb) { rating.givePrestigeTo(_rating.author, {points: rating.getRating().avg, prestige: user.prestige}, _cb); }
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
    user.hasCreated(_rating.uuid, function(err, hasCreated) {
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

/**************************************************
            AUTHOR ONLY ROUTES
**************************************************/

// Gibt Bewertungen der Bewertung zurück
router.get('/ratings/:ratingUUID/ratings', helper.prefetchRating, auth.authorOnly, function(req, res, next) {

  var _rating = req._rating;
  var user = req.user;

  _rating.getRatings(function(err, ratings) {
    if(err) return next(err);
    ratings.forEach(function(r) {
      r.addMetadata(API_VERSION);
    });
    res.json(ratings);
  });

});


module.exports = router;
