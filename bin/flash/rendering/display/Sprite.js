define(["require", "exports", "../../geom/Point", "../math/ObservablePoint", "../managers/Constants", "../textures/Texture", "../shapes/Rectangle", "../textures/BaseTexture", "../webgl/Utils", "flash/rendering/display/Container", "../managers/RendererManager", "../webgl/SpriteRenderer", "../Settings"], function (require, exports, Point_1, ObservablePoint_1, Constants_1, Texture_1, Rectangle_1, BaseTexture_1, Utils_1, Container_1, RendererManager_1, SpriteRenderer_1, Settings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Sprite extends Container_1.Container {
        constructor(texture) {
            super();
            RendererManager_1.RendererManager.manager.addRenderer(SpriteRenderer_1.SpriteRenderer.renderer);
            this._anchor = new ObservablePoint_1.ObservablePoint(this._onAnchorUpdate, this);
            this._texture = null;
            this._width = 0;
            this._height = 0;
            this._tint = 0;
            this._tintRGB = 0;
            this.tint = 0xFFFFFF;
            this.blendMode = Constants_1.Constants.BLEND_MODES.NORMAL;
            this.shader = null;
            this.cachedTint = 0xFFFFFF;
            this.texture = texture || Texture_1.Texture.EMPTY;
            this.vertexData = new Float32Array(8);
            this.vertexTrimmedData = null;
            this._transformID = -1;
            this._textureID = -1;
            this._transformTrimmedID = -1;
            this._textureTrimmedID = -1;
            this.pluginName = 'sprite';
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
            const vertexData = this.vertexData;
            const trim = texture.trim;
            const orig = texture.orig;
            const anchor = this._anchor;
            let w0 = 0;
            let w1 = 0;
            let h0 = 0;
            let h1 = 0;
            if (trim) {
                w1 = trim.x - (anchor._x * orig.width);
                w0 = w1 + trim.width;
                h1 = trim.y - (anchor._y * orig.height);
                h0 = h1 + trim.height;
            }
            else {
                w1 = -anchor._x * orig.width;
                w0 = w1 + orig.width;
                h1 = -anchor._y * orig.height;
                h0 = h1 + orig.height;
            }
            vertexData[0] = (a * w1) + (c * h1) + tx;
            vertexData[1] = (d * h1) + (b * w1) + ty;
            vertexData[2] = (a * w0) + (c * h1) + tx;
            vertexData[3] = (d * h1) + (b * w0) + ty;
            vertexData[4] = (a * w0) + (c * h0) + tx;
            vertexData[5] = (d * h0) + (b * w0) + ty;
            vertexData[6] = (a * w1) + (c * h0) + tx;
            vertexData[7] = (d * h0) + (b * w1) + ty;
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
            const w1 = -anchor._x * orig.width;
            const w0 = w1 + orig.width;
            const h1 = -anchor._y * orig.height;
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
        _renderWebGL(renderer) {
            this.calculateVertices();
            renderer.setObjectRenderer(SpriteRenderer_1.SpriteRenderer.renderer);
            SpriteRenderer_1.SpriteRenderer.renderer.render(this);
        }
        _renderCanvas(renderer) {
            SpriteRenderer_1.SpriteRenderer.renderer.render(this);
        }
        _calculateBounds() {
            const trim = this._texture.trim;
            const orig = this._texture.orig;
            if (!trim || (trim.width === orig.width && trim.height === orig.height)) {
                this.calculateVertices();
                this._bounds.addQuad(this.vertexData);
            }
            else {
                this.calculateTrimmedVertices();
                this._bounds.addQuad(this.vertexTrimmedData);
            }
        }
        getLocalBounds(rect) {
            if (this.children.length === 0) {
                this._bounds.minX = this._texture.orig.width * -this._anchor._x;
                this._bounds.minY = this._texture.orig.height * -this._anchor._y;
                this._bounds.maxX = this._texture.orig.width * (1 - this._anchor._x);
                this._bounds.maxY = this._texture.orig.height * (1 - this._anchor._y);
                if (!rect) {
                    if (!this._localBoundsRect) {
                        this._localBoundsRect = new Rectangle_1.Rectangle();
                    }
                    rect = this._localBoundsRect;
                }
                return this._bounds.getRectangle(rect);
            }
            return super.getLocalBounds.call(this, rect);
        }
        containsPoint(point) {
            this.worldTransform.applyInverse(point, Sprite.tempPoint);
            const width = this._texture.orig.width;
            const height = this._texture.orig.height;
            const x1 = -width * this.anchor.x;
            let y1 = 0;
            if (Sprite.tempPoint.x >= x1 && Sprite.tempPoint.x < x1 + width) {
                y1 = -height * this.anchor.y;
                if (Sprite.tempPoint.y >= y1 && Sprite.tempPoint.y < y1 + height) {
                    return true;
                }
            }
            return false;
        }
        destroy(options) {
            super.destroy(options);
            this._anchor = null;
            const destroyTexture = typeof options === 'boolean' ? options : options && options.texture;
            if (destroyTexture) {
                const destroyBaseTexture = typeof options === 'boolean' ? options : options && options.baseTexture;
                this._texture.destroy(!!destroyBaseTexture);
            }
            this._texture = null;
            this.shader = null;
        }
        static from(source, width = 0, height = 0) {
            return new Sprite(Texture_1.Texture.from(source));
        }
        static fromFrame(frameId, width = 0, height = 0) {
            const texture = BaseTexture_1.BaseTexture.TextureCache[frameId];
            if (!texture) {
                throw new Error(`The frameId "${frameId}" does not exist in the texture cache`);
            }
            return new Sprite(texture);
        }
        static fromImage(imageId, crossorigin, scaleMode = Settings_1.Settings.SCALE_MODE, width = 0, height = 0) {
            return new Sprite(Texture_1.Texture.fromImage(imageId, crossorigin, scaleMode));
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
                    value.once('update', this._onTextureUpdate, this);
                }
            }
        }
    }
    Sprite.tempPoint = new Point_1.Point();
    exports.Sprite = Sprite;
});
