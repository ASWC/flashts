define(["require", "exports", "flash/display3D/textures/BaseTexture", "flash/display/StageSettings"], function (require, exports, BaseTexture_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseRenderTexture extends BaseTexture_1.BaseTexture {
        constructor(width = 100, height = 100, scaleMode = StageSettings_1.StageSettings.SCALE_MODE, resolution = StageSettings_1.StageSettings.RESOLUTION) {
            super(null, scaleMode);
            this.resolution = resolution || StageSettings_1.StageSettings.RESOLUTION;
            this.width = Math.ceil(width);
            this.height = Math.ceil(height);
            this.realWidth = this.width * this.resolution;
            this.realHeight = this.height * this.resolution;
            this.scaleMode = scaleMode !== undefined ? scaleMode : StageSettings_1.StageSettings.SCALE_MODE;
            this.hasLoaded = true;
            this._glRenderTargets = {};
            this.valid = false;
        }
        destroy() {
            super.destroy();
        }
    }
    exports.BaseRenderTexture = BaseRenderTexture;
});
//# sourceMappingURL=BaseRenderTexture.js.map