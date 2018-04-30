define(["require", "exports", "flash/geom/Rectangle", "flash/geom/Matrix", "flash/rendering/managers/Constants", "flash/display/BaseObject", "flash/display3D/GLFramebuffer", "flash/display/StageSettings"], function (require, exports, Rectangle_1, Matrix_1, Constants_1, BaseObject_1, GLFramebuffer_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RenderTarget extends BaseObject_1.BaseObject {
        constructor(gl, width, height, scaleMode, resolution, root = false) {
            super();
            this.gl = gl;
            this.frameBuffer = null;
            this._texture = null;
            this._clearColor = [0, 0, 0, 0];
            this._size = new Rectangle_1.Rectangle(0, 0, 1, 1);
            this.resolution = resolution || StageSettings_1.StageSettings.RESOLUTION;
            this._projectionMatrix = new Matrix_1.Matrix();
            this.transform = null;
            this.frame = null;
            this.defaultFrame = new Rectangle_1.Rectangle();
            this.destinationFrame = null;
            this.sourceFrame = null;
            this.stencilBuffer = null;
            this._stencilMaskStack = [];
            this.scaleMode = scaleMode !== undefined ? scaleMode : StageSettings_1.StageSettings.SCALE_MODE;
            this.root = root;
            if (!this.root) {
                this.frameBuffer = GLFramebuffer_1.GLFramebuffer.createRGBA(gl, 100, 100);
                if (this.scaleMode === Constants_1.Constants.SCALE_MODES.NEAREST) {
                    this.frameBuffer.texture.enableNearestScaling();
                }
                else {
                    this.frameBuffer.texture.enableLinearScaling();
                }
                this._texture = this.frameBuffer.texture;
            }
            else {
                this.frameBuffer = new GLFramebuffer_1.GLFramebuffer(gl, 100, 100);
                this.frameBuffer.framebuffer = null;
            }
            this.setFrame();
            this.resize(width, height);
        }
        get size() {
            return this._size;
        }
        get stencilMaskStack() {
            return this._stencilMaskStack;
        }
        get texture() {
            return this._texture;
        }
        get projectionMatrix() {
            return this._projectionMatrix;
        }
        set clearColor(value) {
            this._clearColor = value;
        }
        get clearColor() {
            return this._clearColor;
        }
        clear(clearColor = null) {
            const cc = clearColor || this._clearColor;
            this.frameBuffer.clear(cc[0], cc[1], cc[2], cc[3]);
        }
        attachStencilBuffer() {
            if (!this.root) {
                this.frameBuffer.enableStencil();
            }
        }
        setFrame(destinationFrame = null, sourceFrame = null) {
            this.destinationFrame = destinationFrame || this.destinationFrame || this.defaultFrame;
            this.sourceFrame = sourceFrame || this.sourceFrame || this.destinationFrame;
        }
        activate() {
            this.frameBuffer.bind();
            this.calculateProjection(this.destinationFrame, this.sourceFrame);
            if (this.transform) {
                this._projectionMatrix.append(this.transform);
            }
            if (this.destinationFrame !== this.sourceFrame) {
                this.gl.enable(this.gl.SCISSOR_TEST);
                this.gl.scissor(this.destinationFrame.x | 0, this.destinationFrame.y | 0, (this.destinationFrame.width * this.resolution) | 0, (this.destinationFrame.height * this.resolution) | 0);
            }
            else {
                this.gl.disable(this.gl.SCISSOR_TEST);
            }
            this.gl.viewport(this.destinationFrame.x | 0, this.destinationFrame.y | 0, (this.destinationFrame.width * this.resolution) | 0, (this.destinationFrame.height * this.resolution) | 0);
        }
        calculateProjection(destinationFrame, sourceFrame = null) {
            const pm = this._projectionMatrix;
            sourceFrame = sourceFrame || destinationFrame;
            pm.identity();
            if (!this.root) {
                pm.a = 1 / destinationFrame.width * 2;
                pm.d = 1 / destinationFrame.height * 2;
                pm.tx = -1 - (sourceFrame.x * pm.a);
                pm.ty = -1 - (sourceFrame.y * pm.d);
            }
            else {
                pm.a = 1 / destinationFrame.width * 2;
                pm.d = -1 / destinationFrame.height * 2;
                pm.tx = -1 - (sourceFrame.x * pm.a);
                pm.ty = 1 - (sourceFrame.y * pm.d);
            }
        }
        resize(width, height) {
            width = width | 0;
            height = height | 0;
            if (this._size.width === width && this._size.height === height) {
                return;
            }
            this._size.width = width;
            this._size.height = height;
            this.defaultFrame.width = width;
            this.defaultFrame.height = height;
            this.frameBuffer.resize(width * this.resolution, height * this.resolution);
            const projectionFrame = this.frame || this._size;
            this.calculateProjection(projectionFrame);
        }
        destroy() {
            this.frameBuffer.destroy();
            this.frameBuffer = null;
            this._texture = null;
        }
    }
    exports.RenderTarget = RenderTarget;
});
//# sourceMappingURL=RenderTarget.js.map