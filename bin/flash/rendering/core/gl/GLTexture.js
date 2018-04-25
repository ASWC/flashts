define(["require", "exports", "flash/rendering/core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GLTexture extends BaseObject_1.BaseObject {
        constructor(gl, width = -1, height = -1, format = NaN, type = NaN) {
            super();
            this.gl = gl;
            this.texture = gl.createTexture();
            this.mipmap = false;
            this.premultiplyAlpha = false;
            this.width = width;
            this.height = height;
            this.format = format || gl.RGBA;
            this.type = type || gl.UNSIGNED_BYTE;
        }
        ;
        upload(value) {
            this.bind();
            var source = value;
            this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
            var newWidth = source.videoWidth || source.width;
            var newHeight = source.videoHeight || source.height;
            if (newHeight !== this.height || newWidth !== this.width) {
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.format, this.format, this.type, source);
            }
            else {
                this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 0, this.format, this.type, source);
            }
            this.width = newWidth;
            this.height = newHeight;
        }
        ;
        uploadData(data, width, height) {
            this.bind();
            if (data instanceof Float32Array) {
                if (!GLTexture.FLOATING_POINT_AVAILABLE) {
                    var ext = this.gl.getExtension("OES_texture_float");
                    if (ext) {
                        GLTexture.FLOATING_POINT_AVAILABLE = true;
                    }
                    else {
                        throw new Error('floating point textures not available');
                    }
                }
                this.type = this.gl.FLOAT;
            }
            else {
                this.type = this.type || this.gl.UNSIGNED_BYTE;
            }
            this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
            if (width !== this.width || height !== this.height) {
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, data || null);
            }
            else {
                this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, data || null);
            }
            this.width = width;
            this.height = height;
        }
        ;
        bind(location = 0) {
            if (location !== undefined) {
                this.gl.activeTexture(this.gl.TEXTURE0 + location);
            }
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        }
        ;
        unbind() {
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        }
        ;
        minFilter(linear) {
            this.bind();
            if (this.mipmap) {
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, linear ? this.gl.LINEAR_MIPMAP_LINEAR : this.gl.NEAREST_MIPMAP_NEAREST);
            }
            else {
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, linear ? this.gl.LINEAR : this.gl.NEAREST);
            }
        }
        ;
        magFilter(linear) {
            this.bind();
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, linear ? this.gl.LINEAR : this.gl.NEAREST);
        }
        ;
        enableMipmap() {
            this.bind();
            this.mipmap = true;
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        }
        ;
        enableLinearScaling() {
            this.minFilter(true);
            this.magFilter(true);
        }
        ;
        enableNearestScaling() {
            this.minFilter(false);
            this.magFilter(false);
        }
        ;
        enableWrapClamp() {
            this.bind();
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        }
        ;
        enableWrapRepeat() {
            this.bind();
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        }
        ;
        enableWrapMirrorRepeat() {
            this.bind();
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.MIRRORED_REPEAT);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.MIRRORED_REPEAT);
        }
        ;
        destroy() {
            this.gl.deleteTexture(this.texture);
        }
        ;
        static fromSource(gl, source, premultiplyAlpha) {
            var texture = new GLTexture(gl);
            texture.premultiplyAlpha = premultiplyAlpha || false;
            texture.upload(source);
            return texture;
        }
        ;
        static fromData(gl, data, width, height) {
            var texture = new GLTexture(gl);
            texture.uploadData(data, width, height);
            return texture;
        }
        ;
    }
    GLTexture.FLOATING_POINT_AVAILABLE = false;
    exports.GLTexture = GLTexture;
});
