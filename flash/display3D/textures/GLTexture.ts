import { BaseObject } from "flash/display/BaseObject";

export class GLTexture extends BaseObject
{
    protected static FLOATING_POINT_AVAILABLE = false;
    protected gl:WebGLRenderingContext;
    protected _texture:WebGLTexture;
    protected mipmap:boolean;
    protected format:number;
    protected type:number;
    protected _premultiplyAlpha:boolean;
    protected height:number;
    protected width:number;

    constructor(gl:WebGLRenderingContext, width:number = -1, height:number = -1, format:number = NaN, type:number = NaN)
    {
        super();
        this.gl = gl;
        this._texture = gl.createTexture();
        this.mipmap = false;
        this._premultiplyAlpha = false;
        this.width = width;
        this.height = height;
        this.format = format || gl.RGBA;
        this.type = type || gl.UNSIGNED_BYTE;
    };

    public set premultiplyAlpha(value:boolean)
    {
        this._premultiplyAlpha = value;
    }

    public get premultiplyAlpha():boolean
    {
        return this._premultiplyAlpha;
    }

    public get texture():WebGLTexture
    {
        return this._texture;
    }

    public upload(value:HTMLImageElement|ImageData|HTMLVideoElement):void
    {
        this.bind();
        var source:HTMLImageElement|ImageData|HTMLVideoElement = value;
        this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._premultiplyAlpha);
        var newWidth:number = source.width;
        var newHeight:number = source.height;
        if(source instanceof HTMLVideoElement)
        {
            newWidth = source.videoWidth;
            newHeight = source.videoHeight;
        }
        if(newHeight !== this.height || newWidth !== this.width)
        {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.format, this.format, this.type, source);
        }
        else
        {
            this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 0, this.format, this.type, source);
        }
        this.width = newWidth;
        this.height = newHeight;
    };

    public uploadData(data:Float32Array, width:number, height:number):void
    {
        this.bind();
        if(data instanceof Float32Array)
        {
            if(!GLTexture.FLOATING_POINT_AVAILABLE)
            {
                var ext:OES_texture_float = this.gl.getExtension("OES_texture_float");
                if(ext)
                {
                    GLTexture.FLOATING_POINT_AVAILABLE = true;
                }
                else
                {
                    throw new Error('floating point textures not available');
                }
            }
            this.type = this.gl.FLOAT;
        }
        else
        {
            this.type = this.type || this.gl.UNSIGNED_BYTE;
        }
        this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._premultiplyAlpha);
        if(width !== this.width || height !== this.height)
        {           
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.format,  width, height, 0, this.format, this.type, data || null);            
        }
        else
        {
            this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, data || null);
        }
        this.width = width;
        this.height = height;
    };

    public bind(location:number = undefined):void
    {
        if(location !== undefined)
        {
            this.gl.activeTexture(this.gl.TEXTURE0 + location);
        }
        this.gl.bindTexture(this.gl.TEXTURE_2D, this._texture);
    };

    public unbind():void
    {
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    };

    public minFilter( linear:boolean ):void
    {
        this.bind();
        if(this.mipmap)
        {
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, linear ? this.gl.LINEAR_MIPMAP_LINEAR : this.gl.NEAREST_MIPMAP_NEAREST);
        }
        else
        {
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, linear ? this.gl.LINEAR : this.gl.NEAREST);
        }
    };

    public magFilter( linear:boolean )
    {
        this.bind();
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, linear ? this.gl.LINEAR : this.gl.NEAREST);
    };

    public enableMipmap():void
    {
        this.bind();
        this.mipmap = true;
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
    };

    public enableLinearScaling():void
    {
        this.minFilter(true);
        this.magFilter(true);
    };

    public enableNearestScaling():void
    {
        this.minFilter(false);
        this.magFilter(false);
    };

    public enableWrapClamp():void
    {
        this.bind();
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    };

    public enableWrapRepeat():void
    {
        this.bind();
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
    };

    public enableWrapMirrorRepeat():void
    {
        this.bind();
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.MIRRORED_REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.MIRRORED_REPEAT);
    };

    public destroy():void
    {
        this.gl.deleteTexture(this._texture);
    };

    public static fromSource(gl:WebGLRenderingContext, source:HTMLImageElement|ImageData, premultiplyAlpha:boolean):GLTexture
    {
        var texture:GLTexture = new GLTexture(gl);
        texture._premultiplyAlpha = premultiplyAlpha || false;
        texture.upload(source);
        return texture;
    };

    public static fromData (gl:WebGLRenderingContext, data:Float32Array, width:number, height:number):GLTexture
    {
        var texture:GLTexture = new GLTexture(gl);
        texture.uploadData(data, width, height);
        return texture;
    };

}