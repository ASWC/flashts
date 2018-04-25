define(["require", "exports", "./SystemRenderer", "../managers/Constants", "../managers/CanvasMaskManager", "./Utils", "../display/CanvasRenderTarget", "../Settings"], function (require, exports, SystemRenderer_1, Constants_1, CanvasMaskManager_1, Utils_1, CanvasRenderTarget_1, Settings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CanvasRenderer extends SystemRenderer_1.SystemRenderer {
        constructor(options = null, arg2 = null, arg3 = null) {
            super('Canvas', options);
            this.type = Constants_1.Constants.RENDERER_TYPE.CANVAS;
            /**
             * The root canvas 2d context that everything is drawn with.
             *
             * @member {CanvasRenderingContext2D}
             */
            this.rootContext = this.view.getContext('2d', { alpha: this.transparent });
            /**
             * The currently active canvas 2d context (could change with renderTextures)
             *
             * @member {CanvasRenderingContext2D}
             */
            this.context = this.rootContext;
            /**
             * Boolean flag controlling canvas refresh.
             *
             * @member {boolean}
             */
            this.refresh = true;
            /**
             * Instance of a CanvasMaskManager, handles masking when using the canvas renderer.
             *
             * @member {PIXI.CanvasMaskManager}
             */
            this.maskManager = new CanvasMaskManager_1.CanvasMaskManager(this);
            /**
             * The canvas property used to set the canvas smoothing property.
             *
             * @member {string}
             */
            this.smoothProperty = 'imageSmoothingEnabled';
            if (!this.rootContext.imageSmoothingEnabled) {
                if (this.rootContext.webkitImageSmoothingEnabled) {
                    this.smoothProperty = 'webkitImageSmoothingEnabled';
                }
                else if (this.rootContext.mozImageSmoothingEnabled) {
                    this.smoothProperty = 'mozImageSmoothingEnabled';
                }
                else if (this.rootContext.oImageSmoothingEnabled) {
                    this.smoothProperty = 'oImageSmoothingEnabled';
                }
                else if (this.rootContext.msImageSmoothingEnabled) {
                    this.smoothProperty = 'msImageSmoothingEnabled';
                }
            }
            //this.initPlugins();
            this.blendModes = Utils_1.Utils.mapCanvasBlendModesToPixi();
            this._activeBlendMode = null;
            this.renderingToScreen = false;
            this.resize(this.options.width, this.options.height);
            /**
             * Fired after rendering finishes.
             *
             * @event PIXI.CanvasRenderer#postrender
             */
            /**
             * Fired before rendering starts.
             *
             * @event PIXI.CanvasRenderer#prerender
             */
        }
        /**
         * Renders the object to this canvas view
         *
         * @param {PIXI.DisplayObject} displayObject - The object to be rendered
         * @param {PIXI.RenderTexture} [renderTexture] - A render texture to be rendered to.
         *  If unset, it will render to the root context.
         * @param {boolean} [clear=false] - Whether to clear the canvas before drawing
         * @param {PIXI.Transform} [transform] - A transformation to be applied
         * @param {boolean} [skipUpdateTransform=false] - Whether to skip the update transform
         */
        render(displayObject, renderTexture, clear, transform, skipUpdateTransform) {
            if (!this.view) {
                return;
            }
            // can be handy to know!
            this.renderingToScreen = !renderTexture;
            this.emit('prerender');
            const rootResolution = this.resolution;
            if (renderTexture) {
                renderTexture = renderTexture.baseTexture || renderTexture;
                if (!renderTexture._canvasRenderTarget) {
                    renderTexture._canvasRenderTarget = new CanvasRenderTarget_1.CanvasRenderTarget(renderTexture.width, renderTexture.height, renderTexture.resolution);
                    renderTexture.source = renderTexture._canvasRenderTarget.canvas;
                    renderTexture.valid = true;
                }
                this.context = renderTexture._canvasRenderTarget.context;
                this.resolution = renderTexture._canvasRenderTarget.resolution;
            }
            else {
                this.context = this.rootContext;
            }
            const context = this.context;
            if (!renderTexture) {
                this._lastObjectRendered = displayObject;
            }
            if (!skipUpdateTransform) {
                // update the scene graph
                const cacheParent = displayObject.parent;
                const tempWt = this._tempDisplayObjectParent.transform.worldTransform;
                if (transform) {
                    transform.copy(tempWt);
                    // lets not forget to flag the parent transform as dirty...
                    this._tempDisplayObjectParent.transform._worldID = -1;
                }
                else {
                    tempWt.identity();
                }
                displayObject.parent = this._tempDisplayObjectParent;
                displayObject.updateTransform();
                displayObject.parent = cacheParent;
                // displayObject.hitArea = //TODO add a temp hit area
            }
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.globalAlpha = 1;
            this._activeBlendMode = Constants_1.Constants.BLEND_MODES.NORMAL;
            context.globalCompositeOperation = this.blendModes[Constants_1.Constants.BLEND_MODES.NORMAL];
            if (navigator['isCocoonJS'] && this.view.screencanvas) {
                context.fillStyle = 'black';
                context.clear();
            }
            if (clear !== undefined ? clear : this.clearBeforeRender) {
                if (this.renderingToScreen) {
                    if (this.transparent) {
                        context.clearRect(0, 0, this.width, this.height);
                    }
                    else {
                        context.fillStyle = this._backgroundColorString;
                        context.fillRect(0, 0, this.width, this.height);
                    }
                } // else {
                // TODO: implement background for CanvasRenderTarget or RenderTexture?
                // }
            }
            // TODO RENDER TARGET STUFF HERE..
            const tempContext = this.context;
            this.context = context;
            displayObject.renderCanvas(this);
            this.context = tempContext;
            context.restore();
            this.resolution = rootResolution;
            this.emit('postrender');
        }
        /**
         * Clear the canvas of renderer.
         *
         * @param {string} [clearColor] - Clear the canvas with this color, except the canvas is transparent.
         */
        clear(clearColor) {
            const context = this.context;
            clearColor = clearColor || this._backgroundColorString;
            if (!this.transparent && clearColor) {
                context.fillStyle = clearColor;
                context.fillRect(0, 0, this.width, this.height);
            }
            else {
                context.clearRect(0, 0, this.width, this.height);
            }
        }
        /**
         * Sets the blend mode of the renderer.
         *
         * @param {number} blendMode - See {@link PIXI.BLEND_MODES} for valid values.
         */
        setBlendMode(blendMode) {
            if (this._activeBlendMode === blendMode) {
                return;
            }
            this._activeBlendMode = blendMode;
            this.context.globalCompositeOperation = this.blendModes[blendMode];
        }
        /**
         * Removes everything from the renderer and optionally removes the Canvas DOM element.
         *
         * @param {boolean} [removeView=false] - Removes the Canvas element from the DOM.
         */
        destroy(removeView) {
            //this.destroyPlugins();
            // call the base destroy
            super.destroy(removeView);
            this.context = null;
            this.refresh = true;
            this.maskManager.destroy();
            this.maskManager = null;
            this.smoothProperty = null;
        }
        /**
         * Resizes the canvas view to the specified width and height.
         *
         * @extends PIXI.SystemRenderer#resize
         *
         * @param {number} screenWidth - the new width of the screen
         * @param {number} screenHeight - the new height of the screen
         */
        resize(screenWidth, screenHeight) {
            super.resize(screenWidth, screenHeight);
            // reset the scale mode.. oddly this seems to be reset when the canvas is resized.
            // surely a browser bug?? Let PixiJS fix that for you..
            if (this.smoothProperty) {
                this.rootContext[this.smoothProperty] = (Settings_1.Settings.SCALE_MODE === Constants_1.Constants.SCALE_MODES.LINEAR);
            }
        }
        /**
         * Checks if blend mode has changed.
         */
        invalidateBlendMode() {
            this._activeBlendMode = this.blendModes.indexOf(this.context.globalCompositeOperation);
        }
    }
    exports.CanvasRenderer = CanvasRenderer;
});
/**
 * Collection of installed plugins. These are included by default in PIXI, but can be excluded
 * by creating a custom build. Consult the README for more information about creating custom
 * builds and excluding plugins.
 * @name PIXI.CanvasRenderer#plugins
 * @type {object}
 * @readonly
 * @property {PIXI.accessibility.AccessibilityManager} accessibility Support tabbing interactive elements.
 * @property {PIXI.extract.CanvasExtract} extract Extract image data from renderer.
 * @property {PIXI.interaction.InteractionManager} interaction Handles mouse, touch and pointer events.
 * @property {PIXI.prepare.CanvasPrepare} prepare Pre-render display objects.
 */
/**
 * Adds a plugin to the renderer.
 *
 * @method PIXI.CanvasRenderer#registerPlugin
 * @param {string} pluginName - The name of the plugin.
 * @param {Function} ctor - The constructor function or class for the plugin.
 */
//pluginTarget.mixin(CanvasRenderer); 
