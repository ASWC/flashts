import { RenderTarget } from "../webgl/RenderTarget";
import { GLTexture } from "flash/rendering/core/gl/GLTexture";
import { Utils } from "../webgl/Utils";
import { Constants } from "../managers/Constants";
import { Texture } from "./Texture";
import { BaseTexture } from "./BaseTexture";
import { BaseObject } from "../core/BaseObject";
import { Event } from "flash/events/Event";
import { Stage } from "../../display/Stage";

export class TextureManager extends BaseObject
{
    public _managedTextures:BaseTexture[];
    public stage:Stage;

    constructor()
    {
        super();
        this._managedTextures = [];
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
        if(!this.stage)
        {
            return;
        }
        const isRenderTexture = !!texture._glRenderTargets;
        if (!texture.hasLoaded)
        {
            return null;
        }
        const boundTextures = this.stage.boundTextures;
        if (location === undefined)
        {
            location = 0;
            for (let i = 0; i < boundTextures.length; ++i)
            {
                if (boundTextures[i] === texture)
                {
                    location = i;
                    break;
                }
            }
        }
        boundTextures[location] = texture;
        this.stage.context.activeTexture(this.stage.context.TEXTURE0 + location);
        let glTexture = texture._glTextures[this.stage.getContextID()];
        if (!glTexture)
        {
            if (isRenderTexture)
            {
                const renderTarget = new RenderTarget(this.stage.context, texture.width, texture.height, texture.scaleMode, texture.resolution);
                renderTarget.resize(texture.width, texture.height);
                texture._glRenderTargets[this.stage.getContextID()] = renderTarget;
                glTexture = renderTarget.texture;
            }
            else
            {
                var textsource:any = texture.source;
                glTexture = new GLTexture(this.stage.context);
                glTexture.bind(location);
                glTexture.premultiplyAlpha = true;
                glTexture.upload(textsource);
            }
            texture._glTextures[this.stage.getContextID()] = glTexture;
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
            texture._glRenderTargets[this.stage.getContextID()].resize(texture.width, texture.height);
        }
        else
        {
            var textsource:any = texture.source;
            glTexture.upload(textsource);
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
        const uid = this.stage.getContextID();
        const glTextures = basetext._glTextures;
        const glRenderTargets = basetext._glRenderTargets;
        if (glTextures[uid])
        {            
            this.stage.unbindTexture(basetext);
            glTextures[uid].destroy();
            basetext.removeEventListener(Event.CHANGE, this.updateTexture);
            basetext.removeEventListener(Event.UNLOAD, this.destroyTexture);
            delete glTextures[uid];
            if (!skipRemove)
            {
                const i = this._managedTextures.indexOf(basetext);
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
        for (let i = 0; i < this._managedTextures.length; ++i)
        {
            const texture = this._managedTextures[i];
            if (texture._glTextures[this.stage.getContextID()])
            {
                delete texture._glTextures[this.stage.getContextID()];
            }
        }
    }

    public destroy():void
    {
        for (let i = 0; i < this._managedTextures.length; ++i)
        {
            const texture = this._managedTextures[i];
            this.destroyTexture(texture, true);
            texture.removeEventListener(Event.CHANGE, this.updateTexture);
            texture.removeEventListener(Event.UNLOAD, this.destroyTexture);
        }
        this._managedTextures = null;
    }
}