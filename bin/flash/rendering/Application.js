define(["require", "exports", "./webgl/Utils", "flash/display/DisplayObjectContainer", "./time/Ticker", "./managers/Constants", "./webgl/WebGLRenderer"], function (require, exports, Utils_1, DisplayObjectContainer_1, Ticker_1, Constants_1, WebGLRenderer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Application {
        constructor(options = null) {
            this._options = Utils_1.Utils.merge_options({
                autoStart: true,
                sharedTicker: false,
                forceCanvas: false,
                sharedLoader: false,
            }, options);
            this.renderer = new WebGLRenderer_1.WebGLRenderer(options);
            this.stage = new DisplayObjectContainer_1.DisplayObjectContainer();
            this.ticker = Ticker_1.Ticker.shared;
            if (options.autoStart) {
                this.start();
            }
        }
        set ticker(ticker) {
            if (this._ticker) {
                this._ticker.remove(this.render, this);
            }
            this._ticker = ticker;
            if (ticker) {
                ticker.add(this.render, this, Constants_1.Constants.UPDATE_PRIORITY.LOW);
            }
        }
        get ticker() {
            return this._ticker;
        }
        render() {
            this.renderer.render(this.stage);
        }
        /**
         * Convenience method for stopping the render.
         */
        stop() {
            this._ticker.stop();
        }
        /**
         * Convenience method for starting the render.
         */
        start() {
            this._ticker.start();
        }
        /**
         * Reference to the renderer's canvas element.
         * @member {HTMLCanvasElement}
         * @readonly
         */
        get view() {
            return this.renderer.view;
        }
        /**
         * Reference to the renderer's screen rectangle. Its safe to use as filterArea or hitArea for whole screen
         * @member {PIXI.Rectangle}
         * @readonly
         */
        get screen() {
            return this.renderer.screen;
        }
        /**
         * Destroy and don't use after this.
         * @param {Boolean} [removeView=false] Automatically remove canvas from DOM.
         */
        destroy(removeView) {
            if (this._ticker) {
                const oldTicker = this._ticker;
                this.ticker = null;
                oldTicker.destroy();
            }
            this.stage.destroy();
            this.stage = null;
            this.renderer.destroy(removeView);
            this.renderer = null;
            this._options = null;
        }
    }
    exports.Application = Application;
});
