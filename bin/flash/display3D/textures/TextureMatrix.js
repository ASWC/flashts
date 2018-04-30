define(["require", "exports", "flash/geom/Matrix"], function (require, exports, Matrix_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextureMatrix {
        constructor(texture, clampMargin = undefined) {
            this._texture = texture;
            this.mapCoord = new Matrix_1.Matrix();
            this.uClampFrame = new Float32Array(4);
            this.uClampOffset = new Float32Array(2);
            this._lastTextureID = -1;
            this.clampOffset = 0;
            this.clampMargin = (typeof clampMargin === 'undefined') ? 0.5 : clampMargin;
        }
        get texture() {
            return this._texture;
        }
        set texture(value) {
            this._texture = value;
            this._lastTextureID = -1;
        }
        multiplyUvs(uvs, out) {
            if (out === undefined) {
                out = uvs;
            }
            const mat = this.mapCoord;
            for (let i = 0; i < uvs.length; i += 2) {
                const x = uvs[i];
                const y = uvs[i + 1];
                out[i] = (x * mat.a) + (y * mat.c) + mat.tx;
                out[i + 1] = (x * mat.b) + (y * mat.d) + mat.ty;
            }
            return out;
        }
        update(forceUpdate) {
            const tex = this._texture;
            if (!tex || !tex.valid) {
                return false;
            }
            if (!forceUpdate && this._lastTextureID === tex.updateID) {
                return false;
            }
            this._lastTextureID = tex.updateID;
            const uvs = tex.uvs;
            this.mapCoord.set(uvs.x1 - uvs.x0, uvs.y1 - uvs.y0, uvs.x3 - uvs.x0, uvs.y3 - uvs.y0, uvs.x0, uvs.y0);
            const orig = tex.orig;
            const trim = tex.trim;
            if (trim) {
                TextureMatrix.tempMat.set(orig.width / trim.width, 0, 0, orig.height / trim.height, -trim.x / trim.width, -trim.y / trim.height);
                this.mapCoord.append(TextureMatrix.tempMat);
            }
            const texBase = tex.baseTexture;
            const frame = this.uClampFrame;
            const margin = this.clampMargin / texBase.resolution;
            const offset = this.clampOffset;
            frame[0] = (tex.frame.x + margin + offset) / texBase.width;
            frame[1] = (tex.frame.y + margin + offset) / texBase.height;
            frame[2] = (tex.frame.x + tex.frame.width - margin + offset) / texBase.width;
            frame[3] = (tex.frame.y + tex.frame.height - margin + offset) / texBase.height;
            this.uClampOffset[0] = offset / texBase.realWidth;
            this.uClampOffset[1] = offset / texBase.realHeight;
            return true;
        }
    }
    TextureMatrix.tempMat = new Matrix_1.Matrix();
    exports.TextureMatrix = TextureMatrix;
});
//# sourceMappingURL=TextureMatrix.js.map