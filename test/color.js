"use strict";
var should = require("chai").should();
var Color = require("../color");

describe('Color', function(){
    var hex ="#0033ff";
    var rgb = {r: 0, g: 51, b: 255};

    it('should be able to convert to a hex representation', function() {
        var color = new Color(rgb);

        color.getHexValue().should.equal(hex);
    });

    it('should be able to convert to a rgb representation', function() {
        var color = new Color(rgb);

        color.getRGB().r.should.equal(rgb.r);
        color.getRGB().g.should.equal(rgb.g);
        color.getRGB().b.should.equal(rgb.b);
    });

    it('can find the square of the distance between two colors', function() {
        var red = new Color({r: 255, g:0, b:0});
        var black = new Color({r: 0, g:0, b:0});

        red.distanceToColorSquared(black).should.equal(Math.pow(255, 2));
    });
});
