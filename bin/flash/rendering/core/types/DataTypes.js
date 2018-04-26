define(["require", "exports", "flash/rendering/core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GLAttributeData {
        constructor(type, size, location, pointer) {
            this.size = size;
            this.type = type;
            this.location = location;
            this.pointer = pointer;
        }
    }
    exports.GLAttributeData = GLAttributeData;
    class SpriteDataGroup {
        constructor() {
            this.textures = [];
            this.textureCount = 0;
            this.ids = [];
            this.size = 0;
            this.start = 0;
            this.blend = 0;
        }
    }
    exports.SpriteDataGroup = SpriteDataGroup;
    class TextureGroupItem extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this.textureCount = 0;
            this.size = 0;
            this.start = 0;
            this.blend = 0;
            this.textures = [];
            this.ids = [];
        }
    }
    exports.TextureGroupItem = TextureGroupItem;
});
