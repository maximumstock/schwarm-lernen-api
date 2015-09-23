'use strict';

var NEO4J_URL = process.env.NEO4J_URL;
var HOST_URL = process.env.HOST_URL || '';
var API_SECRET = process.env.API_SECRET;
var DISABLE_AUTH = process.env.DISABLE_AUTH || false;
var DEFAULT_USERNAME_LENGTH = process.env.DEFAULT_USERNAME_LENGTH || 7;
var DEFAULT_PASSWORD_LENGTH = process.env.DEFAULT_PASSWORD_LENGTH || 7;

if(!NEO4J_URL || !API_SECRET) {
  throw new Error('Es fehlen Umgebungsvariablen');
}

module.exports = {

  'environment': 'PRODUCTION',
  'NEO4J_URL': NEO4J_URL,
  'HOST_URL': HOST_URL,
  'API_SECRET': API_SECRET,
  'DISABLE_AUTH': DISABLE_AUTH,
  'DEFAULT_USERNAME_LENGTH': DEFAULT_USERNAME_LENGTH,
  'DEFAULT_PASSWORD_LENGTH': DEFAULT_PASSWORD_LENGTH

};
