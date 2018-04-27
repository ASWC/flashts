define(["require", "exports", "flash/display3D/renderers/ObjectRenderer", "flash/rendering/core/gl/GLBuffer", "flash/rendering/core/gl/VertexArrayObject", "./Utils", "../../geom/Matrix", "../display/Mesh"], function (require, exports, ObjectRenderer_1, GLBuffer_1, VertexArrayObject_1, Utils_1, Matrix_1, Mesh_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class MeshRenderer extends ObjectRenderer_1.ObjectRenderer {
        constructor() {
            super();
            // core.WebGLRenderer.registerPlugin('mesh', MeshRenderer);
            this.shader = null;
        }
        /**
         * Sets up the renderer context and necessary buffers.
         *
         * @private
         */
        onContextChange() {
            /*const gl = this.renderer.gl;
    
            
            
    
    
            this.shader = new GLShader(gl,Shaders.VERTEX_MESH, Shaders.FRAGMENT_MESH);*/
        }
        /**
         * renders mesh
         *
         * @param {PIXI.mesh.Mesh} mesh mesh instance
         */
        render(mesh) {
            const renderer = null; //this.renderer;
            const gl = renderer.gl;
            const texture = mesh._texture;
            if (!texture.valid) {
                return;
            }
            let glData = mesh._glDatas[renderer.CONTEXT_UID];
            if (!glData) {
                renderer.bindVao(null);
                glData = {
                    shader: this.shader,
                    vertexBuffer: GLBuffer_1.GLBuffer.createVertexBuffer(gl, mesh.vertices, gl.STREAM_DRAW),
                    uvBuffer: GLBuffer_1.GLBuffer.createVertexBuffer(gl, mesh.uvs, gl.STREAM_DRAW),
                    indexBuffer: GLBuffer_1.GLBuffer.createIndexBuffer(gl, mesh.indices, gl.STATIC_DRAW),
                    // build the vao object that will render..
                    vao: null,
                    dirty: mesh.dirty,
                    indexDirty: mesh.indexDirty,
                };
                // build the vao object that will render..
                glData.vao = new VertexArrayObject_1.VertexArrayObject(gl)
                    .addIndex(glData.indexBuffer)
                    .addAttribute(glData.vertexBuffer, glData.shader.attributes.aVertexPosition, gl.FLOAT, false, 2 * 4, 0)
                    .addAttribute(glData.uvBuffer, glData.shader.attributes.aTextureCoord, gl.FLOAT, false, 2 * 4, 0);
                mesh._glDatas[renderer.CONTEXT_UID] = glData;
            }
            renderer.bindVao(glData.vao);
            if (mesh.dirty !== glData.dirty) {
                glData.dirty = mesh.dirty;
                glData.uvBuffer.upload(mesh.uvs);
            }
            if (mesh.indexDirty !== glData.indexDirty) {
                glData.indexDirty = mesh.indexDirty;
                glData.indexBuffer.upload(mesh.indices);
            }
            glData.vertexBuffer.upload(mesh.vertices);
            renderer.bindShader(glData.shader);
            glData.shader.uniforms.uSampler = renderer.bindTexture(texture);
            renderer.state.setBlendMode(Utils_1.Utils.correctBlendMode(mesh.blendMode, texture.baseTexture.premultipliedAlpha));
            if (glData.shader.uniforms.uTransform) {
                if (mesh.uploadUvTransform) {
                    glData.shader.uniforms.uTransform = mesh._uvTransform.mapCoord.toArray(true);
                }
                else {
                    glData.shader.uniforms.uTransform = MeshRenderer.matrixIdentity.toArray(true);
                }
            }
            glData.shader.uniforms.translationMatrix = mesh.worldTransform.toArray(true);
            glData.shader.uniforms.uColor = Utils_1.Utils.premultiplyRgba(mesh.tintRgb, mesh.worldAlpha, glData.shader.uniforms.uColor, texture.baseTexture.premultipliedAlpha);
            const drawMode = mesh.drawMode === Mesh_1.Mesh.DRAW_MODES.TRIANGLE_MESH ? gl.TRIANGLE_STRIP : gl.TRIANGLES;
            glData.vao.draw(drawMode, mesh.indices.length, 0);
        }
    }
    /**
     * constructor for renderer
     *
     * @param {WebGLRenderer} renderer The renderer this tiling awesomeness works for.
     */
    MeshRenderer.matrixIdentity = Matrix_1.Matrix.IDENTITY;
    exports.MeshRenderer = MeshRenderer;
});
//# sourceMappingURL=MeshRenderer.js.map