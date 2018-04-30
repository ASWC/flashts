define(["require", "exports", "flash/display/BaseObject", "flash/display3D/GLShader"], function (require, exports, BaseObject_1, GLShader_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class AttributeState {
        constructor(arraylength) {
            this.tempAttribState = new Array(arraylength);
            this.attribState = new Array(arraylength);
        }
    }
    exports.AttributeState = AttributeState;
    class SvgSize {
    }
    exports.SvgSize = SvgSize;
    class DecomposedDataUri {
    }
    exports.DecomposedDataUri = DecomposedDataUri;
    class GLAttributeData {
        constructor(type, size, location, pointer) {
            this.size = size;
            this.type = type;
            this.location = location;
            this.pointer = pointer;
        }
    }
    exports.GLAttributeData = GLAttributeData;
    class ShaderUnniformAccess {
        constructor(gl) {
            this.gl = gl;
            this.data = {};
        }
        update(value, data) {
            var format = this.data[value];
            var location = format.location;
            if (format.size === 1) {
                GLShader_1.GLShader.GLSL_SINGLE_SETTERS[format.type](this.gl, location, data);
            }
            else {
                GLShader_1.GLShader.GLSL_ARRAY_SETTERS[format.type](this.gl, location, data);
            }
        }
        set translationMatrix(value) {
            this._translationMatrix = value;
            this.update("translationMatrix", value);
        }
        set projectionMatrix(value) {
            this._projectionMatrix = value;
            this.update("projectionMatrix", value);
        }
        set alpha(value) {
            this._alpha = value;
            this.update("alpha", value);
        }
        set tint(value) {
            this._tint = value;
            this.update("tint", value);
        }
        set uSamplers(value) {
            this._uSamplers = value;
            this.update("uSamplers", value);
        }
        get projectionMatrix() {
            return this._projectionMatrix;
        }
        get translationMatrix() {
            return this._translationMatrix;
        }
        get tint() {
            return this._tint;
        }
        get alpha() {
            return this._alpha;
        }
        get uSamplers() {
            return this._uSamplers;
        }
    }
    exports.ShaderUnniformAccess = ShaderUnniformAccess;
    class ShaderUnniformData {
        constructor(type, size, location, value) {
            this.location = location;
            this.size = size;
            this.type = type;
            this.value = value;
        }
    }
    exports.ShaderUnniformData = ShaderUnniformData;
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
//# sourceMappingURL=DataTypes.js.map