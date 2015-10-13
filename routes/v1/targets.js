'use strict';

/**
 * @file Routen für Lernziele anlegen
 */

var express = require('express');
var router = express.Router();
var config = require('../../config/config');
var helper = require('./helper/middleware');
var auth = require('./auth/auth');
var async = require('async');
var moment = require('moment');

var Target = require('../../models/target');
var Info = require('../../models/info');
var Task = require('../../models/task');
var Config = require('../../models/config');
var User = require('../../models/user');
var Package = require('../../models/package');
var GlobalConfig = require('../../models/globalconfig');

var API_VERSION = config.HOST_URL + '/api/v1';

/**************************************************
              DEGREE RESTRICTED ROUTES
**************************************************/

// Gibt alle Hauptlernziele zurück
router.get('/targets', function(req, res, next) {

  Target.getAllEntryTargets(function(err, targets) {
    if(err) return next(err);
    targets.forEach(function(t) {
      t.addMetadata(API_VERSION);
    });
    res.json(targets);
  });

});

// Gibt ein bestimmtes Lernziel zurück
router.get('/targets/:targetUUID', helper.prefetchTarget, auth.restricted, function(req, res, next) {
  var target = req._target;
  target.addMetadata(API_VERSION);
  res.json(target);
});

// Gibt Konfiguration des Lernziels zurück
router.get('/targets/:targetUUID/config', helper.prefetchTarget, helper.prefetchConfig, auth.restricted, function(req, res, next) {

  var config = req._config;
  res.json(config);

});

// Gibt globale Konfiguration des Lernziels zurück
router.get('/targets/:targetUUID/globalconfig', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  var target = req._target;

  target.getGlobalConfig(function(err, globalconfig) {
    if(err) return next(err);
    res.json(globalconfig);
  });

});

// Gibt alle weiteren Kinder 1 Ebene unter aktuellem Lernziel zurück
router.get('/targets/:targetUUID/children', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  var target = req._target;
  target.getChildren(1, function(err, children) {
    if(err) return next(err);

    var keys = Object.keys(children);
    keys.forEach(function(k) {
      children[k].forEach(function(i) {
        i.addMetadata(API_VERSION);
      });
    });
    res.json(children);
  });

});

// Gibt die Parent-Node des jeweiligen Lernziels zurück
router.get('/targets/:targetUUID/parent', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  var target = req._target;
  target.getParent(function(err, p) {
    if(err) return next(err);
    if(p === null) {
      err = new Error('Dieses Lernziel hat kein darüberstehendes Lernziel mehr. Dieses Lernziel ist bereits ein Hauptlernziel');
      err.status = 404;
      err.name = 'NoParentTargetFound';
      return next(err);
    }
    p.addMetadata(API_VERSION);
    res.json(p);
  });

});

// Fügt eine neue Info hinzu
router.post('/targets/:targetUUID/infos', helper.prefetchTarget, auth.restricted, helper.prefetchConfig, helper.prefetchPackage, function(req, res, next) {

  var target = req._target;
  var config = req._config;
  var user = req.user;
  var pack = req._package;

  // eigentliche Funktion die die Info erstellt und Punktevergabe, etc. ausführt
  function create() {
    Info.create(req.body, target.uuid, req.user.uuid, function(err, info) {
      if(err) return next(err);
      info.addMetadata(API_VERSION);
      // Admins brauchen keine Punkte, etc
      if(user.isAdmin()) {
        return res.status(201).json(info);
      }
      // arbeitspaket aktualisieren
      // Punkte an den User verteilen, der die Info eingestellt hat
      // Punkte vom Ersteller der Info abziehen
      async.parallel([
        function(_cb) {pack.updatePackage({infos: 1}, config, _cb);},
        function(_cb) {info.givePointsTo(user.uuid, {points: config.infoPoints}, _cb);},
        function(_cb) {info.takePointsFrom(user.uuid, {points: config.infoCost}, _cb);}
      ], function(errors, results) {
        if(errors) return next(errors);
        res.json(info);
      });
    });
  }

  // Admins dürfen sowieso
  if(user.isAdmin()) {
    create();
  } else {
    // für normale User:
    // überprüfe ob der Nutzer noch Infos erstellen darf
    // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
    // falls > 0: Einstellung möglich
    if(pack.infosToDo === 0) {
      // Nutzer muss erst Paket abarbeiten
      var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Infos erstellen darfst');
      err.status = 409;
      err.name = 'WorkPackageNotDone';
      return next(err);
    }

    // überprüfe ob der Nutzer noch genug Punkte hat
    user.hasPoints(config.infoCost, function(err, heDoes) {
      if(err) return next(err);
      if(!heDoes) {
        err = new Error('Du hast nicht genug Punkte um eine Info abzugeben');
        err.status = 409;
        err.name = 'MissingPoints';
        return next(err);
      } else {
        create();
      }
    });
  }

});

