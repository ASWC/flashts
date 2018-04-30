define(["require", "exports", "flash/display/BaseObject", "flash/display3D/renderers/GraphicsRenderer"], function (require, exports, BaseObject_1, GraphicsRenderer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class StencilManager extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this.stencilMaskStack = null;
        }
        set stage(value) {
            this._stage = value;
        }
        setMaskStack(stencilMaskStack) {
            if (!this._stage) {
                return;
            }
            this.stencilMaskStack = stencilMaskStack;
            if (stencilMaskStack.length === 0) {
                this._stage.context.disable(this._stage.context.STENCIL_TEST);
            }
            else {
                this._stage.context.enable(this._stage.context.STENCIL_TEST);
            }
        }
        pushStencil(graphics) {
            if (!this._stage) {
                return;
            }
            this._stage.setObjectRenderer(GraphicsRenderer_1.GraphicsRenderer.renderer);
            this._stage.activeRenderTarget.attachStencilBuffer();
            const prevMaskCount = this.stencilMaskStack.length;
            if (prevMaskCount === 0) {
                this._stage.context.enable(this._stage.context.STENCIL_TEST);
            }
            this.stencilMaskStack.push(graphics);
            this._stage.context.colorMask(false, false, false, false);
            this._stage.context.stencilFunc(this._stage.context.EQUAL, prevMaskCount, this._getBitwiseMask());
            this._stage.context.stencilOp(this._stage.context.KEEP, this._stage.context.KEEP, this._stage.context.INCR);
            GraphicsRenderer_1.GraphicsRenderer.renderer.render(graphics);
            this._useCurrent();
        }
        popStencil() {
            if (!this._stage) {
                return;
            }
            this._stage.setObjectRenderer(GraphicsRenderer_1.GraphicsRenderer.renderer);
            const graphics = this.stencilMaskStack.pop();
            if (this.stencilMaskStack.length === 0) {
                this._stage.context.disable(this._stage.context.STENCIL_TEST);
                this._stage.context.clear(this._stage.context.STENCIL_BUFFER_BIT);
                this._stage.context.clearStencil(0);
            }
            else {
                this._stage.context.colorMask(false, false, false, false);
                this._stage.context.stencilOp(this._stage.context.KEEP, this._stage.context.KEEP, this._stage.context.DECR);
                GraphicsRenderer_1.GraphicsRenderer.renderer.render(graphics);
                this._useCurrent();
            }
        }
        _useCurrent() {
            if (!this._stage) {
                return;
            }
            this._stage.context.colorMask(true, true, true, true);
            this._stage.context.stencilFunc(this._stage.context.EQUAL, this.stencilMaskStack.length, this._getBitwiseMask());
            this._stage.context.stencilOp(this._stage.context.KEEP, this._stage.context.KEEP, this._stage.context.KEEP);
        }
        _getBitwiseMask() {
            return (1 << this.stencilMaskStack.length) - 1;
        }
        destroy() {
            this.stencilMaskStack = null;
        }
    }
    exports.StencilManager = StencilManager;
});
//# sourceMappingURL=StencilManager.js.map