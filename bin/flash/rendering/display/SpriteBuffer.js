define(["require", "exports", "flash/display/Bitmap"], function (require, exports, Bitmap_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SpriteBuffer {
        static getSprite(texture, m, bounds, alpha, area) {
            var cachedSprite = new Bitmap_1.Bitmap(texture);
            cachedSprite.transform.worldTransform = m;
            cachedSprite.anchor.x = -(bounds.x / bounds.width);
            cachedSprite.anchor.y = -(bounds.y / bounds.height);
            cachedSprite.alpha = alpha;
            cachedSprite.bounds = area;
            return cachedSprite;
        }
    }
    exports.SpriteBuffer = SpriteBuffer;
});
