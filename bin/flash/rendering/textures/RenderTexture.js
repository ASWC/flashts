define(["require", "exports", "./Texture", "./BaseRenderTexture", "flash/rendering/core/StageSettings"], function (require, exports, Texture_1, BaseRenderTexture_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RenderTexture extends Texture_1.Texture {
        constructor(baseRenderTexture, frame = null) {
            super(baseRenderTexture, frame);
            let _legacyRenderer = null;
            if (!(baseRenderTexture instanceof BaseRenderTexture_1.BaseRenderTexture)) {
                const width = arguments[1];
                const height = arguments[2];
                const scaleMode = arguments[3];
                const resolution = arguments[4];
                console.warn(`Please use RenderTexture.create(${width}, ${height}) instead of the ctor directly.`);
                _legacyRenderer = arguments[0];
                frame = null;
                baseRenderTexture = new BaseRenderTexture_1.BaseRenderTexture(width, height, scaleMode, resolution);
            }
            this.legacyRenderer = _legacyRenderer;
            this.valid = true;
            this._updateUvs();
        }
        resize(width, height, doNotResizeBaseTexture) {
            width = Math.ceil(width);
            height = Math.ceil(height);
            this.valid = (width > 0 && height > 0);
            this._frame.width = this.orig.width = width;
            this._frame.height = this.orig.height = height;
            if (!doNotResizeBaseTexture) {
                this.baseTexture.resize(width, height);
            }
            this._updateUvs();
        }
        static create(width, height, scaleMode = StageSettings_1.StageSettings.SCALE_MODE, resolution = StageSettings_1.StageSettings.RESOLUTION) {
            return new RenderTexture(new BaseRenderTexture_1.BaseRenderTexture(width, height, scaleMode, resolution));
        }
    }
    exports.RenderTexture = RenderTexture;
});
