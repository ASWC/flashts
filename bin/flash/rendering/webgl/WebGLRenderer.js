define(["require", "exports", "./SystemRenderer", "flash/rendering/core/gldata/VertexArrayObject", "../managers/Constants", "flash/rendering/core/renderers/ObjectRenderer", "./Utils", "./WebGLState", "../textures/BaseTexture", "./GLTexture", "./RenderTarget", "../textures/TextureManager", "./MaskManager", "./StencilManager", "./FilterManager", "../textures/Texture", "flash/events/Event"], function (require, exports, SystemRenderer_1, VertexArrayObject_1, Constants_1, ObjectRenderer_1, Utils_1, WebGLState_1, BaseTexture_1, GLTexture_1, RenderTarget_1, TextureManager_1, MaskManager_1, StencilManager_1, FilterManager_1, Texture_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class WebGLRenderer extends SystemRenderer_1.SystemRenderer {
        constructor(options) {
            super('WebGL', options);
            this.legacy = this.options.legacy;
            if (this.legacy) {
                VertexArrayObject_1.VertexArrayObject.FORCE_NATIVE = true;
            }
            this.type = Constants_1.Constants.RENDERER_TYPE.WEBGL;
            this.handleContextLost = this.handleContextLost.bind(this);
            this.handleContextRestored = this.handleContextRestored.bind(this);
            this.view.addEventListener('webglcontextlost', this.handleContextLost, false);
            this.view.addEventListener('webglcontextrestored', this.handleContextRestored, false);
            this._contextOptions = {
                alpha: this.transparent,
                antialias: this.options.antialias,
                premultipliedAlpha: this.transparent && this.transparent !== 'notMultiplied',
                stencil: true,
                preserveDrawingBuffer: this.options.preserveDrawingBuffer,
                powerPreference: this.options.powerPreference,
            };
            this._backgroundColorRgba[3] = this.transparent ? 0 : 1;
            this._backgroundColorRgba[3] = 1;
            this.maskManager = new MaskManager_1.MaskManager();
            //this.maskManager.renderer = this;
            this.stencilManager = new StencilManager_1.StencilManager();
            //this.stencilManager.renderer = this;
            this.emptyRenderer = new ObjectRenderer_1.ObjectRenderer();
            //this.emptyRenderer.renderer = this;
            this.currentRenderer = this.emptyRenderer;
            this.textureManager = null;
            this.filterManager = null;
            if (this.options.context) {
                Utils_1.Utils.validateMasking(this.options.context);
            }
            this.gl = Utils_1.Utils.createContext(this.view, this._contextOptions);
            this.CONTEXT_UID = WebGLRenderer.CONTEXT_UID++;
            this.state = new WebGLState_1.WebGLState(this.gl);
            this.renderingToScreen = true;
            this.boundTextures = null;
            this._activeShader = null;
            this._activeVao = null;
            this._activeRenderTarget = null;
            this._initContext();
            this.drawModes = Utils_1.Utils.mapWebGLDrawModesToPixi(this.gl);
            this._nextTextureLocation = 0;
            this.setBlendMode(0);
        }
        removeRenderer(renderer) {
        }
        addRenderer(renderer) {
        }
        _initContext() {
            const gl = this.gl;
            if (gl.isContextLost() && gl.getExtension('WEBGL_lose_context')) {
                gl.getExtension('WEBGL_lose_context').restoreContext();
            }
            const maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
            this._activeShader = null;
            this._activeVao = null;
            this.boundTextures = new Array(maxTextures);
            this.emptyTextures = new Array(maxTextures);
            this.textureManager = new TextureManager_1.TextureManager();
            //this.textureManager.renderer = this;
            this.filterManager = new FilterManager_1.FilterManager();
            this.filterManager.renderer = this;
            //this.textureGC = new TextureGarbageCollector(this);
            this.state.resetToDefault();
            this.rootRenderTarget = new RenderTarget_1.RenderTarget(gl, this.width, this.height, null, this.resolution, true);
            this.rootRenderTarget.clearColor = this._backgroundColorRgba;
            this.bindRenderTarget(this.rootRenderTarget);
            const emptyGLTexture = GLTexture_1.GLTexture.fromData(gl, null, 1, 1);
            const tempObj = { _glTextures: {} };
            tempObj._glTextures[this.CONTEXT_UID] = {};
            for (let i = 0; i < maxTextures; i++) {
                const empty = new BaseTexture_1.BaseTexture();
                empty._glTextures[this.CONTEXT_UID] = emptyGLTexture;
                this.boundTextures[i] = tempObj;
                this.emptyTextures[i] = empty;
                this.bindTexture(null, i);
            }
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CONTEXT3D_CREATE));
            //this.emit('context', gl);
            this.resize(this.screen.width, this.screen.height);
        }
        render(displayObject, renderTexture = null, clear = true, transform = null, skipUpdateTransform = false) {
            this.renderingToScreen = !renderTexture;
            if (!this.gl || this.gl.isContextLost()) {
                return;
            }
            this._nextTextureLocation = 0;
            if (!renderTexture) {
                this._lastObjectRendered = displayObject;
            }
            if (!skipUpdateTransform) {
                const cacheParent = displayObject.parent;
                displayObject.parent = this._tempDisplayObjectParent;
                displayObject.updateTransform();
                displayObject.parent = cacheParent;
            }
            this.bindRenderTexture(renderTexture, transform);
            this.currentRenderer.start();
            if (clear !== undefined ? clear : this.clearBeforeRender) {
                //this.show(this._activeRenderTarget.className)
                this._activeRenderTarget.clear();
            }
            //displayObject.renderWebGL();
            //this.currentRenderer.flush();
            //this.setObjectRenderer(this.emptyRenderer);
            //this.textureGC.update();
            this.dispatchEvent(new Event_1.Event(Event_1.Event.RENDER));
            //this.emit('postrender');
        }
        setObjectRenderer(objectRenderer) {
            if (this.currentRenderer === objectRenderer) {
                return;
            }
            this.currentRenderer = objectRenderer;
            //this.currentRenderer.setContext(this);
            this.currentRenderer.stop();
            this.currentRenderer.start();
        }
        flush() {
            this.setObjectRenderer(this.emptyRenderer);
        }
        resize(screenWidth, screenHeight) {
            super.resize(screenWidth, screenHeight);
            this.rootRenderTarget.resize(screenWidth, screenHeight);
            if (this._activeRenderTarget === this.rootRenderTarget) {
                this.rootRenderTarget.activate();
                if (this._activeShader) {
                    this._activeShader.uniforms.projectionMatrix = this.rootRenderTarget.projectionMatrix.toArray(true);
                }
            }
        }
        setBlendMode(blendMode) {
            this.state.setBlendMode(blendMode);
        }
        clear(clearColor) {
            this._activeRenderTarget.clear(clearColor);
        }
        setTransform(matrix) {
            this._activeRenderTarget.transform = matrix;
        }
        clearRenderTexture(renderTexture, clearColor) {
            const baseTexture = renderTexture.baseTexture;
            const renderTarget = baseTexture._glRenderTargets[this.CONTEXT_UID];
            if (renderTarget) {
                renderTarget.clear(clearColor);
            }
            return this;
        }
        bindRenderTexture(renderTexture, transform) {
            let renderTarget;
            if (renderTexture) {
                const baseTexture = renderTexture.baseTexture;
                if (!baseTexture._glRenderTargets[this.CONTEXT_UID]) {
                    this.textureManager.updateTexture(baseTexture, 0);
                }
                this.unbindTexture(baseTexture);
                renderTarget = baseTexture._glRenderTargets[this.CONTEXT_UID];
                renderTarget.setFrame(renderTexture.frame);
            }
            else {
                renderTarget = this.rootRenderTarget;
            }
            renderTarget.transform = transform;
            this.bindRenderTarget(renderTarget);
            return this;
        }
        bindRenderTarget(renderTarget) {
            if (renderTarget !== this._activeRenderTarget) {
                this._activeRenderTarget = renderTarget;
                renderTarget.activate();
                if (this._activeShader) {
                    this._activeShader.uniforms.projectionMatrix = renderTarget.projectionMatrix.toArray(true);
                }
                this.stencilManager.setMaskStack(renderTarget.stencilMaskStack);
            }
            return this;
        }
        bindShader(shader, autoProject = true) {
            if (this._activeShader !== shader) {
                this._activeShader = shader;
                shader.bind();
                if (autoProject !== false) {
                    shader.uniforms.projectionMatrix = this._activeRenderTarget.projectionMatrix.toArray(true);
                }
            }
            return this;
        }
        bindTexture(texture, location = undefined, forceLocation = false) {
            //this.show('tex: ' + texture)
            //this.show('id: ' + location)
            texture = texture || this.emptyTextures[location];
            if (texture instanceof Texture_1.Texture) {
                texture.baseTexture.touched = this.textureGC.count;
                texture = texture.baseTexture;
            }
            else {
                texture = texture;
            }
            if (!forceLocation) {
                for (let i = 0; i < this.boundTextures.length; i++) {
                    if (this.boundTextures[i] === texture) {
                        return i;
                    }
                }
                if (location === undefined) {
                    this._nextTextureLocation++;
                    this._nextTextureLocation %= this.boundTextures.length;
                    location = this.boundTextures.length - this._nextTextureLocation - 1;
                }
            }
            else {
                location = location || 0;
            }
            const gl = this.gl;
            var glTexture = null;
            if (texture instanceof Texture_1.Texture) {
                glTexture = null;
            }
            else {
                glTexture = texture._glTextures[this.CONTEXT_UID];
            }
            if (!glTexture || !glTexture.texture) {
                this.textureManager.updateTexture(texture, location);
            }
            else {
                this.boundTextures[location] = texture;
                gl.activeTexture(gl.TEXTURE0 + location);
                gl.bindTexture(gl.TEXTURE_2D, glTexture.texture);
            }
            return location;
        }
        unbindTexture(value) {
            const gl = this.gl;
            var basetex = value;
            if (value instanceof Texture_1.Texture) {
                basetex = value.baseTexture;
            }
            for (let i = 0; i < this.boundTextures.length; i++) {
                if (this.boundTextures[i] === basetex) {
                    this.boundTextures[i] = this.emptyTextures[i];
                    gl.activeTexture(gl.TEXTURE0 + i);
                    gl.bindTexture(gl.TEXTURE_2D, this.emptyTextures[i]._glTextures[this.CONTEXT_UID].texture);
                }
            }
            return this;
        }
        createVao() {
            return new VertexArrayObject_1.VertexArrayObject(this.gl, this.state.attribState);
        }
        bindVao(vao) {
            if (this._activeVao === vao) {
                return this;
            }
            if (vao) {
                vao.bind();
            }
            else if (this._activeVao) {
                this._activeVao.unbind();
            }
            this._activeVao = vao;
            return this;
        }
        reset() {
            this.setObjectRenderer(this.emptyRenderer);
            this.bindVao(null);
            this._activeShader = null;
            this._activeRenderTarget = this.rootRenderTarget;
            for (let i = 0; i < this.boundTextures.length; i++) {
                this.boundTextures[i] = this.emptyTextures[i];
            }
            this.rootRenderTarget.activate();
            this.state.resetToDefault();
            return this;
        }
        handleContextLost(event) {
            event.preventDefault();
        }
        handleContextRestored() {
            this.textureManager.removeAll();
            this.filterManager.destroy(true);
            this._initContext();
        }
        destroy(removeView = true) {
            this.view.removeEventListener('webglcontextlost', this.handleContextLost);
            this.view.removeEventListener('webglcontextrestored', this.handleContextRestored);
            this.textureManager.destroy();
            super.destroy(removeView);
            this.uid = 0;
            this.maskManager.destroy();
            this.stencilManager.destroy();
            this.filterManager.destroy();
            this.maskManager = null;
            this.filterManager = null;
            this.textureManager = null;
            this.currentRenderer = null;
            this.handleContextLost = null;
            this.handleContextRestored = null;
            this._contextOptions = null;
            this.gl.useProgram(null);
            if (this.gl.getExtension('WEBGL_lose_context')) {
                this.gl.getExtension('WEBGL_lose_context').loseContext();
            }
            this.gl = null;
        }
    }
    WebGLRenderer.CONTEXT_UID = 0;
    exports.WebGLRenderer = WebGLRenderer;
});
