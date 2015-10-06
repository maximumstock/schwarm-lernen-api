'use strict';

/**
 * @file Einfaches Deploy-Skript, welches einen Admin-User anlegt
 */

var neo4j = require('neo4j');

var DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
var AUTH = '';

if(process.env.USERNAME && process.env.PASSWORD) {
  AUTH = process.env.USERNAME + ':' + process.env.PASSWORD + '@';
}

var db = new neo4j.GraphDatabase({
  url: 'http://'+AUTH+'localhost:7474/graphaware'
});

var query = [
  'MERGE (u:User:Admin {username: "admin"})',
  'SET u.password = {properties}.password',
  'RETURN u'
].join('\n');

var params = {
  properties: {
    username: 'admin',
    password: DEFAULT_ADMIN_PASSWORD
  }
};

db.cypher({
  query: query,
  params: params
}, function(err, result) {
  if(err) throw err;
  console.log('Adminuser angelegt', JSON.stringify(result[0].u, null, 2));
});
