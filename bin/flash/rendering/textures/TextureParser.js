define(["require", "exports", "flash/display3D/textures/Texture", "../loading/Resource"], function (require, exports, Texture_1, Resource_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextureParser {
        static textureParser() {
            return function textureParser(resource, next) {
                // create a new texture if the data is an Image object
                if (resource.data && resource.type === Resource_1.Resource.TYPE.IMAGE) {
                    resource.texture = Texture_1.Texture.fromLoader(resource.data, resource.url, resource.name);
                }
                next();
            };
        }
    }
    exports.TextureParser = TextureParser;
});
//# sourceMappingURL=TextureParser.js.map