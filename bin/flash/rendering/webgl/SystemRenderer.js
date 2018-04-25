define(["require", "exports", "../../geom/Matrix", "./Utils", "../managers/Constants", "flash/geom/Rectangle", "flash/display/DisplayObjectContainer", "../textures/RenderTexture", "flash/events/EventDispatcher", "flash/rendering/core/StageSettings"], function (require, exports, Matrix_1, Utils_1, Constants_1, Rectangle_1, DisplayObjectContainer_1, RenderTexture_1, EventDispatcher_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SystemRenderer extends EventDispatcher_1.EventDispatcher {
        constructor(system, options) {
            super();
            // Support for constructor(system, screenWidth, screenHeight, options)
            // if (typeof options === 'number')
            //{
            //options = Utils.merge_options(arg3, {width: options, height: arg2 || Settings.RENDER_OPTIONS.height})            
            //}
            // Add the default render options 
            /**
             * The supplied constructor options.
             *
             * @member {Object}
             * @readOnly
             */
            this.options = options;
            /**
             * The type of the renderer.
             *
             * @member {number}
             * @default PIXI.RENDERER_TYPE.UNKNOWN
             * @see PIXI.RENDERER_TYPE
             */
            this.type = Constants_1.Constants.RENDERER_TYPE.UNKNOWN;
            /**
             * Measurements of the screen. (0, 0, screenWidth, screenHeight)
             *
             * Its safe to use as filterArea or hitArea for whole stage
             *
             * @member {PIXI.Rectangle}
             */
            this.screen = new Rectangle_1.Rectangle(0, 0, options.width, options.height);
            /**
             * The canvas element that everything is drawn to
             *
             * @member {HTMLCanvasElement}
             */
            this.view = options.view || document.createElement('canvas');
            //document.appendChild(this.view)
            document.body.appendChild(this.view);
            /**
             * The resolution / device pixel ratio of the renderer
             *
             * @member {number}
             * @default 1
             */
            this.resolution = options.resolution || StageSettings_1.StageSettings.RESOLUTION;
            /**
             * Whether the render view is transparent
             *
             * @member {boolean}
             */
            this.transparent = options.transparent;
            /**
             * Whether css dimensions of canvas view should be resized to screen dimensions automatically
             *
             * @member {boolean}
             */
            this.autoResize = options.autoResize || false;
            /**
             * Tracks the blend modes useful for this renderer.
             *
             * @member {object<string, mixed>}
             */
            this.blendModes = null;
            /**
             * The value of the preserveDrawingBuffer flag affects whether or not the contents of
             * the stencil buffer is retained after rendering.
             *
             * @member {boolean}
             */
            this.preserveDrawingBuffer = options.preserveDrawingBuffer;
            /**
             * This sets if the CanvasRenderer will clear the canvas or not before the new render pass.
             * If the scene is NOT transparent PixiJS will use a canvas sized fillRect operation every
             * frame to set the canvas background color. If the scene is transparent PixiJS will use clearRect
             * to clear the canvas every frame. Disable this by setting this to false. For example if
             * your game has a canvas filling background image you often don't need this set.
             *
             * @member {boolean}
             * @default
             */
            this.clearBeforeRender = options.clearBeforeRender;
            /**
             * If true PixiJS will Math.floor() x/y values when rendering, stopping pixel interpolation.
             * Handy for crisp pixel art and speed on legacy devices.
             *
             * @member {boolean}
             */
            this.roundPixels = options.roundPixels;
            /**
             * The background color as a number.
             *
             * @member {number}
             * @private
             */
            this._backgroundColor = 0x000000;
            /**
             * The background color as an [R, G, B] array.
             *
             * @member {number[]}
             * @private
             */
            this._backgroundColorRgba = [0, 0, 0, 0];
            /**
             * The background color as a string.
             *
             * @member {string}
             * @private
             */
            this._backgroundColorString = '#000000';
            this.backgroundColor = options.backgroundColor || this._backgroundColor; // run bg color setter
            /**
             * This temporary display object used as the parent of the currently being rendered item
             *
             * @member {PIXI.DisplayObject}
             * @private
             */
            this._tempDisplayObjectParent = new DisplayObjectContainer_1.DisplayObjectContainer();
            /**
             * The last root object that the renderer tried to render.
             *
             * @member {PIXI.DisplayObject}
             * @private
             */
            this._lastObjectRendered = this._tempDisplayObjectParent;
        }
        /**
         * Same as view.width, actual number of pixels in the canvas by horizontal
         *
         * @member {number}
         * @readonly
         * @default 800
         */
        get width() {
            return this.view.width;
        }
        /**
         * Same as view.height, actual number of pixels in the canvas by vertical
         *
         * @member {number}
         * @readonly
         * @default 600
         */
        get height() {
            return this.view.height;
        }
        /**
         * Resizes the screen and canvas to the specified width and height
         * Canvas dimensions are multiplied by resolution
         *
         * @param {number} screenWidth - the new width of the screen
         * @param {number} screenHeight - the new height of the screen
         */
        resize(screenWidth, screenHeight) {
            this.screen.width = screenWidth;
            this.screen.height = screenHeight;
            this.view.width = screenWidth * this.resolution;
            this.view.height = screenHeight * this.resolution;
            if (this.autoResize) {
                this.view.style.width = `${screenWidth}px`;
                this.view.style.height = `${screenHeight}px`;
            }
        }
        /**
         * Useful function that returns a texture of the display object that can then be used to create sprites
         * This can be quite useful if your displayObject is complicated and needs to be reused multiple times.
         *
         * @param {PIXI.DisplayObject} displayObject - The displayObject the object will be generated from
         * @param {number} scaleMode - Should be one of the scaleMode consts
         * @param {number} resolution - The resolution / device pixel ratio of the texture being generated
         * @param {PIXI.Rectangle} [region] - The region of the displayObject, that shall be rendered,
         *        if no region is specified, defaults to the local bounds of the displayObject.
         * @return {PIXI.Texture} a texture of the graphics object
         */
        generateTexture(displayObject, scaleMode, resolution, region) {
            region = region || displayObject.getLocalBounds();
            const renderTexture = RenderTexture_1.RenderTexture.create(region.width | 0, region.height | 0, scaleMode, resolution);
            SystemRenderer.tempMatrix.tx = -region.x;
            SystemRenderer.tempMatrix.ty = -region.y;
            this.render(displayObject, renderTexture, false, SystemRenderer.tempMatrix, true);
            return renderTexture;
        }
        render(displayObject, renderTexture, clear, transform, skipUpdateTransform) {
        }
        /**
         * Removes everything from the renderer and optionally removes the Canvas DOM element.
         *
         * @param {boolean} [removeView=false] - Removes the Canvas element from the DOM.
         */
        destroy(removeView) {
            if (removeView && this.view.parentNode) {
                this.view.parentNode.removeChild(this.view);
            }
            this.type = Constants_1.Constants.RENDERER_TYPE.UNKNOWN;
            this.view = null;
            this.screen = null;
            this.resolution = 0;
            this.transparent = false;
            this.autoResize = false;
            this.blendModes = null;
            this.options = null;
            this.preserveDrawingBuffer = false;
            this.clearBeforeRender = false;
            this.roundPixels = false;
            this._backgroundColor = 0;
            this._backgroundColorRgba = null;
            this._backgroundColorString = null;
            this._tempDisplayObjectParent = null;
            this._lastObjectRendered = null;
        }
        /**
         * The background color to fill if not transparent
         *
         * @member {number}
         */
        get backgroundColor() {
            return this._backgroundColor;
        }
        set backgroundColor(value) {
            this._backgroundColor = value;
            this._backgroundColorString = Utils_1.Utils.hex2string(value);
            Utils_1.Utils.hex2rgb(value, this._backgroundColorRgba);
        }
    }
    SystemRenderer.tempMatrix = new Matrix_1.Matrix();
    exports.SystemRenderer = SystemRenderer;
});
