define(["require", "exports", "flash/display3D/renderers/ObjectRenderer", "../../geom/Matrix"], function (require, exports, ObjectRenderer_1, Matrix_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TilingSpriteRenderer extends ObjectRenderer_1.ObjectRenderer {
        constructor() {
            super();
            this.shader = null;
            this.simpleShader = null;
            this.quad = null;
        }
        /**
         * Sets up the renderer context and necessary buffers.
         *
         * @private
         */
        onContextChange() {
            /*const gl = this.renderer.gl;
    
            this.shader = new GLShader(gl, Shaders.VERTEX_TILE, Shaders.FRAGMENT_TILE);
    
    
            this.simpleShader = new GLShader(gl,Shaders.VERTEX_TILE, Shaders.FRAGMENT_TILE);
    
            this.renderer.bindVao(null);
            this.quad = new Quad(gl, this.renderer.state.attribState);
            this.quad.initVao(this.shader);*/
        }
        /**
         *
         * @param {PIXI.extras.TilingSprite} ts tilingSprite to be rendered
         */
        render(ts) {
            /* const renderer = this.renderer;
             const quad = this.quad;
     
             renderer.bindVao(quad.vao);
     
             let vertices = quad.vertices;
     
             vertices[0] = vertices[6] = (ts._width) * -ts.anchor.x;
             vertices[1] = vertices[3] = ts._height * -ts.anchor.y;
     
             vertices[2] = vertices[4] = (ts._width) * (1.0 - ts.anchor.x);
             vertices[5] = vertices[7] = ts._height * (1.0 - ts.anchor.y);
     
             if (ts.uvRespectAnchor)
             {
                 vertices = quad.uvs;
     
                 vertices[0] = vertices[6] = -ts.anchor.x;
                 vertices[1] = vertices[3] = -ts.anchor.y;
     
                 vertices[2] = vertices[4] = 1.0 - ts.anchor.x;
                 vertices[5] = vertices[7] = 1.0 - ts.anchor.y;
             }
     
             quad.upload();
     
             const tex = ts._texture;
             const baseTex = tex.baseTexture;
             const lt = ts.tileTransform.localTransform;
             const uv = ts.uvTransform;
             let isSimple = baseTex.isPowerOfTwo
                 && tex.frame.width === baseTex.width && tex.frame.height === baseTex.height;
     
             // auto, force repeat wrapMode for big tiling textures
             if (isSimple)
             {
                 if (!baseTex._glTextures[renderer.CONTEXT_UID])
                 {
                     if (baseTex.wrapMode === Constants.WRAP_MODES.CLAMP)
                     {
                         baseTex.wrapMode = Constants.WRAP_MODES.REPEAT;
                     }
                 }
                 else
                 {
                     isSimple = baseTex.wrapMode !== Constants.WRAP_MODES.CLAMP;
                 }
             }
     
             const shader = isSimple ? this.simpleShader : this.shader;
     
             renderer.bindShader(shader);
     
             const w = tex.width;
             const h = tex.height;
             const W = ts._width;
             const H = ts._height;
     
             TilingSpriteRenderer.tempMat.set(lt.a * w / W,
                 lt.b * w / H,
                 lt.c * h / W,
                 lt.d * h / H,
                 lt.tx / W,
                 lt.ty / H);
     
             // that part is the same as above:
             // tempMat.identity();
             // tempMat.scale(tex.width, tex.height);
             // tempMat.prepend(lt);
             // tempMat.scale(1.0 / ts._width, 1.0 / ts._height);
     
             TilingSpriteRenderer.tempMat.invert();
             if (isSimple)
             {
                 TilingSpriteRenderer.tempMat.prepend(uv.mapCoord);
             }
             else
             {
                 shader.uniforms.uMapCoord = uv.mapCoord.toArray(true);
                 shader.uniforms.uClampFrame = uv.uClampFrame;
                 shader.uniforms.uClampOffset = uv.uClampOffset;
             }
     
             shader.uniforms.uTransform = TilingSpriteRenderer.tempMat.toArray(true);
             shader.uniforms.uColor = Utils.premultiplyTintToRgba(ts.tint, ts.worldAlpha, shader.uniforms.uColor, baseTex.premultipliedAlpha);
             shader.uniforms.translationMatrix = ts.transform.worldTransform.toArray(true);
     
             shader.uniforms.uSampler = renderer.bindTexture(tex);
     
             renderer.setBlendMode(Utils.correctBlendMode(ts.blendMode, baseTex.premultipliedAlpha));
     
             quad.vao.draw(this.renderer.gl.TRIANGLES, 6, 0);*/
        }
    }
    //core.WebGLRenderer.registerPlugin('tilingSprite', TilingSpriteRenderer);
    /**
     * constructor for renderer
     *
     * @param {WebGLRenderer} renderer The renderer this tiling awesomeness works for.
     */
    TilingSpriteRenderer.tempMat = new Matrix_1.Matrix();
    exports.TilingSpriteRenderer = TilingSpriteRenderer;
});
//# sourceMappingURL=TilingSpriteRenderer.js.map