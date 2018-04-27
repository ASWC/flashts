define(["require", "exports", "./BasePrepare", "../textures/BaseTexture"], function (require, exports, BasePrepare_1, BaseTexture_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CanvasPrepare extends BasePrepare_1.BasePrepare {
        constructor(renderer) {
            super(renderer);
            // CanvasRenderer.registerPlugin('prepare', CanvasPrepare);
            this.uploadHookHelper = this;
            /**
            * An offline canvas to render textures to
            * @type {HTMLCanvasElement}
            * @private
            */
            this.canvas = document.createElement('canvas');
            this.canvas.width = CanvasPrepare.CANVAS_START_SIZE;
            this.canvas.height = CanvasPrepare.CANVAS_START_SIZE;
            /**
             * The context to the canvas
            * @type {CanvasRenderingContext2D}
            * @private
            */
            this.ctx = this.canvas.getContext('2d');
            // Add textures to upload
            this.registerUploadHook(CanvasPrepare.uploadBaseTextures);
        }
        /**
         * Destroys the plugin, don't use after this.
         *
         */
        destroy() {
            super.destroy();
            this.ctx = null;
            this.canvas = null;
        }
        /**
         * Built-in hook to upload PIXI.Texture objects to the GPU.
         *
         * @private
         * @param {*} prepare - Instance of CanvasPrepare
         * @param {*} item - Item to check
         * @return {boolean} If item was uploaded.
         */
        static uploadBaseTextures(prepare, item) {
            if (item instanceof BaseTexture_1.BaseTexture) {
                const image = item.source;
                // Sometimes images (like atlas images) report a size of zero, causing errors on windows phone.
                // So if the width or height is equal to zero then use the canvas size
                // Otherwise use whatever is smaller, the image dimensions or the canvas dimensions.
                const imageWidth = image.width === 0 ? prepare.canvas.width : Math.min(prepare.canvas.width, image.width);
                const imageHeight = image.height === 0 ? prepare.canvas.height : Math.min(prepare.canvas.height, image.height);
                // Only a small subsections is required to be drawn to have the whole texture uploaded to the GPU
                // A smaller draw can be faster.
                prepare.ctx.drawImage(image, 0, 0, imageWidth, imageHeight, 0, 0, prepare.canvas.width, prepare.canvas.height);
                return true;
            }
            return false;
        }
    }
    CanvasPrepare.CANVAS_START_SIZE = 16;
    exports.CanvasPrepare = CanvasPrepare;
});
//# sourceMappingURL=CanvasPrepare.js.map