// Fügt eine neue Aufgabe hinzu
router.post('/targets/:targetUUID/tasks', helper.prefetchTarget, auth.restricted, helper.prefetchConfig, helper.prefetchPackage, function(req, res, next) {

  var target = req._target;
  var config = req._config;
  var user = req.user;
  var pack = req._package;

  // eigentliche Funktion die die Aufgabe erstellt und Punktevergabe, etc. ausführt
  function create() {
    Task.create(req.body, target.uuid, req.user.uuid, function(err, task) {
      if(err) return next(err);
      task.addMetadata(API_VERSION);

      // Admins brauchen keine Punkte, etc
      if(user.isAdmin()) {
        return res.status(201).json(task);
      }

      // arbeitspaket aktualisieren
      // Punkte an den User verteilen, der die Aufgabe eingestellt hat
      // Punkte vom User als Gebühr abzwicken, der die Aufgabe eingestellt hat
      async.parallel([
        function(_cb) {pack.updatePackage({tasks: 1}, config, _cb);},
        function(_cb) {task.givePointsTo(user.uuid, {points: config.taskPoints}, _cb);},
        function(_cb) {task.takePointsFrom(user.uuid, {points: config.taskCost}, _cb);}
      ], function(errors, results) {
        if(errors) return next(errors);
        res.status(201).json(task);
      });
    });
  }

  // Admins dürfen sowieso
  if(user.isAdmin()) {
    create();
  } else {
    // für normale User:
    // überprüfe ob der Nutzer noch Aufgabe erstellen darf
    // falls 0: Limit erreicht, Paket muss erst abgearbeitet werden
    // falls > 0: Einstellung möglich
    if(pack.tasksToDo === 0) {
      // Nutzer muss erst Paket abarbeiten
      var err = new Error('Du musst erst dein Arbeitspaket abarbeiten bevor du wieder Aufgaben erstellen darfst');
      err.status = 409;
      err.name = 'WorkPackageNotDone';
      return next(err);
    }

    // überprüfe ob der Nutzer noch genug Punkte hat
    user.hasPoints(config.taskCost, function(err, heDoes) {
      if(err) return next(err);
      if(!heDoes) {
        err = new Error('Du hast nicht genug Punkte um eine Aufgabe abzugeben');
        err.status = 409;
        err.name = 'MissingPoints';
        return next(err);
      } else {
        create();
      }
    });
  }

});


/**************************************************
              ADMIN ONLY ROUTES
**************************************************/
// Gibt alle Nutzer, die Zugriff auf dieses Lernziel haben, zurück
// TODO
router.get('/targets/:targetUUID/users', helper.prefetchTarget, auth.restricted, function(req, res, next) {

  var target = req._target;
  target.getUsers(function(err, users) {
    if(err) return next(err);
    users.forEach(function(u) {
      u.addMetadata(API_VERSION);
    });
    res.json(users);
  });

});

// Hauptlernziel erstellen
router.post('/targets', auth.adminOnly, function(req, res, next) {

  Target.create(req.body, null, function(err, target) {
    if (err) return next(err);
    // jedes Hauptlernziel muss eine globale Config besitzen
    GlobalConfig.create(GlobalConfig.DEFAULT_CONFIG, target.uuid, function(actualError, config) {
      if(actualError) {
        // falls ein Fehler bei der Erstellung einer neuen Konfiguration ->
        return target.del(function(err, result) {
          if(err) return next(err);
          return next(actualError);
        });
      }
      target.addMetadata(API_VERSION);
      res.status(201).json(target);
    });
  });

});

// Fügt ein neues Lernziel zu einem bestehenden Lernziel hinzu
router.post('/targets/:targetUUID/targets', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;
  Target.create(req.body, target.uuid, function(err, info) {
    if(err) return next(err);
    info.addMetadata(API_VERSION);
    res.json(info);
  });

});

// Lernziel löschen
router.delete('/targets/:targetUUID', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;
  target.del(function(err, result) {
    if(err) return next(err);
    res.json({success: true});
  });

});

