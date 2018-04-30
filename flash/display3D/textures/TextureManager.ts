import { RenderTarget } from "flash/display3D/textures/RenderTarget";
import { GLTexture } from "flash/display3D/textures/GLTexture";
import { Utils } from "flash/rendering/webgl/Utils";
import { Constants } from "flash/rendering/managers/Constants";
import { Texture } from "flash/display3D/textures/Texture";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { BaseObject } from "flash/display/BaseObject";
import { Event } from "flash/events/Event";
import { Stage } from "flash/display/Stage";
import { RenderTargetDictionary } from "flash/display3D/types/DataDictionaries";

export class TextureManager extends BaseObject
{
    protected _managedTextures:BaseTexture[];
    protected _stage:Stage;

    constructor()
    {
        super();
        this._managedTextures = [];
    }

    public get managedTextures():BaseTexture[]
    {
        return this._managedTextures;
    }

    public set stage(value:Stage)
    {
        this._stage = value;
    }

    public bindTexture():void
    {
       
    }

    public getTexture():Texture
    {
        return null;
    }

    public updateTexture(texture:BaseTexture, location:number):GLTexture
    {        
        if(!this._stage)
        {
            return;
        }
        const isRenderTexture:boolean = !!texture.glRenderTargets;
        if (!texture.hasLoaded)
        {
            return null;
        }
        const boundTextures:BaseTexture[] = this._stage.boundTextures;
        if (location === undefined)
        {
            location = 0;
            for (let i:number = 0; i < boundTextures.length; ++i)
            {
                if (boundTextures[i] === texture)
                {
                    location = i;
                    break;
                }
            }
        }
        boundTextures[location] = texture;
        this._stage.context.activeTexture(this._stage.context.TEXTURE0 + location);
        let glTexture:GLTexture = texture.glTextures[this._stage.getContextID()];
        if (!glTexture)
        {
            if (isRenderTexture)
            {
                const renderTarget:RenderTarget = new RenderTarget(this._stage.context, texture.width, texture.height, texture.scaleMode, texture.resolution);
                renderTarget.resize(texture.width, texture.height);
                texture.glRenderTargets[this._stage.getContextID()] = renderTarget;
                glTexture = renderTarget.texture;
            }
            else
            {
                var textsource:HTMLImageElement|HTMLCanvasElement = texture.source;
                glTexture = new GLTexture(this._stage.context);
                glTexture.bind(location);
                glTexture.premultiplyAlpha = true;
                glTexture.upload(<HTMLImageElement> textsource);
            }
            texture.glTextures[this._stage.getContextID()] = glTexture;
            texture.removeEventListener(Event.CHANGE, this.updateTexture);
            texture.removeEventListener(Event.UNLOAD, this.destroyTexture);
            this._managedTextures.push(texture);
            if (texture.isPowerOfTwo)
            {
                if (texture.mipmap)
                {
                    glTexture.enableMipmap();
                }
                if (texture.wrapMode === Constants.WRAP_MODES.CLAMP)
                {
                    glTexture.enableWrapClamp();
                }
                else if (texture.wrapMode === Constants.WRAP_MODES.REPEAT)
                {
                    glTexture.enableWrapRepeat();
                }
                else
                {
                    glTexture.enableWrapMirrorRepeat();
                }
            }
            else
            {
                glTexture.enableWrapClamp();
            }
            if (texture.scaleMode === Constants.SCALE_MODES.NEAREST)
            {
                glTexture.enableNearestScaling();
            }
            else
            {
                glTexture.enableLinearScaling();
            }
        }
        else if (isRenderTexture)
        {
            texture.glRenderTargets[this._stage.getContextID()].resize(texture.width, texture.height);
        }
        else
        {
            var textsource:HTMLImageElement|HTMLCanvasElement = texture.source;
            glTexture.upload(<HTMLImageElement> textsource);
        }
        return glTexture;
    }

    public destroyTexture(value:Texture|BaseTexture, skipRemove:boolean):void
    {
        var text:Texture|BaseTexture = value;
        var basetext:BaseTexture;
        if(text instanceof Texture)
        {
            basetext = text.baseTexture
        }
        else
        {   
            basetext = text;
        }
        if (!basetext.hasLoaded)
        {
            return;
        }
        const uid:number = this._stage.getContextID();
        const glTextures:GLTexture[] = basetext.glTextures;
        const glRenderTargets:RenderTargetDictionary = basetext.glRenderTargets;
        if (glTextures[uid])
        {            
            this._stage.unbindTexture(basetext);
            glTextures[uid].destroy();
            basetext.removeEventListener(Event.CHANGE, this.updateTexture);
            basetext.removeEventListener(Event.UNLOAD, this.destroyTexture);
            delete glTextures[uid];
            if (!skipRemove)
            {
                const i:number = this._managedTextures.indexOf(basetext);
                if (i !== -1)
                {
                    Utils.removeItems(this._managedTextures, i, 1);
                }
            }
        }
        if (glRenderTargets && glRenderTargets[uid])
        {
            glRenderTargets[uid].destroy();
            delete glRenderTargets[uid];
        }
    }

    public removeAll():void
    {
        for (let i:number = 0; i < this._managedTextures.length; ++i)
        {
            const texture:BaseTexture = this._managedTextures[i];
            if (texture.glTextures[this._stage.getContextID()])
            {
                delete texture.glTextures[this._stage.getContextID()];
            }
        }
    }

    public destroy():void
    {
        for (let i:number = 0; i < this._managedTextures.length; ++i)
        {
            const texture:BaseTexture = this._managedTextures[i];
            this.destroyTexture(texture, true);
            texture.removeEventListener(Event.CHANGE, this.updateTexture);
            texture.removeEventListener(Event.UNLOAD, this.destroyTexture);
        }
        this._managedTextures = null;
    }
}