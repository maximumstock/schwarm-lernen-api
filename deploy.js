'use strict';

/**
 * @file Einfaches Deploy-Skript, welches einen Admin-User anlegt
 */

var neo4j = require('neo4j');

// Konfigurationsdatei laden
var config = require('./config/config');

var db = new neo4j.GraphDatabase({
  url: config.NEO4J_URL
});

var query = [
  'MERGE (u:User:Admin {username: "admin"})',
  'SET u.password = {properties}.password'
].join('\n');

var params = {
  properties: {
    username: 'admin',
    password: config.DEFAULT_ADMIN_PASSWORD
  }
};

db.cypher({
  query: query,
  params: params
}, function(err, result) {
  if(err) throw err;
  console.log('Adminuser angelegt');
});
