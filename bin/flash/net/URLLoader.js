define(["require", "exports", "flash/events/EventDispatcher", "flash/net/URLLoaderDataFormat", "flash/events/ProgressEvent", "flash/events/Event"], function (require, exports, EventDispatcher_1, URLLoaderDataFormat_1, ProgressEvent_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class URLLoader extends EventDispatcher_1.EventDispatcher {
        constructor(request = null) {
            super();
            this.handleTimeOut = (event, loader) => {
                //this.show("timeout")
                //this.reveal(event)
            };
            this.handleReadyStateChange = (event, loader) => {
                if (this._loadingComplete) {
                    return;
                }
                if (loader.readyState == 4) {
                    this.parseData(event, loader);
                }
            };
            this.handleProgress = (event, loader) => {
                this.bytesTotal = event.total;
                this.bytesLoaded = event.loaded;
                if (!this._eventProgress) {
                    this._eventProgress = new ProgressEvent_1.ProgressEvent(ProgressEvent_1.ProgressEvent.PROGRESS);
                }
                this._eventProgress.bytesLoaded = this.bytesLoaded;
                this._eventProgress.bytesTotal = this.bytesTotal;
                this.dispatchEvent(this._eventProgress);
            };
            this.handleStart = (event, loader) => {
                //this.show("start")
                //this.reveal(event)
            };
            this.handleError = (event, loader) => {
                //this.show("error")
                //this.reveal(event)
            };
            this.handleAbort = (event, loader) => {
                //this.show("abort")
                //this.reveal(event)
            };
            this.handleDataLoaded = (event, loader) => {
                if (this._loadingComplete) {
                    return;
                }
                if (loader.status && loader.status == 200) {
                    this.parseData(event, loader);
                }
            };
            this.bytesLoaded = 0;
            this.bytesTotal = 0;
            this.data = null;
            this.dataFormat = null;
            this._request = request;
            this.dataFormat = URLLoaderDataFormat_1.URLLoaderDataFormat.TEXT;
            this._loadingComplete = false;
        }
        close() {
        }
        load(request) {
            this._request = request;
            var xhr = new XMLHttpRequest();
            xhr.open(this._request.method, this._request.url, true);
            xhr.responseType = this.dataFormat;
            var scope = this;
            xhr.onload = function (e) { scope.handleDataLoaded(event, this); };
            xhr.onabort = function (e) { scope.handleAbort(event, this); };
            xhr.onerror = function (e) { scope.handleError(event, this); };
            xhr.onloadstart = function (e) { scope.handleStart(event, this); };
            xhr.onprogress = function (e) { scope.handleProgress(event, this); };
            xhr.onreadystatechange = function (e) { scope.handleReadyStateChange(event, this); };
            xhr.ontimeout = function (e) { scope.handleTimeOut(event, this); };
            xhr.send();
        }
        parseData(event, loader) {
            this._loadingComplete = true;
            if (this.dataFormat == URLLoaderDataFormat_1.URLLoaderDataFormat.BLOB) {
                var blob = new Blob([loader.response], { type: 'image/png' });
                this.data = blob;
            }
            if (!this._eventComplete) {
                this._eventComplete = new Event_1.Event(Event_1.Event.COMPLETE);
            }
            this.dispatchEvent(this._eventComplete);
        }
    }
    exports.URLLoader = URLLoader;
});
//# sourceMappingURL=URLLoader.js.map