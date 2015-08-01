/**
 * @file Testdatei für das Datenmodell Modul.
 * @author Maximilian Stock
 */

var expect = require('chai').expect;
var Modul = require('../../models/modul');

describe('Modell Modul', function() {

  describe('Modul#get', function() {

    it('sollte das richtige Nodeobjekt zurückgeben', function(done) {

      Modul.get('Informatik', function(err, modul) {
        expect(modul).to.be.an('object');
        expect(modul.name).to.be.a('string');
        expect(modul.name).to.equal('Informatik');
        done();
      });

    });

  });

});
