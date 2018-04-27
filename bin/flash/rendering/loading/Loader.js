define(["require", "exports", "./ResourceLoader", "./Resource", "../textures/TextureParser", "../managers/BitmapFontParser", "./SpritesheetParser", "flash/events/Event"], function (require, exports, ResourceLoader_1, Resource_1, TextureParser_1, BitmapFontParser_1, SpritesheetParser_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Loader extends ResourceLoader_1.ResourceLoader {
        /**
         * @param {string} [baseUrl=''] - The base url for all resources loaded by this loader.
         * @param {number} [concurrency=10] - The number of resources to load concurrently.
         */
        constructor(baseUrl, concurrency) {
            super(baseUrl, concurrency);
            Resource_1.Resource.setExtensionXhrType('fnt', Resource_1.Resource.XHR_RESPONSE_TYPE.DOCUMENT);
            for (let i = 0; i < Loader._pixiMiddleware.length; ++i) {
                this.use(Loader._pixiMiddleware[i]);
            }
            // Compat layer, translate the new v2 signals into old v1 events.
            this.onStart.add((l) => {
                //this.emit('start', l));
                this.dispatchEvent(new Event_1.Event(Event_1.Event.OPEN));
            });
            this.onProgress.add((l, r) => {
                //this.emit('progress', l, r));
                this.dispatchEvent(new Event_1.Event(Event_1.Event.OPEN));
            });
            this.onError.add((e, l, r) => {
                //this.emit('error', e, l, r)
            });
            this.onLoad.add((l, r) => {
                //this.emit('load', l, r)
            });
            this.onComplete.add((l, r) => {
                //this.emit('complete', l, r)
            });
        }
        /**
         * Adds a default middleware to the PixiJS loader.
         *
         * @static
         * @param {Function} fn - The middleware to add.
         */
        static addPixiMiddleware(fn) {
            Loader._pixiMiddleware.push(fn);
        }
        /**
         * Destroy the loader, removes references.
         */
        destroy() {
            this.reset();
        }
    }
    Loader._pixiMiddleware = [
        // parse any blob into more usable objects (e.g. Image)
        SpritesheetParser_1.SpritesheetParser.blobMiddlewareFactory,
        // parse any Image objects into textures
        TextureParser_1.TextureParser.textureParser,
        // parse any spritesheet data into multiple textures
        SpritesheetParser_1.SpritesheetParser.spritesheetParser,
        // parse bitmap font data into multiple textures
        BitmapFontParser_1.BitmapFontParser.bitmapFontParser,
    ];
    exports.Loader = Loader;
});
//# sourceMappingURL=Loader.js.map