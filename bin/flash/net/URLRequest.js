define(["require", "exports", "flash/display/BaseObject", "flash/net/URLRequestMethod"], function (require, exports, BaseObject_1, URLRequestMethod_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class URLRequest extends BaseObject_1.BaseObject {
        constructor(url = null) {
            super();
            this._contentType = null;
            this._data = null;
            this._method = URLRequestMethod_1.URLRequestMethod.GET;
            this._url = url;
        }
        get contentType() {
            return this._contentType;
        }
        set contentType(value) {
            this._contentType = value;
        }
        get data() {
            return this._data;
        }
        set data(value) {
            this._data = value;
        }
        get method() {
            return this._method;
        }
        set method(value) {
            this._method = value;
        }
        get url() {
            return this._url;
        }
        set url(value) {
            this._url = value;
        }
    }
    exports.URLRequest = URLRequest;
});
//# sourceMappingURL=URLRequest.js.map