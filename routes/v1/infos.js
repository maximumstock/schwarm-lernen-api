'use strict';

/**
 * @file Routen für Infos anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');

var Target = require('../../models/target');
var Comment = require('../../models/comment');
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
router.get('/infos/:infoUUID/rating', helper.prefetchInfo, auth.restricted, function(req, res, next) {

  var info = req._info;
  var user = req.user;

  info.getRating(function(err, rating) {
    if(err) return next(err);
    user.getMyRatingFor(info.uuid, function(err, myrating) {
      if(err) return next(err);
      rating.myRating = myrating;
      res.json(rating);
    });
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
router.post('/infos/:infoUUID/rating', helper.prefetchInfo, auth.restricted, helper.prefetchConfig, helper.prefetchConfig, function(req, res, next) {

  validator
    .validate(Rating.VALIDATION_RULES, req.body)
    .then(function() {

      var user = req.user;
      var config = req._config;

      // überprüfe ob der Nutzer noch Bewertungen erstellen darf
      // falls < 0: es gibt kein Limit/keine Mindestanzahl um das Paket zu beenden
      // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
      // falls > 0: Einstellung möglich
      if(user.ratingsToDo !== 0) {

        // überprüfe ob der Nutzer noch genug Punkte hat
        user.hasPoints(config.ratingCost, function(err, heDoes) {
          if(err) return next(err);
          if(!heDoes) {
            err = new Error('Du hast nicht genug Punkte um eine Bewertung abzugeben');
            err.status = 409;
            err.name = 'MissingPoints';
            return next(err);
          } else {

            user.rate(req.params.taskUUID, req.body, config.ratePoints, config.rateCost, config.rateMultiplier, function(err, result) {
              if(err) return next(err);
              res.status(201).json({success: true});

              user.didWorkOnPackage({tasks: 0, infos: 0, solutions: 0, ratings: 1}, config, function(err, result) {
                if(err) console.error(err);
              });
            });
          }
        });

      } else {
        // Nutzer muss erst Paket abarbeiten
        var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Bewertungen erstellen darfst');
        err.status = 409;
        err.name = 'WorkPackageNotDone';
        res.json(err);
      }

    })
    .catch(function(errors) {
      return next(errors);
    });

});

// Fügt Kommentar hinzu
router.post('/infos/:infoUUID/comments', helper.prefetchInfo, auth.restricted, function(req, res, next) {

  req.checkBody('comment', 'Inhalt des Kommentars fehlt').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  Comment.create(req.body, req.params.infoUUID, req.user.uuid, function(err, comment) {
    if(err) return next(err);
    comment.addMetadata(API_VERSION);
    res.status(201).json(comment);
  });

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


module.exports = router;
