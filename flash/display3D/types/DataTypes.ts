import { BaseTexture } from "flash/rendering/textures/BaseTexture";
import { BaseObject } from "flash/display/BaseObject";


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