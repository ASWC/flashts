define(["require", "exports", "flash/rendering/core/renderers/ObjectRenderer", "./PrimitiveShader", "./Utils", "../managers/Constants", "./WebGLGraphicsData", "../shapes/ShapeUtils"], function (require, exports, ObjectRenderer_1, PrimitiveShader_1, Utils_1, Constants_1, WebGLGraphicsData_1, ShapeUtils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GraphicsRenderer extends ObjectRenderer_1.ObjectRenderer {
        constructor(renderer = null) {
            super(null);
            this.graphicsDataPool = [];
            this.primitiveShader = null;
            if (renderer) {
                this.gl = renderer.gl;
            }
            this.CONTEXT_UID = 0;
        }
        setContext(context) {
            this._context = context;
        }
        static get renderer() {
            if (!GraphicsRenderer._graphicsRenderer) {
                GraphicsRenderer._graphicsRenderer = new GraphicsRenderer();
            }
            return GraphicsRenderer._graphicsRenderer;
        }
        onContextChange() {
            if (this._context) {
                this.gl = this.renderer.gl;
                this.CONTEXT_UID = this.renderer.CONTEXT_UID;
                this.primitiveShader = new PrimitiveShader_1.PrimitiveShader(this.gl);
            }
        }
        destroy() {
            for (let i = 0; i < this.graphicsDataPool.length; ++i) {
                this.graphicsDataPool[i].destroy();
            }
            this.graphicsDataPool = null;
        }
        render(graphics) {
            if (!this._context || !this._context.gl) {
                return;
            }
            if (!this.primitiveShader) {
                this.gl = this._context.gl;
                this.CONTEXT_UID = this._context.CONTEXT_UID;
                this.primitiveShader = new PrimitiveShader_1.PrimitiveShader(this.gl);
            }
            let webGLData;
            let webGL = graphics._webGL[this.CONTEXT_UID];
            if (!webGL || graphics.dirty !== webGL.dirty) {
                this.updateGraphics(graphics);
                webGL = graphics._webGL[this.CONTEXT_UID];
            }
            const shader = this.primitiveShader;
            this._context.bindShader(shader);
            this._context.state.setBlendMode(graphics.blendMode);
            for (let i = 0, n = webGL.data.length; i < n; i++) {
                webGLData = webGL.data[i];
                const shaderTemp = webGLData.shader;
                this._context.bindShader(shaderTemp);
                shaderTemp.uniforms.translationMatrix = graphics.transform.worldTransform.toArray(true);
                shaderTemp.uniforms.tint = Utils_1.Utils.hex2rgb(graphics.tint);
                shaderTemp.uniforms.alpha = graphics.worldAlpha;
                this._context.bindVao(webGLData.vao);
                if (webGLData.nativeLines) {
                    this._context.gl.drawArrays(this._context.gl.LINES, 0, webGLData.points.length / 6);
                }
                else {
                    webGLData.vao.draw(this._context.gl.TRIANGLE_STRIP, webGLData.indices.length);
                }
            }
        }
        updateGraphics(graphics) {
            if (!this._context || !this._context.gl) {
                return;
            }
            let webGL = graphics._webGL[this.CONTEXT_UID];
            let gl = this._context.gl;
            if (!webGL) {
                webGL = graphics._webGL[this.CONTEXT_UID] = { lastIndex: 0, data: [], gl, clearDirty: -1, dirty: -1 };
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
                webGLData = this.getWebGLData(webGL, 0);
                if (data.nativeLines && data.lineWidth) {
                    webGLDataNativeLines = this.getWebGLData(webGL, 0, true);
                    webGL.lastIndex++;
                }
                if (data.type === Constants_1.Constants.SHAPES.POLY) {
                    ShapeUtils_1.ShapeUtils.buildPoly(data, webGLData, webGLDataNativeLines);
                }
                if (data.type === Constants_1.Constants.SHAPES.RECT) {
                    ShapeUtils_1.ShapeUtils.buildRectangle(data, webGLData, webGLDataNativeLines);
                }
                else if (data.type === Constants_1.Constants.SHAPES.CIRC || data.type === Constants_1.Constants.SHAPES.ELIP) {
                    ShapeUtils_1.ShapeUtils.buildCircle(data, webGLData, webGLDataNativeLines);
                }
                else if (data.type === Constants_1.Constants.SHAPES.RREC) {
                    ShapeUtils_1.ShapeUtils.buildRoundedRectangle(data, webGLData, webGLDataNativeLines);
                }
                webGL.lastIndex++;
            }
            this._context.bindVao(null);
            for (let i = 0; i < webGL.data.length; i++) {
                webGLData = webGL.data[i];
                if (webGLData.dirty) {
                    webGLData.upload();
                }
            }
        }
        getWebGLData(gl, type, nativeLines = false) {
            if (!this._context || !this._context.gl) {
                return;
            }
            let gldata = gl;
            let webGLData = gldata.data[gldata.data.length - 1];
            if (!webGLData || webGLData.nativeLines !== nativeLines || webGLData.points.length > 320000) {
                webGLData = this.graphicsDataPool.pop() || new WebGLGraphicsData_1.WebGLGraphicsData(this._context.gl, this.primitiveShader, this._context.state.attribsState);
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
