'use strict';

var request = require('supertest');
var app = require('../../');
var expect = require('chai').expect;

var PREFIX = '/api/v1';
var TOKEN = null;

describe('/degrees', function() {

  before(function(done) {
    // get an api token
    request(app)
      .post(PREFIX + '/login')
      .type('form')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({username: "admin", password: "admin"})
      .end(function(err, res) {
        TOKEN = res.body.token;
        expect(TOKEN).to.equal(res.body.token);
        expect(res.status).to.equal(200);
        done();
      });
  });

  describe('GET /degrees', function() {
    it('should return a list of degree objects', function(done) {
      request(app)
        .get(PREFIX + '/degrees')
        .set('x-access-token', TOKEN)
        .end(function(err, res) {
          expect(Array.isArray(res.body)).to.equal(true); // response is an array
          res.body.forEach(function(i) {
            expect(i).to.have.a.property('labels');
            expect(i).to.have.a.property('properties');
            expect(i).to.have.a.property('links');
          });
          done();
        });
    });
  });

});
