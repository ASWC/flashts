define(["require", "exports", "flash/geom/Rectangle", "../../geom/Matrix", "../managers/Constants", "flash/display/BaseObject", "flash/display3D/GLFramebuffer", "flash/display/StageSettings"], function (require, exports, Rectangle_1, Matrix_1, Constants_1, BaseObject_1, GLFramebuffer_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RenderTarget extends BaseObject_1.BaseObject {
        constructor(gl, width, height, scaleMode, resolution, root = false) {
            super();
            this.gl = gl;
            this.frameBuffer = null;
            this.texture = null;
            this.clearColor = [0, 0, 0, 0];
            this.size = new Rectangle_1.Rectangle(0, 0, 1, 1);
            this.resolution = resolution || StageSettings_1.StageSettings.RESOLUTION;
            this.projectionMatrix = new Matrix_1.Matrix();
            this.transform = null;
            this.frame = null;
            this.defaultFrame = new Rectangle_1.Rectangle();
            this.destinationFrame = null;
            this.sourceFrame = null;
            this.stencilBuffer = null;
            this.stencilMaskStack = [];
            this.filterData = null;
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
                this.texture = this.frameBuffer.texture;
            }
            else {
                this.frameBuffer = new GLFramebuffer_1.GLFramebuffer(gl, 100, 100);
                this.frameBuffer.framebuffer = null;
            }
            this.setFrame();
            this.resize(width, height);
        }
        clear(clearColor = null) {
            const cc = clearColor || this.clearColor;
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
            const gl = this.gl;
            this.frameBuffer.bind();
            this.calculateProjection(this.destinationFrame, this.sourceFrame);
            if (this.transform) {
                this.projectionMatrix.append(this.transform);
            }
            if (this.destinationFrame !== this.sourceFrame) {
                gl.enable(gl.SCISSOR_TEST);
                gl.scissor(this.destinationFrame.x | 0, this.destinationFrame.y | 0, (this.destinationFrame.width * this.resolution) | 0, (this.destinationFrame.height * this.resolution) | 0);
            }
            else {
                gl.disable(gl.SCISSOR_TEST);
            }
            gl.viewport(this.destinationFrame.x | 0, this.destinationFrame.y | 0, (this.destinationFrame.width * this.resolution) | 0, (this.destinationFrame.height * this.resolution) | 0);
        }
        calculateProjection(destinationFrame, sourceFrame = null) {
            const pm = this.projectionMatrix;
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
            if (this.size.width === width && this.size.height === height) {
                return;
            }
            this.size.width = width;
            this.size.height = height;
            this.defaultFrame.width = width;
            this.defaultFrame.height = height;
            this.frameBuffer.resize(width * this.resolution, height * this.resolution);
            const projectionFrame = this.frame || this.size;
            this.calculateProjection(projectionFrame);
        }
        destroy() {
            this.frameBuffer.destroy();
            this.frameBuffer = null;
            this.texture = null;
        }
    }
    exports.RenderTarget = RenderTarget;
});
//# sourceMappingURL=RenderTarget.js.map