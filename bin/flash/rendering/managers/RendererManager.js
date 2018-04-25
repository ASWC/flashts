define(["require", "exports", "../core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RendererManager extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this._registeredContexts = [];
            this._registeredRenderers = [];
        }
        hasRenderer(renderer) {
            var index = this._registeredRenderers.indexOf(renderer);
            if (index >= 0) {
                return true;
            }
            return false;
        }
        removeRenderer(renderer) {
            var index = this._registeredRenderers.indexOf(renderer);
            if (index >= 0) {
                this._registeredRenderers.splice(index, 1);
            }
            for (var i = 0; i < this._registeredContexts.length; i++) {
                //this._registeredContexts[i].removeRenderer(renderer);
            }
        }
        addRenderer(renderer) {
            if (this.hasRenderer(renderer)) {
                return;
            }
            var index = this._registeredRenderers.indexOf(renderer);
            if (index < 0) {
                this._registeredRenderers.push(renderer);
            }
            for (var i = 0; i < this._registeredContexts.length; i++) {
                //this._registeredContexts[i].addRenderer(renderer);
            }
        }
        removeContext(context) {
            var index = this._registeredContexts.indexOf(context);
            if (index >= 0) {
                this._registeredContexts.splice(index, 1);
            }
        }
        addContext(context) {
            var index = this._registeredContexts.indexOf(context);
            if (index >= 0) {
                return;
            }
            this._registeredContexts.push(context);
        }
        static get manager() {
            if (!RendererManager._manager) {
                RendererManager._manager = new RendererManager();
            }
            return RendererManager._manager;
        }
    }
    exports.RendererManager = RendererManager;
});
