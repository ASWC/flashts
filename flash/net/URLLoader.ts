import { EventDispatcher } from "flash/events/EventDispatcher";
import { URLRequest } from "flash/net/URLRequest";
import { URLLoaderDataFormat } from "flash/net/URLLoaderDataFormat";
import { ProgressEvent } from "flash/events/ProgressEvent";
import { Event } from "flash/events/Event";
import { IOErrorEvent } from "flash/events/IOErrorEvent";

export class URLLoader extends EventDispatcher
{
    public bytesLoaded:number;
    public bytesTotal:number;
    public data:any;
    public dataFormat:string;
    protected _request:URLRequest;
    protected _eventProgress:ProgressEvent;
    protected _eventComplete:Event;
    protected _eventError:IOErrorEvent;
    protected _loadingComplete:boolean;

    constructor(request:URLRequest = null)
    {
        super();
        this.bytesLoaded = 0;
        this.bytesTotal = 0;
        this.data = null;
        this.dataFormat = null;
        this._request = request;
        this.dataFormat = URLLoaderDataFormat.TEXT;
        this._loadingComplete = false;
    }

    public close():void
    {

    }

    public load(request:URLRequest):void
    {
        this._request = request;
        var xhr = new XMLHttpRequest();
        xhr.open(this._request.method, this._request.url, true);        
        xhr.responseType = <XMLHttpRequestResponseType> this.dataFormat;
        var scope:URLLoader = this;
        xhr.onload = function(e) { scope.handleDataLoaded(event, this); }
        xhr.onabort = function(e) { scope.handleAbort(event, this); }
        xhr.onerror = function(e) { scope.handleError(event, this); }
        xhr.onloadstart = function(e) { scope.handleStart(event, this); }
        xhr.onprogress = function(e) { scope.handleProgress(event, this); }
        xhr.onreadystatechange = function(e) { scope.handleReadyStateChange(event, this); }
        xhr.ontimeout = function(e) { scope.handleTimeOut(event, this); }
        xhr.send();
    }

    protected handleTimeOut = (event, loader:XMLHttpRequest)=>
    {
        //this.show("timeout")
        //this.reveal(event)
    }

    protected handleReadyStateChange = (event, loader:XMLHttpRequest)=>
    {
        if(this._loadingComplete)
        {
            return;
        }
        if(loader.readyState == 4)
        {
            this.parseData(event, loader);
        }
    }

    protected handleProgress = (event, loader:XMLHttpRequest)=>
    {
        this.bytesTotal = event.total;
        this.bytesLoaded = event.loaded;
        if(!this._eventProgress)
        {
            this._eventProgress = new ProgressEvent(ProgressEvent.PROGRESS);
        }
        this._eventProgress.bytesLoaded = this.bytesLoaded;
        this._eventProgress.bytesTotal = this.bytesTotal;
        this.dispatchEvent(this._eventProgress);
    }

    protected handleStart = (event, loader:XMLHttpRequest)=>
    {
        //this.show("start")
        //this.reveal(event)
    }

    protected handleError = (event, loader:XMLHttpRequest)=>
    {
        //this.show("error")
        //this.reveal(event)
    }

    protected handleAbort = (event, loader:XMLHttpRequest)=>
    {
        //this.show("abort")
        //this.reveal(event)
    }

    protected handleDataLoaded = (event, loader:XMLHttpRequest)=>
    {
        if(this._loadingComplete)
        {
            return;
        }
        if(loader.status && loader.status == 200)
        {
            this.parseData(event, loader);
        }
    }

    protected parseData(event, loader:XMLHttpRequest):void
    {
        this._loadingComplete = true;
        if(this.dataFormat == URLLoaderDataFormat.BLOB)
        {
            var blob = new Blob([loader.response], {type: 'image/png'});
            this.data = blob;
        }           
        if(!this._eventComplete)
        {
            this._eventComplete = new Event(Event.COMPLETE);
        }
        this.dispatchEvent(this._eventComplete);
    }
}