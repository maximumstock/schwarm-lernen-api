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

  req.checkBody('r1', 'Der Bewertungsparameter R1 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r2', 'Der Bewertungsparameter R2 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r3', 'Der Bewertungsparameter R3 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r4', 'Der Bewertungsparameter R4 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('r5', 'Der Bewertungsparameter R5 muss ein Ganzzahlwert sein').notEmpty().isInt();
  req.checkBody('comment', 'Der Bewertung muss noch ein Kommentar beiliegen').notEmpty();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  req.sanitizeBody('r1').toInt();
  req.sanitizeBody('r2').toInt();
  req.sanitizeBody('r3').toInt();
  req.sanitizeBody('r4').toInt();
  req.sanitizeBody('r5').toInt();

  var user = req.user;
  var config = req._config;

  user.rate(req.params.infoUUID, req.body, config.ratePoints, function(err, result) {
    if(err) return next(err);
    res.status(201).json({success: true});
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
