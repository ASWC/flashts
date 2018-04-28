import { ObjectRenderer } from "flash/display3D/renderers/ObjectRenderer";
import { PrimitiveShader } from "flash/rendering/webgl/PrimitiveShader";
import { Utils } from "flash/rendering/webgl/Utils";
import { Constants } from "flash/rendering/managers/Constants";
import { WebGLGraphicsData } from "flash/rendering/core/gl/WebGLGraphicsData";
import { ShapeUtils } from "flash/geom/shapes/ShapeUtils";
import { GLShader } from "flash/rendering/core/gl/GLShader";
import { Graphics } from "flash/display/Graphics";
import { BaseObject } from "flash/display/BaseObject";
import { WebGLData } from "flash/geom/shapes/WebGLData";
import { GraphicsData } from "flash/geom/shapes/GraphicsData";

export class GraphicsRenderer extends ObjectRenderer
{
    private static _graphicsRenderer:GraphicsRenderer;
    protected graphicsDataPool:WebGLGraphicsData[];
    protected primitiveShader:GLShader;    
    protected CONTEXT_UID:number;

    constructor()
    {
        super();
        this.graphicsDataPool = [];
        this.primitiveShader = null;      
        this.CONTEXT_UID = 0;
    }

    public static get renderer():GraphicsRenderer
    {
        if(!GraphicsRenderer._graphicsRenderer)
        {
            GraphicsRenderer._graphicsRenderer = new GraphicsRenderer();
        }
        return GraphicsRenderer._graphicsRenderer;
    }

    public destroy():void
    {
        for (let i:number = 0; i < this.graphicsDataPool.length; ++i)
        {
            this.graphicsDataPool[i].destroy();
        }
        this.graphicsDataPool = null;
    }

    public render(graphics:Graphics):void
    {
        if(!graphics.stage)
        {
            return;
        }
        if(!graphics.stage.context)
        {
            return;
        }
        if(!this.primitiveShader)
        {
            this.CONTEXT_UID = graphics.stage.getContextID();
            this.primitiveShader = new PrimitiveShader(graphics.stage.context);
        }        
        let webGLData:WebGLGraphicsData;
        let webGL:WebGLData = graphics.webGL[this.CONTEXT_UID];
        if (!webGL || graphics.dirty !== webGL.dirty)
        {
            this.updateGraphics(graphics);
            webGL = graphics.webGL[this.CONTEXT_UID];
        }
        const shader:GLShader = this.primitiveShader;
        graphics.stage.bindShader(shader, true);
        graphics.stage.getRenderState().setBlendMode(graphics.blendMode);
        for (let i:number = 0, n = webGL.data.length; i < n; i++)
        {
            webGLData = webGL.data[i];            
            const shaderTemp:GLShader = webGLData.shader;
            graphics.stage.bindShader(shaderTemp, true);
            shaderTemp.uniforms.translationMatrix = graphics.transform.worldTransform.toArray(true);    
            shaderTemp.uniforms.tint = Utils.hex2rgb(graphics.tint);
            shaderTemp.uniforms.alpha = graphics.worldAlpha;
            graphics.stage.bindVao(webGLData.vao);
            if (webGLData.nativeLines)
            {
                graphics.stage.context.drawArrays(graphics.stage.context.LINES, 0, webGLData.points.length / 6);
            }
            else
            {
                webGLData.vao.draw(graphics.stage.context.TRIANGLE_STRIP, webGLData.indices.length);
            }
        }
    }

    public updateGraphics(graphics:Graphics):void
    {
        if(!graphics.stage)
        {
            return;
        }
        if(!graphics.stage.context)
        {
            return;
        }
        let webGL:WebGLData = graphics.webGL[this.CONTEXT_UID];
        if (!webGL)
        {
            webGL = graphics.webGL[this.CONTEXT_UID] = new WebGLData(graphics.stage.context);
        }
        webGL.dirty = graphics.dirty;
        if (graphics.clearDirty !== webGL.clearDirty)
        {
            webGL.clearDirty = graphics.clearDirty;
            for (let i:number = 0; i < webGL.data.length; i++)
            {
                this.graphicsDataPool.push(webGL.data[i]);
            }
            webGL.data.length = 0;
            webGL.lastIndex = 0;
        }
        let webGLData:WebGLGraphicsData;
        let webGLDataNativeLines:WebGLGraphicsData;
        for (let i:number = webGL.lastIndex; i < graphics.graphicsData.length; i++)
        {
            const data:GraphicsData = graphics.graphicsData[i];
            const webglobjects:WebGLGraphicsData = this.getWebGLData(webGL, 0, false, graphics);
            if (data.nativeLines && data.lineWidth)
            {
                webGLDataNativeLines = this.getWebGLData(webGL, 0, true, graphics);
                webGL.lastIndex++;
            }
            if (data.type === Constants.SHAPES.POLY)
            {
                ShapeUtils.buildPoly(webglobjects, data);
            }
            else if (data.type === Constants.SHAPES.CIRC || data.type === Constants.SHAPES.ELIP)
            {
                ShapeUtils.buildCircle(webglobjects, data);
            }
            if (data.type === Constants.SHAPES.RECT)
            {
                ShapeUtils.buildRectangle(webglobjects, data);
            }
            else if (data.type === Constants.SHAPES.RREC)
            {
                ShapeUtils.buildRoundedRectangle(webglobjects, data, webGLDataNativeLines);
            }
            webGL.lastIndex++;
        }
        graphics.stage.bindVao(null);
        for (let i:number = 0; i < webGL.data.length; i++)
        {
            webGLData = webGL.data[i];
            if (webGLData.dirty)
            {
                webGLData.upload();
            }
        }
    }

    public getWebGLData(gl:WebGLData, type:number, nativeLines:boolean, graphics:Graphics):WebGLGraphicsData
    {
        let gldata:WebGLData = gl;
        let webGLData:WebGLGraphicsData = gldata.data[gldata.data.length - 1];
        if (!webGLData || webGLData.nativeLines !== nativeLines || webGLData.points.length > 320000)
        {
            webGLData = this.graphicsDataPool.pop() || new WebGLGraphicsData(graphics.stage.context, this.primitiveShader, graphics.stage.getRenderState().attribState);
            webGLData.nativeLines = nativeLines;
            webGLData.reset();
            gldata.data.push(webGLData);
        }
        webGLData.dirty = true;
        return webGLData;
    }
}




