import { BaseObject } from "flash/display/BaseObject";
import { URLRequestMethod } from "flash/net/URLRequestMethod";

export class URLRequest extends BaseObject
{
    protected _contentType:string;
    protected _data:any;
    protected _method:string;
    protected _url:string;

    constructor(url:string = null)
    {
        super();
        this._contentType = null;
        this._data = null;
        this._method = URLRequestMethod.GET;
        this._url = url;
    }

    public get contentType():string
    {
        return this._contentType;
    }

    public set contentType(value:string)
    {
        this._contentType = value;
    }

    public get data():any
    {
        return this._data;
    }

    public set data(value:any)
    {
        this._data = value;
    }

    public get method():string
    {
        return this._method;
    }

    public set method(value:string)
    {
        this._method = value;
    }

    public get url():string
    {
        return this._url;
    }

    public set url(value:string)
    {
        this._url = value;
    }
}