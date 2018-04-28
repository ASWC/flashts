import { BaseTexture } from "flash/rendering/textures/BaseTexture";
import { BaseObject } from "flash/display/BaseObject";
import { ShaderUnnifromDataDictionary } from "flash/display3D/types/DataDictionaries";
import { GLShader } from "../GLShader";


export class AttributeState
{
    public tempAttribState:Array<number>;
    public attribState:Array<number>;

    constructor(arraylength:number)
    {
        this.tempAttribState = new Array(arraylength);
        this.attribState = new Array(arraylength);
    }
}

export class GLAttributeData
{
    public type:string;
    public size:number;
    public location:number;
    public pointer:Function;

    constructor(type:string, size:number, location:number, pointer:Function)
    {
        this.size = size;
        this.type = type;
        this.location = location;
        this.pointer = pointer;
    }
}


export class ShaderUnniformAccess
{
    public data:ShaderUnnifromDataDictionary;
    public gl:WebGLRenderingContext; 
    public _uSamplers:number[];
    public _projectionMatrix:number[]|Float32Array;
    public _translationMatrix:number[]|Float32Array;
    public _tint:number[];
    public _alpha:number;
     
    constructor(gl:WebGLRenderingContext)
    {
        this.gl = gl;
        this.data = {};        
    }

    public update(value:string, data:any):void
    {
        var format:ShaderUnniformData = this.data[value];
        var location:WebGLUniformLocation = format.location;
        if (format.size === 1)
        {
            GLShader.GLSL_SINGLE_SETTERS[format.type](this.gl, location, data);
        }
        else
        {
            GLShader.GLSL_ARRAY_SETTERS[format.type](this.gl, location, data);
        }
    }

    public set translationMatrix(value:number[]|Float32Array)
    {
        this._translationMatrix = value;
        this.update("translationMatrix", value);        
    }

    public set projectionMatrix(value:number[]|Float32Array)
    {
        this._projectionMatrix = value;
        this.update("projectionMatrix", value);        
    }

    public set alpha(value:number)
    {
        this._alpha = value;
        this.update("alpha", value);        
    }

    public set tint(value:number[])
    {
        this._tint = value;
        this.update("tint", value);        
    }

    public set uSamplers(value:number[])
    {
        this._uSamplers = value;
        this.update("uSamplers", value);        
    }    

    public get projectionMatrix():number[]|Float32Array
    {
        return this._projectionMatrix;
    }
    public get translationMatrix():number[]|Float32Array
    {
        return this._translationMatrix;
    }
    public get tint():number[]
    {
        return this._tint;
    }
    public get alpha():number
    {
        return this._alpha;
    }
    public get uSamplers():number[]
    {
        return this._uSamplers;
    }
}

export class ShaderUnniformData
{
    public type:string;
    public size:number;
    public location:WebGLUniformLocation;
    public value:Float32Array|number|Int32Array|boolean|Array<boolean>;

    constructor(type:string, size:number, location:WebGLUniformLocation, value:Float32Array|number|Int32Array|boolean|Array<boolean>)
    {
        this.location = location;
        this.size = size;
        this.type = type;
        this.value = value;
    }
}

export class SpriteDataGroup
{
    public textures:BaseTexture[];
    public textureCount:number;
    public ids:number[];
    public size:number;
    public start:number;
    public blend:number;

    constructor()
    {
        this.textures = [];
        this.textureCount = 0;
        this.ids = [];
        this.size = 0;
        this.start = 0;
        this.blend = 0;
    }
}

export class TextureGroupItem extends BaseObject
{
    public textureCount:number;
    public size:number;
    public start:number;
    public blend:number;
    public textures:BaseTexture[];
    public ids:number[];

    constructor()
    {
        super();
        this.textureCount = 0;
        this.size = 0;
        this.start = 0;
        this.blend = 0;
        this.textures = [];
        this.ids = [];
    }
}