"use strict";
var lwip = require('lwip');
var mime = require('mime');
var Promise = require("bluebird");
var Color = require('./color');
var fs = Promise.promisifyAll(require("fs-extra"));
var path = require('path');

function EmojiConverter() {
    this.jsonFile = "hexValueImageMap.json";
    this.emojiPath = path.join(__dirname, "/../", "Emojis");
    this.hexToEmoji = {};
    this.hexToRGBMap = {};
    var self = this;

    this.convertImageToEmoji = function(imagePath) {
        return self._openImage(imagePath).then(function(image) {
            var startTime = new Date().getTime();
            var emojiChunkMap = self._mapImageToEmojiChunks(image);
            var emojiImage = self._createImage(image.width(), image.height(), Color.BLACK);

            return Promise.join(emojiChunkMap, emojiImage, function(emojiChunkMap, emojiImage) {
                var imageChunksProcessedTime = new Date().getTime();
                console.log("imageChunks processed in: " + (imageChunksProcessedTime - startTime) + "ms");

                // TODO extract this method
                return new Promise(function(resolve, reject) {
                    var batch = emojiImage.batch();
                    emojiChunkMap.forEach(function(chunk) {
                        batch.paste(chunk.coordinates.left, chunk.coordinates.top, chunk.emoji);
                    });

                    batch.exec(function (err, emojiImage) {
                        if (err) { reject(err); } else { resolve(emojiImage); }
                    });
                });
            });
        });
    };

    this._mapImageToEmojiChunks = function(image) {
        var width = image.width();
        var height = image.height();

        return Promise.map(self ._getChunks(width, height), function(chunk) {
            return self._getEmojiFromChunk(chunk, image);
        }, {concurrency: Infinity});
    };

    this._getEmojiFromChunk = function(chunk, image) {
        return self
            .getAverageRGB(chunk, image)
            .then(self._getEmojiFromColor)
            .then(self._openImage)
            .then(function(resizedEmoji) {
                return {emoji: resizedEmoji, coordinates: chunk};
            });
    };

    this._getEmojiFromColor = function(color) {
        var emojiKey = null;
        var minimumDifference = Number.MAX_VALUE;

        for (var hex in self.hexToRGBMap) {
            var emojiColor = self.hexToRGBMap[hex];
            var distance = color.distanceToColor(emojiColor);

            if(distance < minimumDifference) {
                emojiKey = hex;
                minimumDifference = distance;
            }
        }

        return path.join(self.emojiPath, "16px", self.hexToEmoji[emojiKey]);
    };

    this.readImageMap = function(emojiPath) {
        // TODO don't make this construct the map
        if (emojiPath) { self.emojiPath = emojiPath; } else { emojiPath = self.emojiPath; }

        if (fs.existsSync(path.join(emojiPath, self.jsonFile))) {
            return fs
                .readJSONAsync(path.join(emojiPath, "/", self.jsonFile))
                .then(function(hexMaps) {
                    self.hexToRGBMap = hexMaps.hexToRGBMap;
                    self.hexToEmoji = hexMaps.hexToEmojiMap;
                });
        } else {
            return self.constructImageMap(emojiPath);
        }
    };

    this.constructImageMap = function(imagePath) {
        var emojis = fs.readdirSync(imagePath).filter(function(fileName) {
            var mimeType = mime.lookup(fileName);
            return mimeType === "image/png" || mimeType === "image/jpeg";
        });

        return Promise.all(
            emojis.map(function(emoji) {
                return self._openImage(path.join(imagePath, "/", emoji))
                    .then(function(image) { return self.getAverageRGB(null, image) })
                    .then(function(color) {
                        var hexValue = color.getHexValue();
                        self.hexToRGBMap[hexValue] = color;
                        self.hexToEmoji[hexValue] = emoji;
                    })
            }))
            .then(function () {
                return fs.writeJSONAsync(path.join(imagePath, "/", self.jsonFile), { hexToEmojiMap: self.hexToEmoji, hexToRGBMap: self.hexToRGBMap})
            });
    };
}

EmojiConverter.prototype._getChunks = function(width, height) {
    var size = 16;
    var chunkCoordinates = [];

    // TODO this will leave a gap along the right and bottom of the image unless image.width = n * size
    for (var top = 0; top < height - size; top += size) {
        for (var left = 0; left < width - size; left += size) {
            chunkCoordinates.push({top: top, left: left, right: left + size, bottom: top + size});
        }
    }

    return chunkCoordinates;
};

EmojiConverter.prototype.getAverageRGB = function(chunk, image) {
    return new Promise(function(resolve, reject) {
        try {
            chunk = chunk || {top: 0, left: 0, right: image.width(), bottom: image.height()};
            var averageColor = new Color({r: 0, g: 0, b: 0});
            var pixelsSampled = 0;
            for (var top = chunk.top; top < chunk.bottom; top += 3) {
                for (var left = chunk.left; left < chunk.right; left += 3) {
                    var pixel = image.getPixel(left, top);
                    pixelsSampled++;
                    averageColor.r += pixel.r;
                    averageColor.g += pixel.g;
                    averageColor.b += pixel.b;
                }
            }
            averageColor.r = Math.round(averageColor.r / pixelsSampled);
            averageColor.g = Math.round(averageColor.g / pixelsSampled);
            averageColor.b = Math.round(averageColor.b / pixelsSampled);

            resolve(averageColor);
        } catch (err) {
            reject(err);
        }
    });
};

EmojiConverter.prototype._resize = function(width, height, image) {
    return new Promise(function (resolve, reject) {
      image.resize(width, height, "grid", function(err, resizedImage) {
          if (err) { reject(err) } else { resolve(resizedImage); }
      });
    });
};

EmojiConverter.prototype.writeImageToFile = function(file, image) {
    return new Promise(function(resolve, reject) {
        image.writeFile(file, function(err) {
            if (err) { reject(err); } else { resolve(file); }
        })
    });
};

EmojiConverter.prototype._openImage = function(file) {
    return new Promise(function(resolve, reject) {
        lwip.open(
            file, function(err, image) { if (err) { reject(err); } else { resolve(image); }
        });
    });
};

EmojiConverter.prototype._createImage = function(width, height, backgroundColor) {
    return new Promise(function(resolve, reject) {
        lwip.create(width, height, backgroundColor, function(err, image) {
            if (err) { reject(err); } else { resolve(image); }
        });
    });
};

module.exports = EmojiConverter;