define(["require", "exports", "flash/rendering/webgl/Utils"], function (require, exports, Utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class StageSettings {
        static get CAN_UPLOAD_SAME_BUFFER() {
            var value = Utils_1.Utils.canUploadSameBuffer();
            return value;
        }
        static get SPRITE_MAX_TEXTURES() {
            var maxtext = Utils_1.Utils.maxRecommendedTextures(32);
            return maxtext;
        }
        static get FPMS() {
            return StageSettings.FPS / 1000;
        }
    }
    StageSettings.FPS = 60;
    StageSettings.MIPMAP_TEXTURES = false;
    StageSettings.RESOLUTION = 1;
    StageSettings.FILTER_RESOLUTION = 1;
    StageSettings.SPRITE_BATCH_SIZE = 4096;
    StageSettings.TRANSFORM_MODE = 0;
    StageSettings.GC_MODE = 0;
    StageSettings.GC_MAX_IDLE = 60 * 60;
    StageSettings.GC_MAX_CHECK_COUNT = 60 * 10;
    StageSettings.WRAP_MODE = 0;
    StageSettings.SCALE_MODE = 0;
    StageSettings.PRECISION_VERTEX = 'highp';
    StageSettings.PRECISION_FRAGMENT = 'mediump';
    StageSettings.MESH_CANVAS_PADDING = 0;
    exports.StageSettings = StageSettings;
});
