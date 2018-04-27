define(["require", "exports", "../managers/Constants", "flash/utils/Timer", "flash/display/DisplayObjectContainer", "../textures/Texture", "../textures/BaseTexture", "../../text/TextStyle", "../../text/TextMetrics", "flash/rendering/display/Text"], function (require, exports, Constants_1, Timer_1, DisplayObjectContainer_1, Texture_1, BaseTexture_1, TextStyle_1, TextMetrics_1, Text_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BasePrepare {
        constructor(renderer) {
            /**
             * The limiter to be used to control how quickly items are prepared.
             * @type {PIXI.prepare.CountLimiter|PIXI.prepare.TimeLimiter}
             */
            this.limiter = new CountLimiter(BasePrepare.UPLOADS_PER_FRAME);
            /**
             * Reference to the renderer.
             * @type {PIXI.SystemRenderer}
             * @protected
             */
            this.renderer = renderer;
            /**
             * The only real difference between CanvasPrepare and WebGLPrepare is what they pass
             * to upload hooks. That different parameter is stored here.
             * @type {PIXI.prepare.CanvasPrepare|PIXI.WebGLRenderer}
             * @protected
             */
            this.uploadHookHelper = null;
            /**
             * Collection of items to uploads at once.
             * @type {Array<*>}
             * @private
             */
            this.queue = [];
            /**
             * Collection of additional hooks for finding assets.
             * @type {Array<Function>}
             * @private
             */
            this.addHooks = [];
            /**
             * Collection of additional hooks for processing assets.
             * @type {Array<Function>}
             * @private
             */
            this.uploadHooks = [];
            /**
             * Callback to call after completed.
             * @type {Array<Function>}
             * @private
             */
            this.completes = [];
            /**
             * If prepare is ticking (running).
             * @type {boolean}
             * @private
             */
            this.ticking = false;
            /**
             * 'bound' call for prepareItems().
             * @type {Function}
             * @private
             */
            this.delayedTick = () => {
                // unlikely, but in case we were destroyed between tick() and delayedTick()
                if (!this.queue) {
                    return;
                }
                this.prepareItems();
            };
            // hooks to find the correct texture
            this.registerFindHook(this.findText);
            this.registerFindHook(this.findTextStyle);
            this.registerFindHook(this.findMultipleBaseTextures);
            this.registerFindHook(this.findBaseTexture);
            this.registerFindHook(this.findTexture);
            // upload hooks
            this.registerUploadHook(this.drawText);
            this.registerUploadHook(this.calculateTextStyle);
        }
        /**
         * Upload all the textures and graphics to the GPU.
         *
         * @param {Function|PIXI.DisplayObject|PIXI.Container|PIXI.BaseTexture|PIXI.Texture|PIXI.Graphics|PIXI.Text} item -
         *        Either the container or display object to search for items to upload, the items to upload themselves,
         *        or the callback function, if items have been added using `prepare.add`.
         * @param {Function} [done] - Optional callback when all queued uploads have completed
         */
        upload(item, done) {
            if (typeof item === 'function') {
                done = item;
                item = null;
            }
            // If a display object, search for items
            // that we could upload
            if (item) {
                this.add(item);
            }
            // Get the items for upload from the display
            if (this.queue.length) {
                if (done) {
                    this.completes.push(done);
                }
                if (!this.ticking) {
                    this.ticking = true;
                    Timer_1.Timer.shared.addOnce(this.tick, this, Constants_1.Constants.UPDATE_PRIORITY.UTILITY);
                }
            }
            else if (done) {
                done();
            }
        }
        /**
         * Handle tick update
         *
         * @private
         */
        tick() {
            setTimeout(this.delayedTick, 0);
        }
        /**
         * Actually prepare items. This is handled outside of the tick because it will take a while
         * and we do NOT want to block the current animation frame from rendering.
         *
         * @private
         */
        prepareItems() {
            this.limiter.beginFrame();
            // Upload the graphics
            while (this.queue.length && this.limiter.allowedToUpload()) {
                const item = this.queue[0];
                let uploaded = false;
                if (item && !item._destroyed) {
                    for (let i = 0, len = this.uploadHooks.length; i < len; i++) {
                        if (this.uploadHooks[i](this.uploadHookHelper, item)) {
                            this.queue.shift();
                            uploaded = true;
                            break;
                        }
                    }
                }
                if (!uploaded) {
                    this.queue.shift();
                }
            }
            // We're finished
            if (!this.queue.length) {
                this.ticking = false;
                const completes = this.completes.slice(0);
                this.completes.length = 0;
                for (let i = 0, len = completes.length; i < len; i++) {
                    completes[i]();
                }
            }
            else {
                // if we are not finished, on the next rAF do this again
                Timer_1.Timer.shared.addOnce(this.tick, this, Constants_1.Constants.UPDATE_PRIORITY.UTILITY);
            }
        }
        /**
         * Adds hooks for finding items.
         *
         * @param {Function} addHook - Function call that takes two parameters: `item:*, queue:Array`
         *          function must return `true` if it was able to add item to the queue.
         * @return {PIXI.BasePrepare} Instance of plugin for chaining.
         */
        registerFindHook(addHook) {
            if (addHook) {
                this.addHooks.push(addHook);
            }
            return this;
        }
        /**
         * Adds hooks for uploading items.
         *
         * @param {Function} uploadHook - Function call that takes two parameters: `prepare:CanvasPrepare, item:*` and
         *          function must return `true` if it was able to handle upload of item.
         * @return {PIXI.BasePrepare} Instance of plugin for chaining.
         */
        registerUploadHook(uploadHook) {
            if (uploadHook) {
                this.uploadHooks.push(uploadHook);
            }
            return this;
        }
        /**
         * Manually add an item to the uploading queue.
         *
         * @param {PIXI.DisplayObject|PIXI.Container|PIXI.BaseTexture|PIXI.Texture|PIXI.Graphics|PIXI.Text|*} item - Object to
         *        add to the queue
         * @return {PIXI.CanvasPrepare} Instance of plugin for chaining.
         */
        add(item) {
            // Add additional hooks for finding elements on special
            // types of objects that
            for (let i = 0, len = this.addHooks.length; i < len; i++) {
                if (this.addHooks[i](item, this.queue)) {
                    break;
                }
            }
            // Get childen recursively
            if (item instanceof DisplayObjectContainer_1.DisplayObjectContainer) {
                for (let i = item.numChildren - 1; i >= 0; i--) {
                    this.add(item.getChildAt[i]);
                }
            }
            return this;
        }
        /**
         * Destroys the plugin, don't use after this.
         *
         */
        destroy() {
            if (this.ticking) {
                Timer_1.Timer.shared.remove(this.tick, this);
            }
            this.ticking = false;
            this.addHooks = null;
            this.uploadHooks = null;
            this.renderer = null;
            this.completes = null;
            this.queue = null;
            this.limiter = null;
            this.uploadHookHelper = null;
        }
        /**
         * Built-in hook to find multiple textures from objects like AnimatedSprites.
         *
         * @private
         * @param {PIXI.DisplayObject} item - Display object to check
         * @param {Array<*>} queue - Collection of items to upload
         * @return {boolean} if a PIXI.Texture object was found.
         */
        static findMultipleBaseTextures(item, queue) {
            let result = false;
            // Objects with mutliple textures
            if (item && item._textures && item._textures.length) {
                for (let i = 0; i < item._textures.length; i++) {
                    if (item._textures[i] instanceof Texture_1.Texture) {
                        const baseTexture = item._textures[i].baseTexture;
                        if (queue.indexOf(baseTexture) === -1) {
                            queue.push(baseTexture);
                            result = true;
                        }
                    }
                }
            }
            return result;
        }
        /**
         * Built-in hook to find BaseTextures from Sprites.
         *
         * @private
         * @param {PIXI.DisplayObject} item - Display object to check
         * @param {Array<*>} queue - Collection of items to upload
         * @return {boolean} if a PIXI.Texture object was found.
         */
        static findBaseTexture(item, queue) {
            // Objects with textures, like Sprites/Text
            if (item instanceof BaseTexture_1.BaseTexture) {
                if (queue.indexOf(item) === -1) {
                    queue.push(item);
                }
                return true;
            }
            return false;
        }
        /**
         * Built-in hook to find textures from objects.
         *
         * @private
         * @param {PIXI.DisplayObject} item - Display object to check
         * @param {Array<*>} queue - Collection of items to upload
         * @return {boolean} if a PIXI.Texture object was found.
         */
        static findTexture(item, queue) {
            if (item._texture && item._texture instanceof Texture_1.Texture) {
                const texture = item._texture.baseTexture;
                if (queue.indexOf(texture) === -1) {
                    queue.push(texture);
                }
                return true;
            }
            return false;
        }
        /**
         * Built-in hook to draw PIXI.Text to its texture.
         *
         * @private
         * @param {PIXI.WebGLRenderer|PIXI.CanvasPrepare} helper - Not used by this upload handler
         * @param {PIXI.DisplayObject} item - Item to check
         * @return {boolean} If item was uploaded.
         */
        static drawText(helper, item) {
            if (item instanceof Text_1.Text) {
                // updating text will return early if it is not dirty
                item.updateText(true);
                return true;
            }
            return false;
        }
        /**
         * Built-in hook to calculate a text style for a PIXI.Text object.
         *
         * @private
         * @param {PIXI.WebGLRenderer|PIXI.CanvasPrepare} helper - Not used by this upload handler
         * @param {PIXI.DisplayObject} item - Item to check
         * @return {boolean} If item was uploaded.
         */
        static calculateTextStyle(helper, item) {
            if (item instanceof TextStyle_1.TextStyle) {
                const font = item.toFontString();
                TextMetrics_1.TextMetrics.measureFont(font);
                return true;
            }
            return false;
        }
        /**
         * Built-in hook to find Text objects.
         *
         * @private
         * @param {PIXI.DisplayObject} item - Display object to check
         * @param {Array<*>} queue - Collection of items to upload
         * @return {boolean} if a PIXI.Text object was found.
         */
        static findText(item, queue) {
            if (item instanceof Text_1.Text) {
                // push the text style to prepare it - this can be really expensive
                if (queue.indexOf(item.style) === -1) {
                    queue.push(item.style);
                }
                // also push the text object so that we can render it (to canvas/texture) if needed
                if (queue.indexOf(item) === -1) {
                    queue.push(item);
                }
                // also push the Text's texture for upload to GPU
                const texture = item.texture.baseTexture;
                if (queue.indexOf(texture) === -1) {
                    queue.push(texture);
                }
                return true;
            }
            return false;
        }
        /**
         * Built-in hook to find TextStyle objects.
         *
         * @private
         * @param {PIXI.TextStyle} item - Display object to check
         * @param {Array<*>} queue - Collection of items to upload
         * @return {boolean} if a PIXI.TextStyle object was found.
         */
        static findTextStyle(item, queue) {
            if (item instanceof TextStyle_1.TextStyle) {
                if (queue.indexOf(item) === -1) {
                    queue.push(item);
                }
                return true;
            }
            return false;
        }
    }
    BasePrepare.UPLOADS_PER_FRAME = 4;
    exports.BasePrepare = BasePrepare;
    class CountLimiter {
        /**
         * @param {number} maxItemsPerFrame - The maximum number of items that can be prepared each frame.
         */
        constructor(maxItemsPerFrame) {
            /**
             * The maximum number of items that can be prepared each frame.
             * @private
             */
            this.maxItemsPerFrame = maxItemsPerFrame;
            /**
             * The number of items that can be prepared in the current frame.
             * @type {number}
             * @private
             */
            this.itemsLeft = 0;
        }
        /**
         * Resets any counting properties to start fresh on a new frame.
         */
        beginFrame() {
            this.itemsLeft = this.maxItemsPerFrame;
        }
        /**
         * Checks to see if another item can be uploaded. This should only be called once per item.
         * @return {boolean} If the item is allowed to be uploaded.
         */
        allowedToUpload() {
            return this.itemsLeft-- > 0;
        }
    }
});
