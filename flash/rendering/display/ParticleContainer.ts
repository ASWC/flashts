import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { Constants } from "../managers/Constants";
import { Utils } from "../webgl/Utils";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { Bitmap } from "flash/display/Bitmap";
import { DisplayObject } from "flash/display/DisplayObject";
import { Event } from "flash/events/Event";
import { ParticleRenderer } from "../webgl/ParticleRenderer";

export class ParticleContainer extends DisplayObjectContainer
{
    public _properties:boolean[];
    public _maxSize:number;
    public _updateID:number;
    public roundPixels:boolean;
    public _batchSize:number;
    public _glBuffers:any;
    public _tint:number;
    public _bufferUpdateIDs:number[];
    public autoResize:boolean;
    public baseTexture:BaseTexture;
    public tintRgb:number[];
    public blendMode:number;
    public _buffers:any;

    constructor(maxSize:number = 1500, properties:any, batchSize:number = 16384, autoResize:boolean = false)
    {
        super();
        const maxBatchSize = 16384;
        if (batchSize > maxBatchSize)
        {
            batchSize = maxBatchSize;
        }
        if (batchSize > maxSize)
        {
            batchSize = maxSize;
        }
        this._properties = [false, true, false, false, false];
        this._maxSize = maxSize;
        this._batchSize = batchSize;
        /**
         * @member {object<number, WebGLBuffer>}
         * @private
         */
        this._glBuffers = {};
        this._bufferUpdateIDs = [];
        this._updateID = 0;
        this.interactiveChildren = false;
        this.blendMode = Constants.BLEND_MODES.NORMAL;
        this.autoResize = autoResize;
        this.roundPixels = true;
        this.baseTexture = null;
        this.setProperties(properties);
        this._tint = 0xFFFFFF;
        this.tintRgb = [];
    }

    public setProperties(properties:any):void
    {
        if (properties)
        {
            this._properties[0] = 'vertices' in properties || 'scale' in properties
                ? !!properties.vertices || !!properties.scale : this._properties[0];
            this._properties[1] = 'position' in properties ? !!properties.position : this._properties[1];
            this._properties[2] = 'rotation' in properties ? !!properties.rotation : this._properties[2];
            this._properties[3] = 'uvs' in properties ? !!properties.uvs : this._properties[3];
            this._properties[4] = 'tint' in properties || 'alpha' in properties
                ? !!properties.tint || !!properties.alpha : this._properties[4];
        }
    }

    public updateTransform():void
    {
        this.updateTransform();
    }

    public get tint():number
    {
        return this._tint;
    }

    public set tint(value:number) 
    {
        this._tint = value;
        Utils.hex2rgb(value, this.tintRgb);
    }

    public renderWebGL():void
    {
        if(!this.stage)
        {
            return;
        }
        if (!this.visible || this.worldAlpha <= 0 || !this.children.length || !this.renderable)
        {
            return;
        }
        if (!this.baseTexture)
        {
            var sprite:DisplayObject = this.children[0];
            if(sprite instanceof Bitmap)
            {                
                this.baseTexture = sprite.texture.baseTexture;
                if (!this.baseTexture.hasLoaded)
                {
                    this.baseTexture.addEventListener(Event.CHANGE, this.onChildrenChange, this);
                }
            }
            
        }
        ParticleRenderer
        this.stage.setObjectRenderer(ParticleRenderer.renderer);
        if(this instanceof DisplayObject)
        {
            ParticleRenderer.renderer.render(this);
        }
        
    }

    public onChildrenChange(smallestChildIndex:number):void
    {
        const bufferIndex = Math.floor(smallestChildIndex / this._batchSize);
        while (this._bufferUpdateIDs.length < bufferIndex)
        {
            this._bufferUpdateIDs.push(0);
        }
        this._bufferUpdateIDs[bufferIndex] = ++this._updateID;
    }

    public destroy():void
    {
        super.destroy();
        if (this._buffers)
        {
            for (let i = 0; i < this._buffers.length; ++i)
            {
                this._buffers[i].destroy();
            }
        }
        this._properties = null;
        this._buffers = null;
        this._bufferUpdateIDs = null;
    }
}