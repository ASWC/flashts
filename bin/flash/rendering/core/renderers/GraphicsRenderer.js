define(["require", "exports", "flash/rendering/core/renderers/ObjectRenderer", "flash/rendering/webgl/PrimitiveShader", "flash/rendering/webgl/Utils", "flash/rendering/managers/Constants", "flash/rendering/core/gl/WebGLGraphicsData", "flash/rendering/core/shapes/ShapeUtils", "flash/rendering/core/shapes/WebGLData"], function (require, exports, ObjectRenderer_1, PrimitiveShader_1, Utils_1, Constants_1, WebGLGraphicsData_1, ShapeUtils_1, WebGLData_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GraphicsRenderer extends ObjectRenderer_1.ObjectRenderer {
        constructor() {
            super();
            this.graphicsDataPool = [];
            this.primitiveShader = null;
            this.CONTEXT_UID = 0;
        }
        static get renderer() {
            if (!GraphicsRenderer._graphicsRenderer) {
                GraphicsRenderer._graphicsRenderer = new GraphicsRenderer();
            }
            return GraphicsRenderer._graphicsRenderer;
        }
        destroy() {
            for (let i = 0; i < this.graphicsDataPool.length; ++i) {
                this.graphicsDataPool[i].destroy();
            }
            this.graphicsDataPool = null;
        }
        render(graphics) {
            if (!graphics.stage) {
                return;
            }
            if (!graphics.stage.context) {
                return;
            }
            if (!this.primitiveShader) {
                this.CONTEXT_UID = graphics.stage.getContextID();
                this.primitiveShader = new PrimitiveShader_1.PrimitiveShader(graphics.stage.context);
            }
            let webGLData;
            let webGL = graphics._webGL[this.CONTEXT_UID];
            if (!webGL || graphics.dirty !== webGL.dirty) {
                this.updateGraphics(graphics);
                webGL = graphics._webGL[this.CONTEXT_UID];
            }
            const shader = this.primitiveShader;
            graphics.stage.bindShader(shader, true);
            graphics.stage.getRenderState().setBlendMode(graphics.blendMode);
            for (let i = 0, n = webGL.data.length; i < n; i++) {
                webGLData = webGL.data[i];
                const shaderTemp = webGLData.shader;
                graphics.stage.bindShader(shaderTemp, true);
                shaderTemp.uniforms.translationMatrix = graphics.transform.worldTransform.toArray(true);
                shaderTemp.uniforms.tint = Utils_1.Utils.hex2rgb(graphics.tint);
                shaderTemp.uniforms.alpha = graphics.worldAlpha;
                graphics.stage.bindVao(webGLData.vao);
                if (webGLData.nativeLines) {
                    graphics.stage.context.drawArrays(graphics.stage.context.LINES, 0, webGLData.points.length / 6);
                }
                else {
                    webGLData.vao.draw(graphics.stage.context.TRIANGLE_STRIP, webGLData.indices.length);
                }
            }
        }
        updateGraphics(graphics) {
            if (!graphics.stage) {
                return;
            }
            if (!graphics.stage.context) {
                return;
            }
            let webGL = graphics._webGL[this.CONTEXT_UID];
            if (!webGL) {
                webGL = graphics._webGL[this.CONTEXT_UID] = new WebGLData_1.WebGLData(graphics.stage.context);
            }
            webGL.dirty = graphics.dirty;
            if (graphics.clearDirty !== webGL.clearDirty) {
                webGL.clearDirty = graphics.clearDirty;
                for (let i = 0; i < webGL.data.length; i++) {
                    this.graphicsDataPool.push(webGL.data[i]);
                }
                webGL.data.length = 0;
                webGL.lastIndex = 0;
            }
            let webGLData;
            let webGLDataNativeLines;
            for (let i = webGL.lastIndex; i < graphics.graphicsData.length; i++) {
                const data = graphics.graphicsData[i];
                const webglobjects = this.getWebGLData(webGL, 0, false, graphics);
                if (data.nativeLines && data.lineWidth) {
                    webGLDataNativeLines = this.getWebGLData(webGL, 0, true, graphics);
                    webGL.lastIndex++;
                }
                if (data.type === Constants_1.Constants.SHAPES.POLY) {
                    ShapeUtils_1.ShapeUtils.buildPoly(webglobjects, data, webGLDataNativeLines);
                }
                else if (data.type === Constants_1.Constants.SHAPES.CIRC || data.type === Constants_1.Constants.SHAPES.ELIP) {
                    ShapeUtils_1.ShapeUtils.buildCircle(webglobjects, data, webGLDataNativeLines);
                }
                if (data.type === Constants_1.Constants.SHAPES.RECT) {
                    ShapeUtils_1.ShapeUtils.buildRectangle(webglobjects, data, webGLDataNativeLines);
                }
                else if (data.type === Constants_1.Constants.SHAPES.RREC) {
                    ShapeUtils_1.ShapeUtils.buildRoundedRectangle(webglobjects, data, webGLDataNativeLines);
                }
                webGL.lastIndex++;
            }
            graphics.stage.bindVao(null);
            for (let i = 0; i < webGL.data.length; i++) {
                webGLData = webGL.data[i];
                if (webGLData.dirty) {
                    webGLData.upload();
                }
            }
        }
        getWebGLData(gl, type, nativeLines, graphics) {
            let gldata = gl;
            let webGLData = gldata.data[gldata.data.length - 1];
            if (!webGLData || webGLData.nativeLines !== nativeLines || webGLData.points.length > 320000) {
                webGLData = this.graphicsDataPool.pop() || new WebGLGraphicsData_1.WebGLGraphicsData(graphics.stage.context, this.primitiveShader, graphics.stage.getRenderState().attribState);
                webGLData.nativeLines = nativeLines;
                webGLData.reset(type);
                gldata.data.push(webGLData);
            }
            webGLData.dirty = true;
            return webGLData;
        }
    }
    exports.GraphicsRenderer = GraphicsRenderer;
});
