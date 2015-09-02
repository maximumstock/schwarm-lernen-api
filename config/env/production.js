'use strict';

var NEO4J_URL = process.env.NEO4J_URL;
var HOST_URL = process.env.HOST_URL;
var API_SECRET = process.env.API_SECRET;

if(!NEO4J_URL) {
  throw new Error('Es fehlen Umgebungsvariablen');
}

module.exports = {

  'environment': 'PRODUCTION',
  'NEO4J_URL': NEO4J_URL,
  'HOST_URL': HOST_URL || '',
  'API_SECRET': API_SECRET

};
