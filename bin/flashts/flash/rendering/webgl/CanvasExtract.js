define(["require", "exports", "flash/geom/Rectangle", "../textures/RenderTexture", "../display/CanvasRenderTarget"], function (require, exports, Rectangle_1, RenderTexture_1, CanvasRenderTarget_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CanvasExtract {
        constructor(renderer) {
            this.renderer = renderer;
            // CanvasRenderer.registerPlugin('extract', CanvasExtract);
            /**
             * Collection of methods for extracting data (image, pixels, etc.) from a display object or render texture
             *
             * @member {PIXI.extract.CanvasExtract} extract
             * @memberof PIXI.CanvasRenderer#
             * @see PIXI.extract.CanvasExtract
             */
            renderer.extract = this;
        }
        /**
         * Will return a HTML Image of the target
         *
         * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
         *  to convert. If left empty will use use the main renderer
         * @return {HTMLImageElement} HTML Image of the target
         */
        image(target) {
            const image = new Image();
            image.src = this.base64(target);
            return image;
        }
        /**
         * Will return a a base64 encoded string of this target. It works by calling
         *  `CanvasExtract.getCanvas` and then running toDataURL on that.
         *
         * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
         *  to convert. If left empty will use use the main renderer
         * @return {string} A base64 encoded string of the texture.
         */
        base64(target) {
            return this.canvas(target).toDataURL();
        }
        /**
         * Creates a Canvas element, renders this target to it and then returns it.
         *
         * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
         *  to convert. If left empty will use use the main renderer
         * @return {HTMLCanvasElement} A Canvas element with the texture rendered on.
         */
        canvas(target) {
            const renderer = this.renderer;
            let context;
            let resolution;
            let frame;
            let renderTexture;
            if (target) {
                if (target instanceof RenderTexture_1.RenderTexture) {
                    renderTexture = target;
                }
                else {
                    renderTexture = renderer.generateTexture(target);
                }
            }
            if (renderTexture) {
                context = renderTexture.baseTexture._canvasRenderTarget.context;
                resolution = renderTexture.baseTexture._canvasRenderTarget.resolution;
                frame = renderTexture.frame;
            }
            else {
                context = renderer.rootContext;
                frame = CanvasExtract.TEMP_RECT;
                frame.width = this.renderer.width;
                frame.height = this.renderer.height;
            }
            const width = frame.width * resolution;
            const height = frame.height * resolution;
            const canvasBuffer = new CanvasRenderTarget_1.CanvasRenderTarget(width, height);
            const canvasData = context.getImageData(frame.x * resolution, frame.y * resolution, width, height);
            canvasBuffer.context.putImageData(canvasData, 0, 0);
            // send the canvas back..
            return canvasBuffer.canvas;
        }
        /**
         * Will return a one-dimensional array containing the pixel data of the entire texture in RGBA
         * order, with integer values between 0 and 255 (included).
         *
         * @param {PIXI.DisplayObject|PIXI.RenderTexture} target - A displayObject or renderTexture
         *  to convert. If left empty will use use the main renderer
         * @return {Uint8ClampedArray} One-dimensional array containing the pixel data of the entire texture
         */
        pixels(target) {
            const renderer = this.renderer;
            let context;
            let resolution;
            let frame;
            let renderTexture;
            if (target) {
                if (target instanceof RenderTexture_1.RenderTexture) {
                    renderTexture = target;
                }
                else {
                    renderTexture = renderer.generateTexture(target);
                }
            }
            if (renderTexture) {
                context = renderTexture.baseTexture._canvasRenderTarget.context;
                resolution = renderTexture.baseTexture._canvasRenderTarget.resolution;
                frame = renderTexture.frame;
            }
            else {
                context = renderer.rootContext;
                frame = CanvasExtract.TEMP_RECT;
                frame.width = renderer.width;
                frame.height = renderer.height;
            }
            return context.getImageData(0, 0, frame.width * resolution, frame.height * resolution).data;
        }
        /**
         * Destroys the extract
         *
         */
        destroy() {
            this.renderer.extract = null;
            this.renderer = null;
        }
    }
    CanvasExtract.TEMP_RECT = new Rectangle_1.Rectangle();
    exports.CanvasExtract = CanvasExtract;
});
