
import { Rectangle } from "flash/geom/Rectangle";
import { Matrix } from "../../geom/Matrix";
import { Constants } from "../managers/Constants";
import { BaseObject } from "flash/display/BaseObject";
import { GLTexture } from "flash/display3D/textures/GLTexture";
import { IndexBuffer3D } from "flash/display3D/IndexBuffer3D";
import { GLFramebuffer } from "flash/display3D/GLFramebuffer";
import { Graphics } from "flash/display/Graphics";
import { StageSettings } from "flash/display/StageSettings";

export class RenderTarget extends BaseObject
{
    public gl:WebGLRenderingContext;
    public frameBuffer:GLFramebuffer;
    public clearColor:number[];
    public projectionMatrix:Matrix;
    public transform:Matrix;
    public texture:GLTexture;
    public filterData:any[];
    public sourceFrame:Rectangle;
    public frame:Rectangle;
    public stencilMaskStack:Graphics[];
    public stencilBuffer:IndexBuffer3D;
    public scaleMode:number;
    public root:boolean;
    public defaultFrame:Rectangle;
    public destinationFrame:Rectangle;
    public resolution:number;
    public size:Rectangle;

    constructor(gl:WebGLRenderingContext, width:number, height:number, scaleMode:number, resolution:number, root:boolean = false)
    {
        super();
        this.gl = gl;
        this.frameBuffer = null;
        this.texture = null;
        this.clearColor = [0, 0, 0, 0];
        this.size = new Rectangle(0, 0, 1, 1);
        this.resolution = resolution || StageSettings.RESOLUTION;
        this.projectionMatrix = new Matrix();
        this.transform = null;
        this.frame = null;
        this.defaultFrame = new Rectangle();
        this.destinationFrame = null;
        this.sourceFrame = null;
        this.stencilBuffer = null;
        this.stencilMaskStack = [];
        this.filterData = null;
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
            this.texture = this.frameBuffer.texture;
        }
        else
        {
            this.frameBuffer = new GLFramebuffer(gl, 100, 100);
            this.frameBuffer.framebuffer = null;
        }
        this.setFrame();
        this.resize(width, height);
    }

    public clear(clearColor:number[] = null):void
    {
        const cc = clearColor || this.clearColor;
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
        const gl = this.gl;
        this.frameBuffer.bind();
        this.calculateProjection(this.destinationFrame, this.sourceFrame);
        if (this.transform)
        {
            this.projectionMatrix.append(this.transform);
        }
        if (this.destinationFrame !== this.sourceFrame)
        {
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(
                this.destinationFrame.x | 0,
                this.destinationFrame.y | 0,
                (this.destinationFrame.width * this.resolution) | 0,
                (this.destinationFrame.height * this.resolution) | 0
            );
        }
        else
        {
            gl.disable(gl.SCISSOR_TEST);
        }
        gl.viewport(
            this.destinationFrame.x | 0,
            this.destinationFrame.y | 0,
            (this.destinationFrame.width * this.resolution) | 0,
            (this.destinationFrame.height * this.resolution) | 0
        );
    }

    public calculateProjection(destinationFrame:Rectangle, sourceFrame:Rectangle = null):void
    {
        const pm = this.projectionMatrix;
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
        if (this.size.width === width && this.size.height === height)
        {
            return;
        }
        this.size.width = width;
        this.size.height = height;
        this.defaultFrame.width = width;
        this.defaultFrame.height = height;
        this.frameBuffer.resize(width * this.resolution, height * this.resolution);
        const projectionFrame = this.frame || this.size;
        this.calculateProjection(projectionFrame);
    }

    public destroy():void
    {
        this.frameBuffer.destroy();
        this.frameBuffer = null;
        this.texture = null;
    }
}