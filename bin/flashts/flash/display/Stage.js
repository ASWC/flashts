define(["require", "exports", "flash/display//DisplayObjectContainer", "flash/geom/Rectangle", "flash/display/StageAlign", "flash/display/StageDisplayState", "flash/display/StageQuality", "flash/display/StageScaleMode", "flash/rendering/webgl/Utils", "flash/rendering/textures/Texture", "flash/rendering/textures/RenderTexture", "flash/geom/Matrix", "flash/rendering/core/gl/VertexArrayObject", "flash/rendering/webgl/MaskManager", "flash/rendering/webgl/StencilManager", "flash/rendering/core/renderers/ObjectRenderer", "flash/rendering/textures/TextureManager", "flash/rendering/webgl/FilterManager", "flash/rendering/webgl/WebGLState", "flash/rendering/webgl/RenderTarget", "flash/rendering/webgl/TextureGarbageCollector", "flash/rendering/core/gl/GLTexture", "flash/rendering/textures/BaseTexture", "flash/events/Event", "flash/rendering/managers/Constants", "flash/rendering/core/StageSettings", "flash/utils/Timer"], function (require, exports, DisplayObjectContainer_1, Rectangle_1, StageAlign_1, StageDisplayState_1, StageQuality_1, StageScaleMode_1, Utils_1, Texture_1, RenderTexture_1, Matrix_1, VertexArrayObject_1, MaskManager_1, StencilManager_1, ObjectRenderer_1, TextureManager_1, FilterManager_1, WebGLState_1, RenderTarget_1, TextureGarbageCollector_1, GLTexture_1, BaseTexture_1, Event_1, Constants_1, StageSettings_1, Timer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // TYPED
    class Stage extends DisplayObjectContainer_1.DisplayObjectContainer {
        constructor() {
            super();
            this.handleContextRestored = (event) => {
                this.textureManager.removeAll();
                this.filterManager.destroy(true);
                this.setOptionsRendering();
            };
            this.handleContextLost = (event) => {
                event.preventDefault();
            };
            this._invalidate = false;
            this._renderEvent = new Event_1.Event(Event_1.Event.RENDER);
            this._parent = null;
            this._started = false;
            this.stageOptions = new StageOptions();
            this._align = StageAlign_1.StageAlign.TOP_LEFT;
            this._scaleMode = StageScaleMode_1.StageScaleMode.NO_SCALE;
            this._orientation = '';
            this._quality = StageQuality_1.StageQuality.HIGH;
            this._deviceOrientation = '';
            this._displayState = StageDisplayState_1.StageDisplayState.NORMAL;
            this._supportedOrientations = [];
            this._allowsFullScreen = true;
            this._autoOrients = true;
            this._color = 0xFFFFFF;
            this._stageHeight = 0;
            this._fullScreenWidth = 0;
            this._fullScreenHeight = 0;
            this._stageWidth = 0;
            this._fullScreenSourceRect = new Rectangle_1.Rectangle();
            this._focus = null;
            this._screen = new Rectangle_1.Rectangle(0, 0, this.stageOptions.width, this.stageOptions.height);
            this._backgroundColorRgba = Utils_1.Utils.hex2rgb(this.stageOptions.backgroundColor);
            this._backgroundColorString = Utils_1.Utils.hex2string(this.stageOptions.backgroundColor);
            this._lastObjectRendered = null;
            this.CONTEXT_UID = 1;
            this.maskManager = null;
            this.stencilManager = null;
            this.emptyRenderer = null;
            this._currentRenderer = null;
            this.textureManager = null;
            this.filterManager = null;
            this.state = null;
            this.renderingToScreen = true;
            this._boundTextures = null;
            this._emptyTextures = null;
            this._activeShader = null;
            this._activeVao = null;
            this._activeRenderTarget = null;
            this.drawModes = null;
            this._textureGC = null;
            this.rootRenderTarget = null;
            this._nextTextureLocation = 0;
        }
        get currentRenderer() {
            return this._currentRenderer;
        }
        clear(clearColor) {
            this._activeRenderTarget.clear(clearColor);
        }
        get screen() {
            return this._screen;
        }
        get activeRenderTarget() {
            return this._activeRenderTarget;
        }
        setOptionsRendering() {
            if (!this.stageOptions.view) {
                return;
            }
            if (this.stageOptions.legacy) {
                VertexArrayObject_1.VertexArrayObject.FORCE_NATIVE = true;
            }
            this.stageOptions.view.addEventListener('webglcontextlost', this.handleContextLost, false);
            this.stageOptions.view.addEventListener('webglcontextrestored', this.handleContextRestored, false);
            var attributes = {
                failIfMajorPerformanceCaveat: true,
                alpha: this.stageOptions.transparent,
                antialias: this.stageOptions.antialias,
                depth: true,
                premultipliedAlpha: this.stageOptions.transparent,
                preserveDrawingBuffer: this.stageOptions.preserveDrawingBuffer,
                stencil: true
            };
            if (!this.stageOptions.context) {
                this.stageOptions.context = Utils_1.Utils.createContext(this.stageOptions.view, attributes);
                const maxTextures = this.stageOptions.context.getParameter(this.stageOptions.context.MAX_TEXTURE_IMAGE_UNITS);
                this._boundTextures = new Array(maxTextures);
                this._emptyTextures = new Array(maxTextures);
                this._textureGC = new TextureGarbageCollector_1.TextureGarbageCollector(this);
                this.state = new WebGLState_1.WebGLState(this.stageOptions.context);
                this.state.resetToDefault();
                this.rootRenderTarget = new RenderTarget_1.RenderTarget(this.stageOptions.context, this.stageOptions.width, this.stageOptions.height, null, this.stageOptions.resolution, true);
                this.rootRenderTarget.clearColor = this._backgroundColorRgba;
                this.bindRenderTarget(this.rootRenderTarget);
                const emptyGLTexture = GLTexture_1.GLTexture.fromData(this.stageOptions.context, null, 1, 1);
                const tempObj = new BaseTexture_1.BaseTexture();
                tempObj._glTextures[this.CONTEXT_UID] = null;
                for (let i = 0; i < maxTextures; i++) {
                    const empty = new BaseTexture_1.BaseTexture();
                    empty._glTextures[this.CONTEXT_UID] = emptyGLTexture;
                    this._boundTextures[i] = tempObj;
                    this._emptyTextures[i] = empty;
                    this.bindTexture(null, i);
                }
                this.dispatchEvent(new Event_1.Event(Event_1.Event.CONTEXT3D_CREATE));
                this.resize(this.stageOptions.width, this.stageOptions.height);
            }
        }
        bindTexture(texture, location = undefined, forceLocation = false) {
            texture = texture || this._emptyTextures[location];
            if (texture instanceof Texture_1.Texture) {
                texture.baseTexture.touched = this._textureGC.count;
                texture = texture.baseTexture;
            }
            else {
                texture = texture;
            }
            if (!forceLocation) {
                for (let i = 0; i < this._boundTextures.length; i++) {
                    if (this._boundTextures[i] === texture) {
                        return i;
                    }
                }
                if (location === undefined) {
                    this._nextTextureLocation++;
                    this._nextTextureLocation %= this._boundTextures.length;
                    location = this._boundTextures.length - this._nextTextureLocation - 1;
                }
            }
            else {
                location = location || 0;
            }
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
                this._boundTextures[location] = texture;
                this.stageOptions.context.activeTexture(this.stageOptions.context.TEXTURE0 + location);
                this.stageOptions.context.bindTexture(this.stageOptions.context.TEXTURE_2D, glTexture.texture);
            }
            return location;
        }
        bindRenderTarget(renderTarget) {
            if (renderTarget !== this._activeRenderTarget) {
                this._activeRenderTarget = renderTarget;
                renderTarget.activate();
                if (this._activeShader) {
                    this._activeShader.uniforms.projectionMatrix = renderTarget.projectionMatrix.toArray(true);
                }
                if (this.stencilManager) {
                    this.stencilManager.setMaskStack(renderTarget.stencilMaskStack);
                }
            }
        }
        start() {
            if (this._started) {
                return;
            }
            this._started = true;
            this.setOptionsRendering();
            if (!this.stageOptions.context) {
                this.show('Could not create context');
                return;
            }
            this.setMaskManager();
            this.setDefaultObjectRenderer();
            this.setTextureManager();
            this.setFilterManager();
            if (Utils_1.Utils.validateMasking(this.stageOptions.context)) {
                this.setStencilmanager();
            }
            this.CONTEXT_UID++;
            this.renderingToScreen = true;
            this.drawModes = Utils_1.Utils.mapWebGLDrawModesToPixi(this.stageOptions.context);
            this._nextTextureLocation = 0;
            this.state.setBlendMode(0);
            if (this.stageOptions.context.isContextLost() && this.stageOptions.context.getExtension('WEBGL_lose_context')) {
                this.stageOptions.context.getExtension('WEBGL_lose_context').restoreContext();
            }
            Timer_1.Timer.shared.add(this.update, this, Constants_1.Constants.UPDATE_PRIORITY.LOW);
            Timer_1.Timer.shared.start();
        }
        flush() {
            this.setObjectRenderer(this.emptyRenderer);
        }
        setObjectRenderer(objectRenderer) {
            if (this._currentRenderer === objectRenderer) {
                return;
            }
            this._currentRenderer.stop();
            this._currentRenderer = objectRenderer;
            this._currentRenderer.stageContext = this;
            this._currentRenderer.start();
        }
        get textureGCCount() {
            return this._textureGC.count;
        }
        update() {
            this.render(this);
        }
        render(displayObject, renderTexture = null, clear = true, transform = null, skipUpdateTransform = false) {
            if (this.hasEventListener(Event_1.Event.ENTER_FRAME)) {
                if (!this._enterFrameEvent) {
                    this._enterFrameEvent = new Event_1.Event(Event_1.Event.ENTER_FRAME);
                }
                this.dispatchEvent(this._enterFrameEvent);
            }
            this.renderingToScreen = !renderTexture;
            if (!this.stageOptions.context || this.stageOptions.context.isContextLost()) {
                return;
            }
            this._nextTextureLocation = 0;
            if (!renderTexture) {
                this._lastObjectRendered = displayObject;
            }
            if (!skipUpdateTransform) {
                const cacheParent = displayObject.parent;
                displayObject.parent = this.emptyRoot;
                displayObject.updateTransform();
                displayObject.parent = cacheParent;
            }
            this.bindRenderTexture(renderTexture, transform);
            this._currentRenderer.start();
            if (this.stageOptions.clearBeforeRender) {
                this._activeRenderTarget.clear(this._backgroundColorRgba);
            }
            displayObject.renderWebGL();
            this._currentRenderer.flush();
            this.setObjectRenderer(this.emptyRenderer);
            this._textureGC.update();
            if (this._invalidate) {
                this._invalidate = false;
                this.dispatchEvent(this._renderEvent);
            }
            if (this.hasEventListener(Event_1.Event.EXIT_FRAME)) {
                if (!this._exitFrameEvent) {
                    this._exitFrameEvent = new Event_1.Event(Event_1.Event.EXIT_FRAME);
                }
                this.dispatchEvent(this._exitFrameEvent);
            }
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
        }
        unbindTexture(value) {
            var basetex = value;
            if (value instanceof Texture_1.Texture) {
                basetex = value.baseTexture;
            }
            for (let i = 0; i < this._boundTextures.length; i++) {
                if (this._boundTextures[i] === basetex) {
                    this._boundTextures[i] = this._emptyTextures[i];
                    this.stageOptions.context.activeTexture(this.stageOptions.context.TEXTURE0 + i);
                    this.stageOptions.context.bindTexture(this.stageOptions.context.TEXTURE_2D, this._emptyTextures[i]._glTextures[this.CONTEXT_UID].texture);
                }
            }
        }
        get emptyTextures() {
            return this._emptyTextures;
        }
        get boundTextures() {
            return this._boundTextures;
        }
        createVao() {
            return new VertexArrayObject_1.VertexArrayObject(this.context, this.state.attribState);
        }
        stop() {
            this._started = false;
            Timer_1.Timer.shared.remove(this.update, this);
        }
        getFilterManager() {
            return this.filterManager;
        }
        setFilterManager() {
            if (this.filterManager) {
                return;
            }
            this.filterManager = new FilterManager_1.FilterManager();
        }
        getTextureManager() {
            return this.textureManager;
        }
        setTextureManager() {
            if (this.textureManager) {
                return;
            }
            this.textureManager = new TextureManager_1.TextureManager();
            this.textureManager.stage = this;
        }
        setDefaultObjectRenderer() {
            if (this.emptyRenderer) {
                return;
            }
            this.emptyRenderer = new ObjectRenderer_1.ObjectRenderer();
            this._currentRenderer = this.emptyRenderer;
        }
        setStencilmanager() {
            if (this.stencilManager) {
                return;
            }
            this.stencilManager = new StencilManager_1.StencilManager();
        }
        getMaskManager() {
            return this.maskManager;
        }
        setMaskManager() {
            if (this.maskManager) {
                return;
            }
            this.maskManager = new MaskManager_1.MaskManager();
        }
        get emptyRoot() {
            if (this._tempDisplayObjectParent == null) {
                var temp = new DisplayObjectContainer_1.DisplayObjectContainer();
                this._tempDisplayObjectParent = temp;
            }
            return this._tempDisplayObjectParent;
        }
        resize(screenWidth, screenHeight) {
            if (!this.stageOptions.view) {
                return;
            }
            this._screen.width = screenWidth;
            this._screen.height = screenHeight;
            this.stageOptions.view.width = screenWidth * this.stageOptions.resolution;
            this.stageOptions.view.height = screenHeight * this.stageOptions.resolution;
            if (this.stageOptions.autoResize) {
                this.stageOptions.view.style.width = `${screenWidth}px`;
                this.stageOptions.view.style.height = `${screenHeight}px`;
            }
        }
        destroy() {
            if (this.stageOptions.view) {
                this.stageOptions.view.parentNode.removeChild(this.stageOptions.view);
            }
            this.stageOptions.view = null;
            this._screen = null;
            this.stageOptions = null;
            this._backgroundColorRgba = null;
            this._backgroundColorString = null;
            this._lastObjectRendered = null;
        }
        generateTexture(displayObject, scaleMode, resolution, region) {
            region = region || displayObject.getLocalBounds();
            const renderTexture = RenderTexture_1.RenderTexture.create(region.width | 0, region.height | 0, scaleMode, resolution);
            Matrix_1.Matrix.GLOBAL.tx = -region.x;
            Matrix_1.Matrix.GLOBAL.ty = -region.y;
            //this.render(displayObject, renderTexture, false, Matrix.GLOBAL, true);
            return renderTexture;
        }
        get height() {
            if (this.stageOptions.view) {
                return this.stageOptions.view.height;
            }
            return 0;
        }
        get width() {
            if (this.stageOptions.view) {
                return this.stageOptions.view.width;
            }
            return 0;
        }
        get align() {
            return this._align;
        }
        set align(value) {
            this._align = value;
        }
        get allowsFullScreen() {
            return this._allowsFullScreen;
        }
        get allowsFullScreenInteractive() {
            return this._allowsFullScreen;
        }
        get autoOrients() {
            return this._autoOrients;
        }
        set autoOrients(value) {
            this._autoOrients = value;
        }
        get color() {
            return this._color;
        }
        set color(value) {
            this._color = value;
        }
        get orientation() {
            return this._orientation;
        }
        get scaleMode() {
            return this._scaleMode;
        }
        set scaleMode(value) {
            this._scaleMode = value;
        }
        get stageHeight() {
            return this._stageHeight;
        }
        set stageHeight(value) {
            this._stageHeight = value;
        }
        get stageWidth() {
            return this._stageWidth;
        }
        set stageWidth(value) {
            this._stageWidth = value;
        }
        get supportedOrientations() {
            return this._supportedOrientations;
        }
        get quality() {
            return this._quality;
        }
        set quality(value) {
            this._quality = value;
        }
        get deviceOrientation() {
            return this._deviceOrientation;
        }
        get displayState() {
            return this._displayState;
        }
        set displayState(value) {
            this._displayState = value;
        }
        get focus() {
            return this._focus;
        }
        set focus(value) {
            this._focus = value;
        }
        get frameRate() {
            return StageSettings_1.StageSettings.FPS;
        }
        set frameRate(value) {
            StageSettings_1.StageSettings.FPS = value;
        }
        get fullScreenHeight() {
            return this._fullScreenHeight;
        }
        get fullScreenWidth() {
            return this._fullScreenWidth;
        }
        get fullScreenSourceRect() {
            return this._fullScreenSourceRect;
        }
        set fullScreenSourceRect(value) {
            this._fullScreenSourceRect = value;
        }
        assignFocus(objectToFocus, direction) {
        }
        invalidate() {
            this._invalidate = true;
        }
        setAspectRatio(newAspectRatio) {
        }
        setOrientation(newOrientation) {
        }
        setCanvas(canvas = null) {
            if (!canvas) {
                return;
            }
            if (typeof (canvas) == 'string') {
                var domcanvas = document.getElementById(canvas);
                domcanvas.width = this.stageOptions.width;
                domcanvas.height = this.stageOptions.height;
                this.stageOptions.view = domcanvas;
            }
            else if (canvas instanceof HTMLCanvasElement) {
                this.stageOptions.view = canvas;
                this.stageOptions.width = canvas.width;
                this.stageOptions.height = canvas.height;
            }
        }
        getCanvasView() {
            return this.stageOptions.view;
        }
        set canvasWidth(value) {
            this.stageOptions.width = value;
        }
        set canvasHeight(value) {
            this.stageOptions.height = value;
        }
        set canvasColor(value) {
            this.stageOptions.backgroundColor = value;
            this._backgroundColorRgba = Utils_1.Utils.hex2rgb(this.stageOptions.backgroundColor);
            this._backgroundColorString = Utils_1.Utils.hex2string(this.stageOptions.backgroundColor);
        }
        get stage() {
            return this;
        }
        get canvasResolution() {
            return this.stageOptions.resolution;
        }
        set canvasResolution(value) {
            this.stageOptions.resolution = value;
        }
        set canvasLegacy(value) {
            this.stageOptions.legacy = value;
        }
        set canvasRoundPixels(value) {
            this.stageOptions.roundPixels = value;
        }
        set canvasForceFXAA(value) {
            this.stageOptions.forceFXAA = value;
        }
        set clearBeforeRender(value) {
            this.stageOptions.clearBeforeRender = value;
        }
        set preserveDrawingBuffer(value) {
            this.stageOptions.preserveDrawingBuffer = value;
        }
        set antialias(value) {
            this.stageOptions.antialias = value;
        }
        set canvasAutoResize(value) {
            this.stageOptions.autoResize = value;
        }
        set canvasTransparent(value) {
            this.stageOptions.transparent = value;
        }
        get context() {
            if (this.stageOptions) {
                return this.stageOptions.context;
            }
            return null;
        }
        getContextID() {
            return this.CONTEXT_UID;
        }
        getRenderState() {
            return this.state;
        }
        bindShader(shader, autoProject = true) {
            if (this._activeShader !== shader) {
                this._activeShader = shader;
                shader.bind();
                if (autoProject !== false) {
                    shader.uniforms.projectionMatrix = this._activeRenderTarget.projectionMatrix.toArray(true);
                }
            }
        }
        bindVao(vao) {
            if (this._activeVao === vao) {
                return;
            }
            if (vao) {
                vao.bind();
            }
            else if (this._activeVao) {
                this._activeVao.unbind();
            }
            this._activeVao = vao;
        }
    }
    exports.Stage = Stage;
    class StageOptions {
        constructor() {
            this.context = null;
            this.legacy = false;
            this.backgroundColor = 0xFF0000;
            this.resolution = 1;
            this.roundPixels = false;
            this.forceFXAA = true;
            this.clearBeforeRender = true;
            this.preserveDrawingBuffer = true;
            this.antialias = false;
            this.autoResize = true;
            this.transparent = false;
            this.view = null;
            this.width = 800;
            this.height = 600;
        }
    }
});
