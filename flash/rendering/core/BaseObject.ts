
import { Tracer } from "flash/Tracer";

export class BaseObject
{
    private static instanceid:number = 0;
    protected _instanceName:string;
    protected _name:string;

    constructor()
    {
        this._instanceName = "instance_" + BaseObject.instanceid.toString();
        this._name = this.className + "_" + BaseObject.instanceid.toString();
        BaseObject.instanceid++;
    }

    public get instanceName():string
    {
        return this._instanceName;
    }

    public get className():string
    {
        return this.constructor.name;
    }

    public show(value:any):void
    {
        Tracer.show(value);
    }

    public static show(value:any):void
    {
        Tracer.show(value);
    }

    public reveal(value:any):void
    {
        Tracer.reveal(value);
    }

    public static reveal(value:any):void
    {
        Tracer.show(value);
    }

    public revealMethods(value:any):void
    {
        Tracer.revealMethods(value);
    }

    public static revealMethods(value:any):void
    {
        Tracer.revealMethods(value);
    }

    public getProperty(source:any, property:string):any
    {
        return BaseObject.getProperty(source, property);
    }

    public static getProperty(source:any, property:string):any
    {
        if(source[property] != null)
        {
            return source[property];
        }
        return null;
    }
}