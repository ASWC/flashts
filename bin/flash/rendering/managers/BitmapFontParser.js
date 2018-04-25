define(["require", "exports", "../loading/Resource", "../display/BitmapText", "../textures/BaseTexture", "../webgl/Utils"], function (require, exports, Resource_1, BitmapText_1, BaseTexture_1, Utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BitmapFontParser {
        static bitmapFontParser(resource, next) {
            // skip if no data or not xml data
            if (!resource.data || resource.type !== Resource_1.Resource.TYPE.XML) {
                next();
                return;
            }
            // skip if not bitmap font data, using some silly duck-typing
            if (resource.data.getElementsByTagName('page').length === 0
                || resource.data.getElementsByTagName('info').length === 0
                || resource.data.getElementsByTagName('info')[0].getAttribute('face') === null) {
                next();
                return;
            }
            let xmlUrl = !resource.isDataUrl ? Utils_1.Utils.dirname(resource.url) : '';
            if (resource.isDataUrl) {
                if (xmlUrl === '.') {
                    xmlUrl = '';
                }
                if (resource.baseUrl && xmlUrl) {
                    // if baseurl has a trailing slash then add one to xmlUrl so the replace works below
                    if (resource.baseUrl.charAt(resource.baseUrl.length - 1) === '/') {
                        xmlUrl += '/';
                    }
                }
            }
            // remove baseUrl from xmlUrl
            xmlUrl = xmlUrl.replace(resource.baseUrl, '');
            // if there is an xmlUrl now, it needs a trailing slash. Ensure that it does if the string isn't empty.
            if (xmlUrl && xmlUrl.charAt(xmlUrl.length - 1) !== '/') {
                xmlUrl += '/';
            }
            const textureUrl = xmlUrl + resource.data.getElementsByTagName('page')[0].getAttribute('file');
            if (BaseTexture_1.BaseTexture.TextureCache[textureUrl]) {
                // reuse existing texture
                BitmapFontParser.parse(resource, BaseTexture_1.BaseTexture.TextureCache[textureUrl]);
                next();
            }
            else {
                const loadOptions = {
                    crossOrigin: resource.crossOrigin,
                    loadType: Resource_1.Resource.LOAD_TYPE.IMAGE,
                    metadata: resource.metadata.imageMetadata,
                    parentResource: resource,
                };
                // load the texture for the font
                resource.add(`${resource.name}_image`, textureUrl, loadOptions, (res) => {
                    BitmapFontParser.parse(resource, res.texture);
                    next();
                });
            }
        }
        ;
        /**
         * Register a BitmapText font from loader resource.
         *
         * @function parseBitmapFontData
         * @memberof PIXI.loaders
         * @param {PIXI.loaders.Resource} resource - Loader resource.
         * @param {PIXI.Texture} texture - Reference to texture.
         */
        static parse(resource, texture) {
            resource.bitmapFont = BitmapText_1.BitmapText.registerFont(resource.data, texture);
        }
    }
    exports.BitmapFontParser = BitmapFontParser;
});
