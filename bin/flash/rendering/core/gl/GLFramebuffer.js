define(["require", "exports", "flash/rendering/core/gl/GLTexture", "flash/rendering/core/BaseObject"], function (require, exports, GLTexture_1, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GLFramebuffer extends BaseObject_1.BaseObject {
        constructor(gl, width = 100, height = 100) {
            super();
            this.gl = gl;
            this.framebuffer = gl.createFramebuffer();
            this.stencil = null;
            this.texture = null;
            this.width = width;
            this.height = height;
        }
        ;
        enableTexture(texture) {
            this.texture = texture || new GLTexture_1.GLTexture(this.gl);
            this.texture.bind();
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.width, this.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
            this.bind();
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texture.texture, 0);
        }
        ;
        enableStencil() {
            if (this.stencil)
                return;
            this.stencil = this.gl.createRenderbuffer();
            this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.stencil);
            this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_STENCIL_ATTACHMENT, this.gl.RENDERBUFFER, this.stencil);
            this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_STENCIL, this.width, this.height);
        }
        ;
        clear(r, g, b, a) {
            this.bind();
            this.gl.clearColor(r, g, b, a);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        }
        ;
        bind() {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        }
        ;
        unbind() {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        }
        ;
        resize(width, height) {
            this.width = width;
            this.height = height;
            if (this.texture) {
                this.texture.uploadData(null, width, height);
            }
            if (this.stencil) {
                this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.stencil);
                this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_STENCIL, width, height);
            }
        }
        ;
        destroy() {
            if (this.texture) {
                this.texture.destroy();
            }
            this.gl.deleteFramebuffer(this.framebuffer);
            this.gl = null;
            this.stencil = null;
            this.texture = null;
        }
        ;
        static createRGBA(gl, width, height, data = null) {
            var texture = GLTexture_1.GLTexture.fromData(gl, null, width, height);
            texture.enableNearestScaling();
            texture.enableWrapClamp();
            var fbo = new GLFramebuffer(gl, width, height);
            fbo.enableTexture(texture);
            fbo.unbind();
            return fbo;
        }
        ;
        static createFloat32(gl, width, height, data) {
            var texture = GLTexture_1.GLTexture.fromData(gl, data, width, height);
            texture.enableNearestScaling();
            texture.enableWrapClamp();
            var fbo = new GLFramebuffer(gl, width, height);
            fbo.enableTexture(texture);
            fbo.unbind();
            return fbo;
        }
        ;
    }
    exports.GLFramebuffer = GLFramebuffer;
});
