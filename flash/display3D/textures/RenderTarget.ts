
import { Rectangle } from "flash/geom/Rectangle";
import { Matrix } from "flash/geom/Matrix";
import { Constants } from "flash/rendering/managers/Constants";
import { BaseObject } from "flash/display/BaseObject";
import { GLTexture } from "flash/display3D/textures/GLTexture";
import { IndexBuffer3D } from "flash/display3D/IndexBuffer3D";
import { GLFramebuffer } from "flash/display3D/GLFramebuffer";
import { Graphics } from "flash/display/Graphics";
import { StageSettings } from "flash/display/StageSettings";

export class RenderTarget extends BaseObject
{
    protected gl:WebGLRenderingContext;
    protected frameBuffer:GLFramebuffer;
    protected _clearColor:number[];
    protected _projectionMatrix:Matrix;
    protected _transform:Matrix;
    protected _texture:GLTexture;
    protected sourceFrame:Rectangle;
    protected frame:Rectangle;
    protected _stencilMaskStack:Graphics[];
    protected stencilBuffer:IndexBuffer3D;
    protected scaleMode:number;
    protected root:boolean;
    protected defaultFrame:Rectangle;
    protected destinationFrame:Rectangle;
    protected resolution:number;
    protected _size:Rectangle;

    constructor(gl:WebGLRenderingContext, width:number, height:number, scaleMode:number, resolution:number, root:boolean = false)
    {
        super();
        this.gl = gl;
        this.frameBuffer = null;
        this._texture = null;
        this._clearColor = [0, 0, 0, 0];
        this._size = new Rectangle(0, 0, 1, 1);
        this.resolution = resolution || StageSettings.RESOLUTION;
        this._projectionMatrix = new Matrix();
        this._transform = null;
        this.frame = null;
        this.defaultFrame = new Rectangle();
        this.destinationFrame = null;
        this.sourceFrame = null;
        this.stencilBuffer = null;
        this._stencilMaskStack = [];
        this.scaleMode = scaleMode !== undefined ? scaleMode : StageSettings.SCALE_MODE;
        this.root = root;
        if (!this.root)
        {
            this.frameBuffer = GLFramebuffer.createRGBA(gl, 100, 100);
            if (this.scaleMode === Constants.SCALE_MODES.NEAREST)
            {
                this.frameBuffer.texture.enableNearestScaling();
            }
            else
            {
                this.frameBuffer.texture.enableLinearScaling();
            }
            this._texture = this.frameBuffer.texture;
        }
        else
        {
            this.frameBuffer = new GLFramebuffer(gl, 100, 100);
            this.frameBuffer.framebuffer = null;
        }
        this.setFrame();
        this.resize(width, height);
    }

    public set transform(value:Matrix)
    {
        this._transform = value;
    }

    public get transform():Matrix
    {
        return this._transform;
    }

    public get size():Rectangle
    {
        return this._size;
    }

    public get stencilMaskStack():Graphics[]
    {
        return this._stencilMaskStack;
    }

    public get texture():GLTexture
    {
        return this._texture;
    }

    public get projectionMatrix():Matrix
    {
        return this._projectionMatrix;
    }

    public set clearColor(value:number[])
    {
        this._clearColor = value;
    }

    public get clearColor():number[]
    {
        return this._clearColor;
    }

    public clear(clearColor:number[] = null):void
    {
        const cc = clearColor || this._clearColor;
        this.frameBuffer.clear(cc[0], cc[1], cc[2], cc[3]);       
    }

    public attachStencilBuffer():void
    {
        if (!this.root)
        {
            this.frameBuffer.enableStencil();
        }
    }

    public setFrame(destinationFrame:Rectangle = null, sourceFrame:Rectangle = null):void
    {
        this.destinationFrame = destinationFrame || this.destinationFrame || this.defaultFrame;
        this.sourceFrame = sourceFrame || this.sourceFrame || this.destinationFrame;
    }

    public activate():void
    {
        this.frameBuffer.bind();
        this.calculateProjection(this.destinationFrame, this.sourceFrame);
        if (this._transform)
        {
            this._projectionMatrix.append(this._transform);
        }
        if (this.destinationFrame !== this.sourceFrame)
        {
            this.gl.enable(this.gl.SCISSOR_TEST);
            this.gl.scissor(this.destinationFrame.x | 0, this.destinationFrame.y | 0, (this.destinationFrame.width * this.resolution) | 0, (this.destinationFrame.height * this.resolution) | 0);
        }
        else
        {
            this.gl.disable(this.gl.SCISSOR_TEST);
        }
        this.gl.viewport(this.destinationFrame.x | 0, this.destinationFrame.y | 0, (this.destinationFrame.width * this.resolution) | 0, (this.destinationFrame.height * this.resolution) | 0);
    }

    protected calculateProjection(destinationFrame:Rectangle, sourceFrame:Rectangle = null):void
    {
        const pm:Matrix = this._projectionMatrix;
        sourceFrame = sourceFrame || destinationFrame;
        pm.identity();
        if (!this.root)
        {
            pm.a = 1 / destinationFrame.width * 2;
            pm.d = 1 / destinationFrame.height * 2;
            pm.tx = -1 - (sourceFrame.x * pm.a);
            pm.ty = -1 - (sourceFrame.y * pm.d);
        }
        else
        {
            pm.a = 1 / destinationFrame.width * 2;
            pm.d = -1 / destinationFrame.height * 2;
            pm.tx = -1 - (sourceFrame.x * pm.a);
            pm.ty = 1 - (sourceFrame.y * pm.d);
        }
    }

    public resize(width:number, height:number):void
    {
        width = width | 0;
        height = height | 0;
        if (this._size.width === width && this._size.height === height)
        {
            return;
        }
        this._size.width = width;
        this._size.height = height;
        this.defaultFrame.width = width;
        this.defaultFrame.height = height;
        this.frameBuffer.resize(width * this.resolution, height * this.resolution);
        const projectionFrame = this.frame || this._size;
        this.calculateProjection(projectionFrame);
    }

    public destroy():void
    {
        this.frameBuffer.destroy();
        this.frameBuffer = null;
        this._texture = null;
    }
}