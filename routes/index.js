/**
 * @file Testroute
 * @author Maximilian Stock
 */

var express = require('express');
var router = express.Router();
var Modul = require('../models/modul');

router.get('/:name', function(req, res, next) {

  Modul.get(req.params.name, function(err, modul) {

    if(err) return next(err);
    return res.json(modul._node);

  });

});

module.exports = router;
