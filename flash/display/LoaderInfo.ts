import { EventDispatcher } from "flash/events/EventDispatcher";
import { DisplayObject } from "flash/display/DisplayObject";
import { Loader } from "flash/display/Loader";

export class LoaderInfo extends EventDispatcher
{
    protected _content:DisplayObject;
    protected _loader:Loader;
    protected _loaderURL:string;
    protected _url:string;

    constructor()
    {
        super();
        this._url = '';
        this._loaderURL = '';
        this._loader = null;
        this._content = null;
    }

    public get url():string
    {
        return this._url;
    }

    public get loaderURL():string
    {
        return this._loaderURL;
    }

    public get loader():Loader
    {
        return this._loader;
    }

    public get content():DisplayObject
    {
        return this._content;
    }

    public get width():number
    {
        if(this._content)
        {
            return this._content.width;
        }
        return 0;
    }

    public get height():number
    {
        if(this._content)
        {
            return this._content.height;
        }
        return 0;
    }
}