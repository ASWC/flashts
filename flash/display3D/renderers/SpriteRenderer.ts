import { ObjectRenderer } from "flash/display3D/renderers/ObjectRenderer";
import { Buffer } from "flash/rendering/core/gl/Buffer";
import { Utils } from "flash/rendering/webgl/Utils";
import { CreateIndicesForQuads } from "flash/rendering/webgl/CreateIndicesForQuads";
import { GLBuffer } from "flash/rendering/core/gl/GLBuffer";
import { GLShader } from "flash/rendering/core/gl/GLShader";
import { VertexArrayObject } from "flash/rendering/core/gl/VertexArrayObject";
import { Bitmap } from "flash/display/Bitmap";
import { Texture } from "flash/rendering/textures/Texture";
import { BaseTexture } from "flash/rendering/textures/BaseTexture";
import { BaseObject } from "flash/display/BaseObject";
import { StageSettings } from "flash/display/StageSettings";
import { Event } from "flash/events/Event";
import { AttributeDataDictionary } from "flash/display3D/types/DataDictionaries";
import { SpriteDataGroup } from "flash/display3D/types/DataTypes";

// TYPED

export class SpriteRenderer extends ObjectRenderer
{
    protected static _spriteRenderer:SpriteRenderer;
    protected static TICK:number = 0;
    protected static TEXTURE_TICK:number = 0;
    protected vertSize:number;
    protected vertByteSize:number;    
    protected size:number;
    protected buffers:Buffer[];
    protected indices:Uint16Array;
    protected shader:GLShader;
    protected currentIndex:number;
    protected groups:SpriteDataGroup[];
    protected vaoMax:number;
    protected vertexCount:number;
    protected MAX_TEXTURES:number;
    protected indexBuffer:GLBuffer;
    protected vertexBuffers:GLBuffer[];  
    protected vaos:VertexArrayObject[];   
    protected vao:VertexArrayObject;
    protected currentBlendMode:number;
    protected boundTextures:BaseTexture[];  
    protected sprites:Bitmap[];           
    
    constructor()
    {
        super();
        this.vertSize = 5;
        this.vertByteSize = this.vertSize * 4;
        this.size = StageSettings.SPRITE_BATCH_SIZE; 
        this.buffers = [];
        for (let i = 1; i <= Utils.nextPow2(this.size); i *= 2)
        {
            this.buffers.push(new Buffer(i * 4 * this.vertByteSize));
        }
        this.indices = CreateIndicesForQuads.createIndicesForQuads(this.size);
        this.shader = null;
        this.currentIndex = 0;
        this.groups = [];
        for (let k = 0; k < this.size; k++)
        {
            this.groups[k] = new SpriteDataGroup();
        }
        this.sprites = [];
        this.vertexBuffers = [];
        this.vaos = [];
        this.vaoMax = 2;
        this.vertexCount = 0;
    }

    public static get renderer():ObjectRenderer
    {
        if(!SpriteRenderer._spriteRenderer)
        {
            SpriteRenderer._spriteRenderer = new SpriteRenderer();
        }
        return SpriteRenderer._spriteRenderer;
    }

