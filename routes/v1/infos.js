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
  info.getRating(function(err, rating) {
    if(err) return next(err);
    res.json(rating);
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
router.post('/infos/:infoUUID/rating', helper.prefetchInfo, auth.restricted, function(req, res, next) {

  req.checkBody('rating', 'Bewertung fehlt').notEmpty();
  req.checkBody('rating', 'Der Bewertungsparameter muss ein Ganzzahlwert sein').isInt();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var user = req.user;
  user.rate(req.params.infoUUID, parseInt(req.body.rating), function(err, result) {
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

module.exports = router;
