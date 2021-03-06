"use strict";
var fs = require('fs-extra');
var path = require('path');
var mime = require('mime');
var should = require("chai").should();

var EmojiConverter = require("../image-to-emoji");
var Color = require("../color");

describe('EmojiConverter', function() {
    var emojiConverter = new EmojiConverter();
    var emojiPath = path.join(__dirname, "/../", "Emojis");
    var testDir = path.join(__dirname, "temp");

    before(function() {
        return fs.removeAsync(testDir)
            .then(function(){ return fs.ensureDirAsync(testDir);})
            .then(function(){ return emojiConverter.readImageMap(emojiPath); });
    });

    it('the test dir should be empty', function() {
        return fs.readdirAsync(testDir).then(function(files) { files.should.be.empty(); });
    });

    it('should be able to write to the test directory', function() {
        fs.writeFileAsync(path.join(testDir, "test.txt"), "H")
            .catch(function(err) { should.not.exist(err); });
    });

    it('should hold an internal map of hex values and images', function() {
        Object.keys(emojiConverter.hexToEmoji).should.have.length.gt(0);
    });

    describe('#getAverageRGB', function() {
        it('should be able to average the color of a png', function() {
            var backgroundColor = {r: 10, g: 20, b: 30};

            return emojiConverter._createImage(1, 1, backgroundColor)
                .then(emojiConverter.getAverageRGB)
                .then(function(averageColor) {
                    should.exist(averageColor);
                    averageColor.r.should.equal(backgroundColor.r);
                    averageColor.g.should.equal(backgroundColor.g);
                    averageColor.b.should.equal(backgroundColor.b);
                });
        });
    });

    describe('#getEmojiFromColor', function() {
        it('provides an emoji for any given color', function() {
            var closestEmoji = emojiConverter.getEmojiFromColor(Color.WHITE);

            should.exist(closestEmoji);
            closestEmoji.should.be.a('string');
            fs.readdirSync(emojiPath).should.contain(closestEmoji);
        });
    });

    describe('#convertImageToEmoji', function() {
        it('can write the image to a file', function() {
            return emojiConverter
                .convertImageToEmoji(path.join(__dirname, "grumpy-cat.jpg"))
                .then(function(emojiImage) {
                    return emojiConverter.writeImageToFile(path.join(testDir, "out.png"), emojiImage);
                }).then(function(file) {
                    mime.lookup(path.join(__dirname, file)).should.equal("image/png");
                }).catch(function(err) {
                    should.not.exist(err);
                });
        });
    });
});
