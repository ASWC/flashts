define(["require", "exports", "flash/display/DisplayObjectContainer", "flash/display/LoaderInfo"], function (require, exports, DisplayObjectContainer_1, LoaderInfo_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // TYPED
    // TO IMPLEMENT
    class Loader extends DisplayObjectContainer_1.DisplayObjectContainer {
        constructor() {
            super();
            this._content = null;
            this._contentLoaderInfo = null;
        }
        unload() {
        }
        load(request, context = null) {
            this._request = request;
        }
        close() {
        }
        get contentLoaderInfo() {
            if (!this._contentLoaderInfo) {
                this._contentLoaderInfo = new LoaderInfo_1.LoaderInfo();
            }
            return this._contentLoaderInfo;
        }
        get content() {
            return this._content;
        }
    }
    exports.Loader = Loader;
});
//# sourceMappingURL=Loader.js.map