    public onContextChange()
    {
        if (this.stageContext.canvasLegacy)
        {
            this.MAX_TEXTURES = 1;
        }
        else
        {
            this.MAX_TEXTURES = Math.min(this.stageContext.context.getParameter(this.stageContext.context.MAX_TEXTURE_IMAGE_UNITS), StageSettings.SPRITE_MAX_TEXTURES);
            this.MAX_TEXTURES = Utils.checkMaxIfStatmentsInShader(this.MAX_TEXTURES, this.stageContext.context);
        }
        this.shader = Utils.generateMultiTextureShader(this.stageContext.context, this.MAX_TEXTURES);
        this.indexBuffer = GLBuffer.createIndexBuffer(this.stageContext.context, this.indices, this.stageContext.context.STATIC_DRAW);
        this.stageContext.bindVao(null);
        const attrs = this.shader.attributes;
        for (let i = 0; i < this.vaoMax; i++)
        {
            const vertexBuffer = GLBuffer.createVertexBuffer(this.stageContext.context, null, this.stageContext.context.STREAM_DRAW);            
            this.vertexBuffers[i] = vertexBuffer
            const vao = this.stageContext.createVao()
                .addIndex(this.indexBuffer)
                .addAttribute(vertexBuffer, attrs.aVertexPosition, this.stageContext.context.FLOAT, false, this.vertByteSize, 0)
                .addAttribute(vertexBuffer, attrs.aTextureCoord, this.stageContext.context.UNSIGNED_SHORT, true, this.vertByteSize, 2 * 4)
                .addAttribute(vertexBuffer, attrs.aColor, this.stageContext.context.UNSIGNED_BYTE, true, this.vertByteSize, 3 * 4);
            if (attrs.aTextureId)
            {
                vao.addAttribute(vertexBuffer, attrs.aTextureId, this.stageContext.context.FLOAT, false, this.vertByteSize, 4 * 4);
            }
            this.vaos[i] = vao;           
        }
        this.vao = this.vaos[0];
        this.currentBlendMode = 99999;
        this.boundTextures = []
    }

    public onPrerender()
    {
        this.vertexCount = 0;
    }

    public render(sprite:Bitmap)
    {
        if (this.currentIndex >= this.size)
        {
            this.flush();
        }
        if (!sprite.texture._uvs)
        {
            return;
        }
        this.sprites[this.currentIndex++] = sprite;
    }

