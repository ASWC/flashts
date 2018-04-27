define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BlendModeManager // extends WebGLRenderer
     {
        constructor(renderer) {
            //super(renderer);
            this.renderer = renderer;
            /**
             * @member {number}
             */
            this.currentBlendMode = 99999;
        }
        /**
         * Sets-up the given blendMode from WebGL's point of view.
         *
         * @param {number} blendMode - the blendMode, should be a PixiJS const, such as
         *  `PIXI.BLEND_MODES.ADD`. See {@link PIXI.BLEND_MODES} for possible values.
         * @return {boolean} Returns if the blend mode was changed.
         */
        setBlendMode(blendMode) {
            if (this.currentBlendMode === blendMode) {
                return false;
            }
            this.currentBlendMode = blendMode;
            const mode = this.renderer.blendModes[this.currentBlendMode];
            this.renderer.gl.blendFunc(mode[0], mode[1]);
            return true;
        }
    }
    exports.BlendModeManager = BlendModeManager;
});
//# sourceMappingURL=BlendModeManager.js.map