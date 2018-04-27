define(["require", "exports", "flash/rendering/managers/Constants", "flash/display/Bitmap", "../../display/DisplayObjectContainer", "flash/rendering/core/StageSettings"], function (require, exports, Constants_1, Bitmap_1, DisplayObjectContainer_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextureGarbageCollector {
        constructor(renderer) {
            this._stage = renderer;
            this.count = 0;
            this.checkCount = 0;
            this.maxIdle = StageSettings_1.StageSettings.GC_MAX_IDLE;
            this.checkCountMax = StageSettings_1.StageSettings.GC_MAX_CHECK_COUNT;
            this.mode = StageSettings_1.StageSettings.GC_MODE;
        }
        update() {
            this.count++;
            if (this.mode === Constants_1.Constants.GC_MODES.MANUAL) {
                return;
            }
            this.checkCount++;
            if (this.checkCount > this.checkCountMax) {
                this.checkCount = 0;
                this.run();
            }
        }
        run() {
            const tm = this._stage.getTextureManager();
            if (!tm) {
                return;
            }
            const managedTextures = tm._managedTextures;
            if (!managedTextures) {
                return;
            }
            let wasRemoved = false;
            for (let i = 0; i < managedTextures.length; i++) {
                const texture = managedTextures[i];
                if (!texture._glRenderTargets && this.count - texture.touched > this.maxIdle) {
                    tm.destroyTexture(texture, true);
                    managedTextures[i] = null;
                    wasRemoved = true;
                }
            }
            if (wasRemoved) {
                let j = 0;
                for (let i = 0; i < managedTextures.length; i++) {
                    if (managedTextures[i] !== null) {
                        managedTextures[j++] = managedTextures[i];
                    }
                }
                managedTextures.length = j;
            }
        }
        unload(displayObject) {
            const tm = this._stage.getTextureManager();
            if (displayObject instanceof Bitmap_1.Bitmap) {
                if (displayObject.texture && displayObject.texture['_glRenderTargets']) {
                    tm.destroyTexture(displayObject.texture, true);
                }
            }
            if (displayObject instanceof DisplayObjectContainer_1.DisplayObjectContainer) {
                for (let i = displayObject.numChildren - 1; i >= 0; i--) {
                    this.unload(displayObject.removeChildAt[i]);
                }
            }
        }
    }
    exports.TextureGarbageCollector = TextureGarbageCollector;
});
