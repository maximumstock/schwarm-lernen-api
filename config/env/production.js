'use strict';

var NEO4J_URL = process.env.NEO4J_URL;
var API_SECRET = process.env.API_SECRET;
var HOST_URL = process.env.HOST_URL || '';
var DISABLE_AUTH = process.env.DISABLE_AUTH || false;
var DEFAULT_USERNAME_LENGTH = 7;
var DEFAULT_PASSWORD_LENGTH = 7;
var PORT = process.env.PORT;

if(!NEO4J_URL) {
  throw new Error('NEO4J_URL fehlt');
}
if(!API_SECRET) {
  throw new Error('API_SECRET fehlt');
}
if(!PORT) {
  throw new Error('PORT fehlt');
}

module.exports = {
  'environment': 'PRODUCTION',
  'NEO4J_URL': NEO4J_URL,
  'HOST_URL': HOST_URL,
  'API_SECRET': API_SECRET,
  'DISABLE_AUTH': DISABLE_AUTH,
  'DEFAULT_USERNAME_LENGTH': DEFAULT_USERNAME_LENGTH,
  'DEFAULT_PASSWORD_LENGTH': DEFAULT_PASSWORD_LENGTH,
  'PORT': PORT
};
