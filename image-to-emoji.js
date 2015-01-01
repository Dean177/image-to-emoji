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

    var self = this;

    this.getEmojiFromColor = function(color) {
        var emojiKey = null;
        var minimumDifference = Number.MAX_VALUE;

        Object.keys(self.hexToEmoji)
            .map(function(hexValue) {
                return new Color(Color.hexToRGB(hexValue));
            })
            .forEach(function(emojiColor) {
                var distance = color.distanceToColorSquared(emojiColor);

                if(distance < minimumDifference) {
                    emojiKey = emojiColor.getHexValue();
                    minimumDifference = distance;
                }
            });

        return self.hexToEmoji[emojiKey];
    };

    this.readImageMap = function(emojiPath) {
        // TODO don't make this construct the map
        if (emojiPath) { self.emojiPath = emojiPath; } else { emojiPath = self.emojiPath; }

        if (fs.existsSync(path.join(emojiPath, self.jsonFile))) {
            return fs
                .readJSONAsync(path.join(emojiPath, "/", self.jsonFile))
                .then(function(hexToEmojiMap) { self.hexToEmoji = hexToEmojiMap; });
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
                    .then(self.getAverageRGB)
                    .then(function(color) {
                        self.hexToEmoji[color.getHexValue()] = emoji;
                    })
            }))
            .then(function () {
                return fs.writeJSONAsync(path.join(imagePath, "/", self.jsonFile), self.hexToEmoji)
            });
    };

    this.convertImageToEmoji = function(imagePath) {
        var originalImage;
        //Size is the width & height of the emoji on the target image.
        var size = 8;
        return self._openImage(imagePath)
            .then(function(image) {
                originalImage = image;
                return self._createImage(image.width(), image.height(), Color.BLACK);
            })
            .then(function(emojiImage) {

                var imageChunks = [];

                // TODO this will leave a gap at the bottom of the image
                // TODO make this an async method
                for (var top = 0; top < originalImage.height() - size; top += size) {
                    for (var left = 0; left < originalImage.width() - size; left += size) {
                        imageChunks.push({ top: top, left: left, right: left + size, bottom: top + size });
                    }
                }

                return Promise.reduce(imageChunks, function(accumulatedEmojiImage, originalImageChunk) {
                    return self
                        ._extract(originalImageChunk, originalImage)
                        .then(self.getAverageRGB)
                        .then(self.getEmojiFromColor)
                        .then(function(emoji) {
                            return self._drawEmojiOntoImage(originalImageChunk, path.join(self.emojiPath, emoji), accumulatedEmojiImage);
                        })
                        ;
                }, emojiImage);
            });
    };
}



EmojiConverter.prototype.getAverageRGB = function(image) {
    return new Promise(function(resolve, reject) {
        try {
            var averageColor = new Color({r: 0, g: 0, b: 0});
            var width = image.width();
            var height = image.height();

            for (var left = 0; left < width; left++) {
                for (var top = 0; top < height; top++) {
                    var pixel = image.getPixel(left, top);
                    averageColor.r += pixel.r;
                    averageColor.g += pixel.g;
                    averageColor.b += pixel.b;
                }
            }
            averageColor.r = Math.round(averageColor.r / (width * height));
            averageColor.g = Math.round(averageColor.g / (width * height));
            averageColor.b = Math.round(averageColor.b / (width * height));

            resolve(averageColor);
        } catch (err) {
            reject(err);
        }
    });
};

EmojiConverter.prototype._drawEmojiOntoImage = function(position, emojiPath, image) {
    var width = position.right - position.left;
    var height = width;
    return EmojiConverter.prototype._openImage(emojiPath)
        .then(function(emojiImage) {
            return EmojiConverter.prototype._resize(width, height, emojiImage);
        })
        .then(function(resizedImage) {
            return EmojiConverter.prototype._paste(position, resizedImage, image);
        })
        ;
};

EmojiConverter.prototype._resize = function(width, height, image) {
    return new Promise(function (resolve, reject) {
      image.resize(width, height, "lanczos", function(err, resizedImage) {
          if (err) { reject(err) } else { resolve(resizedImage); }
      });
    });
};

EmojiConverter.prototype._paste = function(position, imageToBePasted, targetImage) {
    return new Promise(function (resolve, reject) {
        targetImage.paste(position.left, position.top, imageToBePasted, function (err, newImage) {
            if (err) { reject(err); } else { resolve(newImage); }
        })
    });
};

EmojiConverter.prototype.writeImageToFile = function(file, image) {
    return new Promise(function(resolve, reject) {
        image.writeFile(file, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(file);
            }
        })
    });
};

EmojiConverter.prototype.getImageAsBuffer = function(image) {
    return new Promise(function(resolve, reject) {
        image.toBuffer("png", {compressions: "fast", interlaced: false, transparency: 'auto'}, function (err, buffer) {
            if (err) {
                reject(err);
            } else {
                resolve(buffer);
            }
        });
    });
};

EmojiConverter.prototype._extract = function(chunk, image) {
    return new Promise(function(resolve, reject) {
        image.extract(chunk.left, chunk.top, chunk.right, chunk.bottom, function(err, extractedImage) {
            if (err) {
                reject(err);
            } else {
                resolve(extractedImage);
            }
        })
    });
};

EmojiConverter.prototype._openImage = function(file) {
    return new Promise(function(resolve, reject) {
        lwip.open(file, function(err, image) {
            if (err) {
                reject(err);
            } else {
                resolve(image);
            }
        });
    });
};

EmojiConverter.prototype._createImage = function(width, height, backgroundColor) {
    return new Promise(function(resolve, reject) {
        lwip.create(width, height, backgroundColor, function(err, image) {
            if (err) {
                reject(err);
            } else {
                resolve(image);
            }
        });
    });
};

module.exports = EmojiConverter;