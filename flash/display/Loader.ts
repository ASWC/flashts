import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { DisplayObject } from "flash/display/DisplayObject";
import { LoaderInfo } from "flash/display/LoaderInfo";
import { LoaderContext } from "flash/system/LoaderContext";
import { URLRequest } from "flash/net/URLRequest";

export class Loader extends DisplayObjectContainer
{
    protected _content:DisplayObject;
    protected _contentLoaderInfo:LoaderInfo;
    protected _request:URLRequest;

    constructor()
    {
        super();
        this._content = null;
        this._contentLoaderInfo = null;
    }

    public unload():void
    {

    }

    public load(request:URLRequest, context:LoaderContext = null):void
    {
        this._request = request;
    }

    public close():void
    {

    }

    public get contentLoaderInfo():LoaderInfo
    {
        if(!this._contentLoaderInfo)
        {
            this._contentLoaderInfo = new LoaderInfo();            
        }
        return this._contentLoaderInfo;
    }

    public get content():DisplayObject
    {
        return this._content;
    }
}