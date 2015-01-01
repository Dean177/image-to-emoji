"use strict";

Color.WHITE = new Color({r: 255, g: 255, b: 255});
Color.BLACK = new Color({r: 0, g:0, b:0});

function Color(rgbValue) {
    if (!rgbValue || rgbValue.r === undefined || rgbValue.g === undefined || rgbValue.b === undefined ) {
        rgbValue = {r: 0, g:0, b:0};
    }

    this.r = rgbValue.r;
    this.g = rgbValue.g;
    this.b = rgbValue.b;
}

Color.prototype.getRGB = function() {
    return {
        r: this.r,
        g: this.g,
        b: this.b
    };
};

Color.prototype.getHexValue = function() {
    var toHex = function(value) {
        var hex = value.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    };

    return "#" + toHex(this.r) + toHex(this.g) + toHex(this.b);
};

Color.prototype.distanceToColorSquared = function(color) {
    return Math.pow(this.r - color.r, 2) +
        Math.pow((this.g - color.g), 2) +
        Math.pow((this.b - color.b), 2)
        ;
};

Color.hexToRGB = function(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

module.exports = Color;
