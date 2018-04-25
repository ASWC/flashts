import { GLTexture } from "flash/rendering/core/gl/GLTexture";
import { BaseObject } from "flash/rendering/core/BaseObject";

export class GLFramebuffer extends BaseObject
{
    public gl:WebGLRenderingContext;
    public framebuffer:WebGLFramebuffer;
    public stencil:WebGLRenderbuffer;
    public width:number;
    public height:number;
    public texture:GLTexture;

    constructor(gl:WebGLRenderingContext, width:number = 100, height:number = 100)
    {
        super();
        this.gl = gl;
        this.framebuffer = gl.createFramebuffer();
        this.stencil = null;
        this.texture = null;
        this.width = width;
        this.height = height;
    };
    
    public enableTexture(texture:GLTexture):void
    {    
        this.texture = texture || new GLTexture(this.gl);    
        this.texture.bind();    
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA,  this.width, this.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);    
        this.bind();    
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texture.texture, 0);
    };
    
    public enableStencil():void
    {
        if(this.stencil)return;      
        this.stencil = this.gl.createRenderbuffer();    
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.stencil);    
        this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_STENCIL_ATTACHMENT, this.gl.RENDERBUFFER, this.stencil);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_STENCIL,  this.width  , this.height );    
    };

    public clear( r:number, g:number, b:number, a:number ):void
    {
        this.bind();        
        this.gl.clearColor(r, g, b, a);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    };
    
    public bind():void
    {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer );
    };
 
    public unbind():void
    {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null );
    };

    public resize(width:number, height:number):void
    {    
        this.width = width;
        this.height = height;    
        if ( this.texture )
        {
            this.texture.uploadData(null, width, height);
        }    
        if ( this.stencil )
        {
            this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.stencil);
            this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_STENCIL, width, height);
        }
    };
   
    public destroy():void
    {
        if(this.texture)
        {
            this.texture.destroy();
        }    
        this.gl.deleteFramebuffer(this.framebuffer);    
        this.gl = null;    
        this.stencil = null;
        this.texture = null;
    };

    public static createRGBA(gl:WebGLRenderingContext, width:number, height:number, data:ArrayBuffer = null):GLFramebuffer
    {
        var texture = GLTexture.fromData(gl, null, width, height);
        texture.enableNearestScaling();
        texture.enableWrapClamp();
        var fbo = new GLFramebuffer(gl, width, height);
        fbo.enableTexture(texture);    
        fbo.unbind();    
        return fbo;
    };

    public static createFloat32(gl:WebGLRenderingContext, width:number, height:number, data:Float32Array):GLFramebuffer
    {
        var texture = GLTexture.fromData(gl, data, width, height);
        texture.enableNearestScaling();
        texture.enableWrapClamp();
        var fbo = new GLFramebuffer(gl, width, height);
        fbo.enableTexture(texture);    
        fbo.unbind();    
        return fbo;
    };
    
}