    public flush()
    {
        if (this.currentIndex === 0)
        {
            return;
        }        
        const np2:number = Utils.nextPow2(this.currentIndex);
        const log2:number = Utils.log2(np2);
        const buffer:Buffer = this.buffers[log2];
        const float32View:Float32Array = buffer.float32View;
        const uint32View:Uint32Array = buffer.uint32View;
        const boundTextures:BaseTexture[] = this.boundTextures;
        const rendererBoundTextures:BaseTexture[] = this.stageContext.boundTextures;
        const touch:number = this.stageContext.textureGCCount;
        let index:number = 0;
        let nextTexture:BaseTexture;
        let currentTexture:BaseTexture;
        let groupCount:number = 1;
        let textureCount:number = 0;
        let currentGroup:SpriteDataGroup = this.groups[0];
        let vertexData:Float32Array;
        let uvs:Uint32Array;
        let globalmodes:Array<number[]> = Utils.mapPremultipliedBlendModes()
        let bitmap:Bitmap = this.sprites[0]
        let blendcategory:number[] = globalmodes[bitmap.texture.baseTexture.premultipliedAlpha ? 1 : 0]
        let blendindex:number = bitmap.blendMode;
        let blendMode:number = blendcategory[blendindex];
        if(!blendMode)
        {
            blendMode = blendcategory[0];
        }
        currentGroup.textureCount = 0;
        currentGroup.start = 0;
        currentGroup.blend = blendMode;
        SpriteRenderer.TICK++;
        let i:number;
        for (i = 0; i < this.MAX_TEXTURES; ++i)
        {
            const bt:BaseTexture = rendererBoundTextures[i];
            if (bt._enabled === SpriteRenderer.TICK)
            {
                boundTextures[i] = this.stageContext.emptyTextures[i];
                continue;
            }
            boundTextures[i] = bt;
            bt._virtalBoundId = i;
            bt._enabled = SpriteRenderer.TICK;
        }
        SpriteRenderer.TICK++;
        for (i = 0; i < this.currentIndex; ++i)
        {
            const sprite:Bitmap = this.sprites[i];
            nextTexture = sprite.texture.baseTexture;
            var spriteBlendMode:number = globalmodes[Number(nextTexture.premultipliedAlpha)][sprite.blendMode];
            if(!spriteBlendMode)
            {
                spriteBlendMode = 0;
            }
            if (blendMode !== spriteBlendMode)
            {
                blendMode = spriteBlendMode;
                currentTexture = null;
                textureCount = this.MAX_TEXTURES;
                SpriteRenderer.TICK++;
            }
            if (currentTexture !== nextTexture)
            {
                currentTexture = nextTexture;
                if (nextTexture._enabled !== SpriteRenderer.TICK)
                {
                    if (textureCount === this.MAX_TEXTURES)
                    {
                        SpriteRenderer.TICK++;
                        currentGroup.size = i - currentGroup.start;
                        textureCount = 0;
                        currentGroup = this.groups[groupCount++];
                        currentGroup.blend = blendMode;
                        currentGroup.textureCount = 0;
                        currentGroup.start = i;
                    }
                    nextTexture.touched = touch;
                    if (nextTexture._virtalBoundId === -1)
                    {
                        for (let j = 0; j < this.MAX_TEXTURES; ++j)
                        {
                            const tIndex:number = (j + SpriteRenderer.TEXTURE_TICK) % this.MAX_TEXTURES;
                            const t:BaseTexture = boundTextures[tIndex];
                            if (t._enabled !== SpriteRenderer.TICK)
                            {
                                SpriteRenderer.TEXTURE_TICK++;
                                t._virtalBoundId = -1;
                                nextTexture._virtalBoundId = tIndex;
                                boundTextures[tIndex] = nextTexture;
                                break;
                            }
                        }
                    }
                    nextTexture._enabled = SpriteRenderer.TICK;
                    currentGroup.textureCount++;
                    currentGroup.ids[textureCount] = nextTexture._virtalBoundId;
                    currentGroup.textures[textureCount++] = nextTexture;
                }
            }
            vertexData = sprite.vertexData;
            uvs = sprite.texture._uvs.uvsUint32;
            if (this.stageContext.canvasRoundPixels)
            {
                const resolution:number = this.stageContext.canvasResolution;
                float32View[index] = ((vertexData[0] * resolution) | 0) / resolution;
                float32View[index + 1] = ((vertexData[1] * resolution) | 0) / resolution;
                float32View[index + 5] = ((vertexData[2] * resolution) | 0) / resolution;
                float32View[index + 6] = ((vertexData[3] * resolution) | 0) / resolution;
                float32View[index + 10] = ((vertexData[4] * resolution) | 0) / resolution;
                float32View[index + 11] = ((vertexData[5] * resolution) | 0) / resolution;
                float32View[index + 15] = ((vertexData[6] * resolution) | 0) / resolution;
                float32View[index + 16] = ((vertexData[7] * resolution) | 0) / resolution;
            }
            else
            {
                float32View[index] = vertexData[0];
                float32View[index + 1] = vertexData[1];
                float32View[index + 5] = vertexData[2];
                float32View[index + 6] = vertexData[3];
                float32View[index + 10] = vertexData[4];
                float32View[index + 11] = vertexData[5];
                float32View[index + 15] = vertexData[6];
                float32View[index + 16] = vertexData[7];
            }
            uint32View[index + 2] = uvs[0];
            uint32View[index + 7] = uvs[1];
            uint32View[index + 12] = uvs[2];
            uint32View[index + 17] = uvs[3];
            const alpha:number = Math.min(sprite.worldAlpha, 1.0);
            const argb:number = alpha < 1.0 && nextTexture.premultipliedAlpha ? Utils.premultiplyTint(sprite.tintRGB, alpha): sprite.tintRGB + (alpha * 255 << 24);
            uint32View[index + 3] = uint32View[index + 8] = uint32View[index + 13] = uint32View[index + 18] = argb;
            float32View[index + 4] = float32View[index + 9] = float32View[index + 14] = float32View[index + 19] = nextTexture._virtalBoundId;
            index += 20;
        }
        currentGroup.size = i - currentGroup.start;
        if (!StageSettings.CAN_UPLOAD_SAME_BUFFER)
        {
            if (this.vaoMax <= this.vertexCount)
            {
                this.vaoMax++;
                const attrs:AttributeDataDictionary = this.shader.attributes;
                const vertexBuffer:GLBuffer = GLBuffer.createVertexBuffer(this.stageContext.context, null, this.stageContext.context.STREAM_DRAW);                
                this.vertexBuffers[this.vertexCount] = vertexBuffer;
                const vao:VertexArrayObject = this.stageContext.createVao()
                    .addIndex(this.indexBuffer)
                    .addAttribute(vertexBuffer, attrs.aVertexPosition, this.stageContext.context.FLOAT, false, this.vertByteSize, 0)
                    .addAttribute(vertexBuffer, attrs.aTextureCoord, this.stageContext.context.UNSIGNED_SHORT, true, this.vertByteSize, 2 * 4)
                    .addAttribute(vertexBuffer, attrs.aColor, this.stageContext.context.UNSIGNED_BYTE, true, this.vertByteSize, 3 * 4);
                if (attrs.aTextureId)
                {
                    vao.addAttribute(vertexBuffer, attrs.aTextureId, this.stageContext.context.FLOAT, false, this.vertByteSize, 4 * 4);
                }
                this.vaos[this.vertexCount] = vao;
            }
            this.stageContext.bindVao(this.vaos[this.vertexCount]);
            this.vertexBuffers[this.vertexCount].upload(buffer.vertices, 0, false);
            this.vertexCount++;
        }
        else
        {
            this.vertexBuffers[this.vertexCount].upload(buffer.vertices, 0, true);
        }
        for (i = 0; i < this.MAX_TEXTURES; ++i)
        {
            rendererBoundTextures[i]._virtalBoundId = -1;
        }
        for (i = 0; i < groupCount; ++i)
        {
            const group:SpriteDataGroup = this.groups[i];
            const groupTextureCount:number = group.textureCount;
            for (let j = 0; j < groupTextureCount; j++)
            {
                currentTexture = group.textures[j];
                if (rendererBoundTextures[group.ids[j]] !== currentTexture)
                {                    
                    var bindedtex:BaseTexture = currentTexture;
                    this.stageContext.bindTexture(currentTexture, group.ids[j], true);
                }
                currentTexture._virtalBoundId = -1;
            }
            this.stageContext.getRenderState().setBlendMode(group.blend);
            this.stageContext.context.drawElements(this.stageContext.context.TRIANGLES, group.size * 6, this.stageContext.context.UNSIGNED_SHORT, group.start * 6 * 2);
        }
        this.currentIndex = 0;       
    }

