define(["require", "exports", "flash/events/EventDispatcher"], function (require, exports, EventDispatcher_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class LoaderInfo extends EventDispatcher_1.EventDispatcher {
        constructor() {
            super();
            this._url = '';
            this._loaderURL = '';
            this._loader = null;
            this._content = null;
        }
        get url() {
            return this._url;
        }
        get loaderURL() {
            return this._loaderURL;
        }
        get loader() {
            return this._loader;
        }
        get content() {
            return this._content;
        }
        get width() {
            if (this._content) {
                return this._content.width;
            }
            return 0;
        }
        get height() {
            if (this._content) {
                return this._content.height;
            }
            return 0;
        }
    }
    exports.LoaderInfo = LoaderInfo;
});
