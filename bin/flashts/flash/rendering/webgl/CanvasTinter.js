define(["require", "exports", "./Utils"], function (require, exports, Utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CanvasTinter {
        /**
         * Basically this method just needs a sprite and a color and tints the sprite with the given color.
         *
         * @memberof PIXI.CanvasTinter
         * @param {PIXI.Sprite} sprite - the sprite to tint
         * @param {number} color - the color to use to tint the sprite with
         * @return {HTMLCanvasElement} The tinted canvas
         */
        static getTintedTexture(sprite, color) {
            const texture = sprite._texture;
            color = CanvasTinter.roundColor(color);
            const stringColor = `#${(`00000${(color | 0).toString(16)}`).substr(-6)}`;
            texture.tintCache = texture.tintCache || {};
            const cachedTexture = texture.tintCache[stringColor];
            let canvas;
            if (cachedTexture) {
                if (cachedTexture.tintId === texture._updateID) {
                    return texture.tintCache[stringColor];
                }
                canvas = texture.tintCache[stringColor];
            }
            else {
                canvas = CanvasTinter.canvas || document.createElement('canvas');
            }
            CanvasTinter.tintMethod(texture, color, canvas);
            canvas.tintId = texture._updateID;
            if (CanvasTinter.convertTintToImage) {
                // is this better?
                const tintImage = new Image();
                tintImage.src = canvas.toDataURL();
                texture.tintCache[stringColor] = tintImage;
            }
            else {
                texture.tintCache[stringColor] = canvas;
                // if we are not converting the texture to an image then we need to lose the reference to the canvas
                CanvasTinter.canvas = null;
            }
            return canvas;
        }
        /**
         * Tint a texture using the 'multiply' operation.
         *
         * @memberof PIXI.CanvasTinter
         * @param {PIXI.Texture} texture - the texture to tint
         * @param {number} color - the color to use to tint the sprite with
         * @param {HTMLCanvasElement} canvas - the current canvas
         */
        static tintWithMultiply(texture, color, canvas) {
            const context = canvas.getContext('2d');
            const crop = texture._frame.clone();
            const resolution = texture.baseTexture.resolution;
            crop.x *= resolution;
            crop.y *= resolution;
            crop.width *= resolution;
            crop.height *= resolution;
            canvas.width = Math.ceil(crop.width);
            canvas.height = Math.ceil(crop.height);
            context.save();
            context.fillStyle = `#${(`00000${(color | 0).toString(16)}`).substr(-6)}`;
            context.fillRect(0, 0, crop.width, crop.height);
            context.globalCompositeOperation = 'multiply';
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
            context.globalCompositeOperation = 'destination-atop';
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
            context.restore();
        }
        /**
         * Tint a texture using the 'overlay' operation.
         *
         * @memberof PIXI.CanvasTinter
         * @param {PIXI.Texture} texture - the texture to tint
         * @param {number} color - the color to use to tint the sprite with
         * @param {HTMLCanvasElement} canvas - the current canvas
         */
        static tintWithOverlay(texture, color, canvas) {
            const context = canvas.getContext('2d');
            const crop = texture._frame.clone();
            const resolution = texture.baseTexture.resolution;
            crop.x *= resolution;
            crop.y *= resolution;
            crop.width *= resolution;
            crop.height *= resolution;
            canvas.width = Math.ceil(crop.width);
            canvas.height = Math.ceil(crop.height);
            context.save();
            context.globalCompositeOperation = 'copy';
            context.fillStyle = `#${(`00000${(color | 0).toString(16)}`).substr(-6)}`;
            context.fillRect(0, 0, crop.width, crop.height);
            context.globalCompositeOperation = 'destination-atop';
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
            // context.globalCompositeOperation = 'copy';
            context.restore();
        }
        /**
         * Tint a texture pixel per pixel.
         *
         * @memberof PIXI.CanvasTinter
         * @param {PIXI.Texture} texture - the texture to tint
         * @param {number} color - the color to use to tint the sprite with
         * @param {HTMLCanvasElement} canvas - the current canvas
         */
        static tintWithPerPixel(texture, color, canvas) {
            const context = canvas.getContext('2d');
            const crop = texture._frame.clone();
            const resolution = texture.baseTexture.resolution;
            crop.x *= resolution;
            crop.y *= resolution;
            crop.width *= resolution;
            crop.height *= resolution;
            canvas.width = Math.ceil(crop.width);
            canvas.height = Math.ceil(crop.height);
            context.save();
            context.globalCompositeOperation = 'copy';
            context.drawImage(texture.baseTexture.source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
            context.restore();
            const rgbValues = Utils_1.Utils.hex2rgb(color);
            const r = rgbValues[0];
            const g = rgbValues[1];
            const b = rgbValues[2];
            const pixelData = context.getImageData(0, 0, crop.width, crop.height);
            const pixels = pixelData.data;
            for (let i = 0; i < pixels.length; i += 4) {
                pixels[i + 0] *= r;
                pixels[i + 1] *= g;
                pixels[i + 2] *= b;
            }
            context.putImageData(pixelData, 0, 0);
        }
        /**
         * Rounds the specified color according to the CanvasTinter.cacheStepsPerColorChannel.
         *
         * @memberof PIXI.CanvasTinter
         * @param {number} color - the color to round, should be a hex color
         * @return {number} The rounded color.
         */
        static roundColor(color) {
            const step = CanvasTinter.cacheStepsPerColorChannel;
            const rgbValues = Utils_1.Utils.hex2rgb(color);
            rgbValues[0] = Math.min(255, (rgbValues[0] / step) * step);
            rgbValues[1] = Math.min(255, (rgbValues[1] / step) * step);
            rgbValues[2] = Math.min(255, (rgbValues[2] / step) * step);
            return Utils_1.Utils.rgb2hex(rgbValues);
        }
    }
    /**
     * Number of steps which will be used as a cap when rounding colors.
     *
     * @memberof PIXI.CanvasTinter
     * @type {number}
     */
    CanvasTinter.cacheStepsPerColorChannel = 8;
    /**
     * Tint cache boolean flag.
     *
     * @memberof PIXI.CanvasTinter
     * @type {boolean}
     */
    CanvasTinter.convertTintToImage = false;
    /**
     * Whether or not the Canvas BlendModes are supported, consequently the ability to tint using the multiply method.
     *
     * @memberof PIXI.CanvasTinter
     * @type {boolean}
     */
    CanvasTinter.canUseMultiply = Utils_1.Utils.canUseNewCanvasBlendModes();
    /**
     * The tinting method that will be used.
     *
     * @memberof PIXI.CanvasTinter
     * @type {tintMethodFunctionType}
     */
    CanvasTinter.tintMethod = 0;
    exports.CanvasTinter = CanvasTinter;
});
