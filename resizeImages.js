
fs
    .readdirAsync(emojiPath)
    .filter(function(fileName) {
        var mimeType = mime.lookup(fileName);
        return mimeType === "image/png" || mimeType === "image/jpeg";
    }, {concurrency: Infinity})
    .map(function(emoji) {
        return emojiConverter
            ._openImage(path.join(emojiPath, "/", emoji))
            .then(function(image) {
                return emojiConverter._resize(16, 16, image);
            })
            .then(function(resizedImage) {
                return emojiConverter.writeImageToFile(path.join(emojiPath, "16px", emoji), resizedImage);
            })
    }, {concurrency: Infinity});