// Konfiguration aktualsieren
router.put('/targets/:targetUUID/config', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;

  // je nachdem ob es sich bei `targetUUID` um ein Hauptlernziel oder ein gewöhnliches Lernziel handelt, muss erst eine Config erstellt werden
  // durch folgendes Codegebilde müssen Lernziele nicht zwingend Konfigurationen besitzen sondern können nach und nach per PUT-Requests aktualisiert werden

  // Hauptlernziele besitzen stets eine Konfiguration -> einfach updaten
  // gewöhnliche Lernziel besitzen nach Erstellung noch keine und müssen - vor der Aktualisierung - erst noch erstellt werden
  target.hasConfig(function(err, hasConfig) {
    if(err) return next(err);
    // falls das Lernziel bereits eine Konfiguration besitzt -> einfach updaten
    if(hasConfig) {
      target.getConfig(function(err, config) {
        if(err) return next(err);
        config.patch(req.body, function(err, nconfig) {
          if(err) return next(err);
          res.json(nconfig);
        });
      });
    } else {
      // falls noch keine Config besteht -> neue default Config erstellen und danach aktualisieren
      Config.create({}, target.uuid, function(err, config) {
        if(err) return next(err);
        config.patch(req.body, function(err, nconfig) {
          if(err) return next(err);
          res.json(nconfig);
        });
      });
    }
  });

});

// globale Konfiguration aktualisieren
// egal welches Lernziel für die URL gewählt wird, es wird immer die globale Konfiguration aktualisiert
router.put('/targets/:targetUUID/globalconfig', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;

  target.getGlobalConfig(function(err, globalconfig) {
    if(err) return next(err);
    globalconfig.patch(req.body, function(err, nglobalconfig) {
      if(err) return next(err);
      res.json(nglobalconfig);
    });
  });

});

// Config für Lernziel entfernen
router.delete('/targets/:targetUUID/config', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;

  // falls das Lernziel ein Hauptlernziel ist, kann die Config nicht entfernt werden, da alle Hauptlernziele stets eine Config haben müssen
  // damit ihre unterstehenden Lernziele auch stets eine haben
  if(target.isEntryTarget()) {
    var err = new Error('Konfigurationen von Hauptlernziele können nicht gelöscht werden');
    err.status = 409;
    return next(err);
  }

  // die Konfigurationen von gewöhnlichen Lernziele können jedoch gelöscht werden
  // aber nur wenn sie selber eine haben
  target.hasConfig(function(err, hasConfig) {
    if(err) return next(err);
    if(!hasConfig) {
      err = new Error('Dieses Lernziel hat keine eigene Konfiguration, welche gelöscht werden kann');
      err.status = 404;
      err.name = 'ConfigNotFound';
      return next(err);
    }
    // Konfiguration holen und löschen
    target.getConfig(function(err, config) {
      if(err) return next(err);
      config.del(function(err, result) {
        if(err) return next(err);
        res.json({success: true});
      });
    });
  });

});

// User für Lernziel erstellen
router.put('/targets/:targetUUID/users', auth.adminOnly, helper.prefetchTarget, helper.prefetchConfig, function(req, res, next) {

  req.checkBody('amount', 'Menge an zu erstellenden Usern fehlt').notEmpty().isInt();
  var errors = req.validationErrors();
  if(errors) {
    return next(errors);
  }

  var target = req._target;
  var config = req._config;

  User.generate(req.body.amount, function(err, users) {
    if(err) return next(err);
    // User erstmal erstellen
    var todo = users.map(function(i) {

      return function(cb) {
        User.create(i, function(err, user) {
          if(err) return cb(err);
          // ein Arbeitspaket für den User erstellen
          Package.create(config, user.uuid, function(err, workpackage) {
            if(err) return cb(err);
            // neuen User zum Lernziel hinzufügen
            target.addUser(user.uuid, cb);
          });
        });
      };

    });

    async.parallel(todo, function(errors, results) {
      if(errors) {
        console.error(errors);
        var err = new Error('Beim Erstellen von neuen Usern für den Studiengang `'+target.uuid+'` ist ein Fehler aufgetreten');
        return next(err);
      }
      res.status(201).json(users);
    });
  });

});


// Lernziel löschen
router.delete('/targets/:targetUUID', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;
  target.del(function(err, result) {
    if(err) return next(err);
    res.json({});
  });

});

// Lernziel aktualisieren
router.put('/targets/:targetUUID', auth.adminOnly, helper.prefetchTarget, function(req, res, next) {

  var target = req._target;
  var newParentUUID = req.body.parent;
  var properties = req.body;
  delete properties.parent; // Attribut entfernen damit es nicht in den Node-Properties steht

  // Properties aktualisieren
  target.patch(properties, function(err, nt) {
    if(err) return next(err);

    nt.addMetadata(API_VERSION);
    if(newParentUUID) {
      // falls eine neue Parent-UUID gegeben ist muss diese die neue Beziehung sein
      nt.changeParent(newParentUUID, function(err, nnt) {
        if(err) return next(err);
        nnt.addMetadata(API_VERSION);
        return res.json(nnt);
      });
    } else {
      res.json(nt);
    }
  });

});

module.exports = router;