    public start()
    {
        if(!this.shader)
        {
            this.onContextChange()
        }
        this.onPrerender();
        this.stageContext.bindShader(this.shader);
        if(Utils.canUploadSameBuffer())
        {
            this.stageContext.bindVao(this.vaos[this.vertexCount]);
            this.vertexBuffers[this.vertexCount].bind();
        }
    }

    public stop()
    {
        this.flush();
    }

    public destroy()
    {
        for (let i:number = 0; i < this.vaoMax; i++)
        {
            if (this.vertexBuffers[i])
            {
                this.vertexBuffers[i].destroy();
            }
            if (this.vaos[i])
            {
                this.vaos[i].destroy();
            }
        }
        if (this.indexBuffer)
        {
            this.indexBuffer.destroy();
        }
        if(this.stageContext)
        {
            this.stageContext.removeEventListener(Event.RENDER, this.onPrerender);
        }
        super.destroy();
        if (this.shader)
        {
            this.shader.destroy();
            this.shader = null;
        }
        this.stageContext = null;
        this.vertexBuffers = null;
        this.vaos = null;
        this.indexBuffer = null;
        this.indices = null;
        this.sprites = null;
        for (let i:number = 0; i < this.buffers.length; ++i)
        {
            this.buffers[i].destroy();
        }
    }
}



