define(["require", "exports", "flash/geom/Point", "flash/rendering/managers/Constants", "flash/rendering/textures/Texture", "flash/geom/Rectangle", "flash/rendering/textures/BaseTexture", "flash/rendering/webgl/Utils", "flash/display3D/renderers/SpriteRenderer", "flash/events/Event", "flash/display/DisplayObject", "flash/display/StageSettings"], function (require, exports, Point_1, Constants_1, Texture_1, Rectangle_1, BaseTexture_1, Utils_1, SpriteRenderer_1, Event_1, DisplayObject_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // TYPED
    class Bitmap extends DisplayObject_1.DisplayObject {
        constructor(texture = null) {
            super();
            this._anchor = new Point_1.Point(0, 0);
            this._texture = texture;
            this._width = 0;
            this._height = 0;
            this._tint = 0;
            this._tintRGB = 0;
            this.tint = 0xFFFFFF;
            this._blendMode = Constants_1.Constants.BLEND_MODES.NORMAL;
            this.shader = null;
            this.cachedTint = 0xFFFFFF;
            this.texture = texture || Texture_1.Texture.EMPTY;
            this._vertexData = new Float32Array(8);
            this.vertexTrimmedData = null;
            this._transformID = -1;
            this._textureID = -1;
            this._transformTrimmedID = -1;
            this._textureTrimmedID = -1;
            this.pluginName = 'sprite';
        }
        getLocalBounds(rect) {
            this._bounds.minX = this._texture.orig.width * -this._anchor.x;
            this._bounds.minY = this._texture.orig.height * -this._anchor.y;
            this._bounds.maxX = this._texture.orig.width * (1 - this._anchor.x);
            this._bounds.maxY = this._texture.orig.height * (1 - this._anchor.y);
            if (!rect) {
                if (!this._localBoundsRect) {
                    this._localBoundsRect = new Rectangle_1.Rectangle();
                }
                rect = this._localBoundsRect;
            }
            return this._bounds.getRectangle(rect);
        }
        containsPoint(point) {
            this.worldTransform.applyInverse(point, Bitmap.tempPoint);
            const width = this._texture.orig.width;
            const height = this._texture.orig.height;
            const x1 = -width * this.anchor.x;
            let y1 = 0;
            if (Bitmap.tempPoint.x >= x1 && Bitmap.tempPoint.x < x1 + width) {
                y1 = -height * this.anchor.y;
                if (Bitmap.tempPoint.y >= y1 && Bitmap.tempPoint.y < y1 + height) {
                    return true;
                }
            }
            return false;
        }
        _calculateBounds() {
            const trim = this._texture.trim;
            const orig = this._texture.orig;
            if (!trim || (trim.width === orig.width && trim.height === orig.height)) {
                this.calculateVertices();
                this._bounds.addQuad(this._vertexData);
            }
            else {
                this.calculateTrimmedVertices();
                this._bounds.addQuad(this.vertexTrimmedData);
            }
        }
        destroy() {
            super.destroy();
            this._anchor = null;
            this._texture.destroy(true);
            this._texture = null;
            this.shader = null;
        }
        renderWebGL() {
            this._renderWebGL();
        }
        _onTextureUpdate() {
            this._textureID = -1;
            this._textureTrimmedID = -1;
            this.cachedTint = 0xFFFFFF;
            if (this._width) {
                this.scale.x = Utils_1.Utils.sign(this.scale.x) * this._width / this._texture.orig.width;
            }
            if (this._height) {
                this.scale.y = Utils_1.Utils.sign(this.scale.y) * this._height / this._texture.orig.height;
            }
        }
        _onAnchorUpdate() {
            this._transformID = -1;
            this._transformTrimmedID = -1;
        }
        calculateVertices() {
            if (this._transformID === this.transform._worldID && this._textureID === this._texture._updateID) {
                return;
            }
            this._transformID = this.transform._worldID;
            this._textureID = this._texture._updateID;
            const texture = this._texture;
            const wt = this.transform.worldTransform;
            const a = wt.a;
            const b = wt.b;
            const c = wt.c;
            const d = wt.d;
            const tx = wt.tx;
            const ty = wt.ty;
            const vertexData = this._vertexData;
            const trim = texture.trim;
            const orig = texture.orig;
            const anchor = this._anchor;
            let w0 = 0;
            let w1 = 0;
            let h0 = 0;
            let h1 = 0;
            if (trim) {
                w1 = trim.x - (anchor.x * orig.width);
                w0 = w1 + trim.width;
                h1 = trim.y - (anchor.y * orig.height);
                h0 = h1 + trim.height;
            }
            else {
                w1 = -anchor.x * orig.width;
                w0 = w1 + orig.width;
                h1 = -anchor.y * orig.height;
                h0 = h1 + orig.height;
            }
            var value = (a * w1) + (c * h1) + tx;
            vertexData[0] = value;
            value = (d * h1) + (b * w1) + ty;
            vertexData[1] = value;
            value = (a * w0) + (c * h1) + tx;
            vertexData[2] = value;
            value = (d * h1) + (b * w0) + ty;
            vertexData[3] = value;
            value = (a * w0) + (c * h0) + tx;
            vertexData[4] = value;
            value = (d * h0) + (b * w0) + ty;
            vertexData[5] = value;
            value = (a * w1) + (c * h0) + tx;
            vertexData[6] = value;
            value = (d * h0) + (b * w1) + ty;
            vertexData[7] = value;
        }
        calculateTrimmedVertices() {
            if (!this.vertexTrimmedData) {
                this.vertexTrimmedData = new Float32Array(8);
            }
            else if (this._transformTrimmedID === this.transform._worldID && this._textureTrimmedID === this._texture._updateID) {
                return;
            }
            this._transformTrimmedID = this.transform._worldID;
            this._textureTrimmedID = this._texture._updateID;
            const texture = this._texture;
            const vertexData = this.vertexTrimmedData;
            const orig = texture.orig;
            const anchor = this._anchor;
            const wt = this.transform.worldTransform;
            const a = wt.a;
            const b = wt.b;
            const c = wt.c;
            const d = wt.d;
            const tx = wt.tx;
            const ty = wt.ty;
            const w1 = -anchor.x * orig.width;
            const w0 = w1 + orig.width;
            const h1 = -anchor.y * orig.height;
            const h0 = h1 + orig.height;
            vertexData[0] = (a * w1) + (c * h1) + tx;
            vertexData[1] = (d * h1) + (b * w1) + ty;
            vertexData[2] = (a * w0) + (c * h1) + tx;
            vertexData[3] = (d * h1) + (b * w0) + ty;
            vertexData[4] = (a * w0) + (c * h0) + tx;
            vertexData[5] = (d * h0) + (b * w0) + ty;
            vertexData[6] = (a * w1) + (c * h0) + tx;
            vertexData[7] = (d * h0) + (b * w1) + ty;
        }
        _renderWebGL() {
            if (!this.stage) {
                return;
            }
            if (this.transform.requireUpdate) {
                this.updateTransform();
                this.transform.updateWorldTransform(this._parent.transform);
            }
            this.transform.update();
            this.calculateVertices();
            this.stage.setObjectRenderer(SpriteRenderer_1.SpriteRenderer.renderer);
            SpriteRenderer_1.SpriteRenderer.renderer.render(this);
        }
        static from(source, width = 0, height = 0) {
            return new Bitmap(Texture_1.Texture.from(source));
        }
        static fromFrame(frameId, width = 0, height = 0) {
            const texture = BaseTexture_1.BaseTexture.TextureCache[frameId];
            if (!texture) {
                throw new Error(`The frameId "${frameId}" does not exist in the texture cache`);
            }
            return new Bitmap(texture);
        }
        static fromImage(imageId, crossorigin, scaleMode = StageSettings_1.StageSettings.SCALE_MODE, width = 0, height = 0) {
            return new Bitmap(Texture_1.Texture.fromImage(imageId, crossorigin, scaleMode));
        }
        get width() {
            return Math.abs(this.scale.x) * this._texture.orig.width;
        }
        set width(value) {
            const s = Utils_1.Utils.sign(this.scale.x) || 1;
            this.scale.x = s * value / this._texture.orig.width;
            this._width = value;
        }
        get height() {
            return Math.abs(this.scale.y) * this._texture.orig.height;
        }
        set height(value) {
            const s = Utils_1.Utils.sign(this.scale.y) || 1;
            this.scale.y = s * value / this._texture.orig.height;
            this._height = value;
        }
        get anchor() {
            return this._anchor;
        }
        set anchor(value) {
            this._anchor.copy(value);
        }
        get tint() {
            return this._tint;
        }
        set tint(value) {
            this._tint = value;
            this._tintRGB = (value >> 16) + (value & 0xff00) + ((value & 0xff) << 16);
        }
        get vertexData() {
            return this._vertexData;
        }
        get blendMode() {
            return this._blendMode;
        }
        get tintRGB() {
            return this._tintRGB;
        }
        get texture() {
            return this._texture;
        }
        set texture(value) {
            if (this._texture === value) {
                return;
            }
            this._texture = value;
            this.cachedTint = 0xFFFFFF;
            this._textureID = -1;
            this._textureTrimmedID = -1;
            if (value) {
                if (value.baseTexture.hasLoaded) {
                    this._onTextureUpdate();
                }
                else {
                    value.addEventListener(Event_1.Event.CHANGE, this._onTextureUpdate, this);
                }
            }
        }
    }
    Bitmap.tempPoint = new Point_1.Point();
    exports.Bitmap = Bitmap;
});
//# sourceMappingURL=Bitmap.js.map