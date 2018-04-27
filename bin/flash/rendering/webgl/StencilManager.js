define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class StencilManager // extends WebGLManager
     {
        constructor() {
            //super();
            // this.stencilMaskStack = null;
        }
        setMaskStack(stencilMaskStack) {
            /* this.stencilMaskStack = stencilMaskStack;
             if (stencilMaskStack.length === 0)
             {
                 this.renderer.gl.disable(this.renderer.gl.STENCIL_TEST);
             }
             else
             {
                 this.renderer.gl.enable(this.renderer.gl.STENCIL_TEST);
             }*/
        }
        pushStencil(graphics) {
            /*this.renderer.setObjectRenderer(GraphicsRenderer.renderer);
            this.renderer._activeRenderTarget.attachStencilBuffer();
            const prevMaskCount = this.stencilMaskStack.length;
            if (prevMaskCount === 0)
            {
                this.renderer.gl.enable(this.renderer.gl.STENCIL_TEST);
            }
            this.stencilMaskStack.push(graphics);
            this.renderer.gl.colorMask(false, false, false, false);
            this.renderer.gl.stencilFunc(this.renderer.gl.EQUAL, prevMaskCount, this._getBitwiseMask());
            this.renderer.gl.stencilOp(this.renderer.gl.KEEP, this.renderer.gl.KEEP, this.renderer.gl.INCR);
            //GraphicsRenderer.renderer.render(graphics);
            this._useCurrent();*/
        }
        popStencil() {
            /* this.renderer.setObjectRenderer(GraphicsRenderer.renderer);
             const graphics = this.stencilMaskStack.pop();
             if (this.stencilMaskStack.length === 0)
             {
                 this.renderer.gl.disable(this.renderer.gl.STENCIL_TEST);
                 this.renderer.gl.clear(this.renderer.gl.STENCIL_BUFFER_BIT);
                 this.renderer.gl.clearStencil(0);
             }
             else
             {
                 this.renderer.gl.colorMask(false, false, false, false);
                 this.renderer.gl.stencilOp(this.renderer.gl.KEEP, this.renderer.gl.KEEP, this.renderer.gl.DECR);
                 //GraphicsRenderer.renderer.render(graphics);
                 this._useCurrent();
             }*/
        }
        _useCurrent() {
            /*this.renderer.gl.colorMask(true, true, true, true);
            this.renderer.gl.stencilFunc(this.renderer.gl.EQUAL, this.stencilMaskStack.length, this._getBitwiseMask());
            this.renderer.gl.stencilOp(this.renderer.gl.KEEP, this.renderer.gl.KEEP, this.renderer.gl.KEEP);*/
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