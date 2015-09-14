'use strict';

/**
 * @file Routen für Kommentare anlegen
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

// Gibt einen bestimmten Kommentar zurück
router.get('/comments/:commentUUID', helper.prefetchComment, auth.restricted, function(req, res, next) {
  var comment = req._comment;
  comment.addMetadata(API_VERSION);
  res.json(comment);
});

// Objekt an dem der Kommentar hängt
router.get('/comments/:commentUUID/parent', helper.prefetchComment, auth.restricted, function(req, res, next) {

  var comment = req._comment;
  comment.getParent(function(err, target) {
    if(err) return next(err);
    target.addMetadata(API_VERSION);
    res.json(target);
  });

});

module.exports = router;
