define(["require", "exports", "flash/display/DisplayObjectContainer", "../managers/Constants", "../webgl/Utils", "flash/display/Bitmap", "flash/display/DisplayObject", "flash/events/Event", "../webgl/ParticleRenderer"], function (require, exports, DisplayObjectContainer_1, Constants_1, Utils_1, Bitmap_1, DisplayObject_1, Event_1, ParticleRenderer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ParticleContainer extends DisplayObjectContainer_1.DisplayObjectContainer {
        constructor(maxSize = 1500, properties, batchSize = 16384, autoResize = false) {
            super();
            const maxBatchSize = 16384;
            if (batchSize > maxBatchSize) {
                batchSize = maxBatchSize;
            }
            if (batchSize > maxSize) {
                batchSize = maxSize;
            }
            this._properties = [false, true, false, false, false];
            this._maxSize = maxSize;
            this._batchSize = batchSize;
            /**
             * @member {object<number, WebGLBuffer>}
             * @private
             */
            this._glBuffers = {};
            this._bufferUpdateIDs = [];
            this._updateID = 0;
            this.interactiveChildren = false;
            this.blendMode = Constants_1.Constants.BLEND_MODES.NORMAL;
            this.autoResize = autoResize;
            this.roundPixels = true;
            this.baseTexture = null;
            this.setProperties(properties);
            this._tint = 0xFFFFFF;
            this.tintRgb = [];
        }
        setProperties(properties) {
            if (properties) {
                this._properties[0] = 'vertices' in properties || 'scale' in properties
                    ? !!properties.vertices || !!properties.scale : this._properties[0];
                this._properties[1] = 'position' in properties ? !!properties.position : this._properties[1];
                this._properties[2] = 'rotation' in properties ? !!properties.rotation : this._properties[2];
                this._properties[3] = 'uvs' in properties ? !!properties.uvs : this._properties[3];
                this._properties[4] = 'tint' in properties || 'alpha' in properties
                    ? !!properties.tint || !!properties.alpha : this._properties[4];
            }
        }
        updateTransform() {
            this.updateTransform();
        }
        get tint() {
            return this._tint;
        }
        set tint(value) {
            this._tint = value;
            Utils_1.Utils.hex2rgb(value, this.tintRgb);
        }
        renderWebGL() {
            if (!this.stage) {
                return;
            }
            if (!this.visible || this.worldAlpha <= 0 || !this.children.length || !this.renderable) {
                return;
            }
            if (!this.baseTexture) {
                var sprite = this.children[0];
                if (sprite instanceof Bitmap_1.Bitmap) {
                    this.baseTexture = sprite.texture.baseTexture;
                    if (!this.baseTexture.hasLoaded) {
                        this.baseTexture.addEventListener(Event_1.Event.CHANGE, this.onChildrenChange, this);
                    }
                }
            }
            ParticleRenderer_1.ParticleRenderer;
            this.stage.setObjectRenderer(ParticleRenderer_1.ParticleRenderer.renderer);
            if (this instanceof DisplayObject_1.DisplayObject) {
                ParticleRenderer_1.ParticleRenderer.renderer.render(this);
            }
        }
        onChildrenChange(smallestChildIndex) {
            const bufferIndex = Math.floor(smallestChildIndex / this._batchSize);
            while (this._bufferUpdateIDs.length < bufferIndex) {
                this._bufferUpdateIDs.push(0);
            }
            this._bufferUpdateIDs[bufferIndex] = ++this._updateID;
        }
        destroy() {
            super.destroy();
            if (this._buffers) {
                for (let i = 0; i < this._buffers.length; ++i) {
                    this._buffers[i].destroy();
                }
            }
            this._properties = null;
            this._buffers = null;
            this._bufferUpdateIDs = null;
        }
    }
    exports.ParticleContainer = ParticleContainer;
});
