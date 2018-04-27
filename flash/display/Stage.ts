import { DisplayObjectContainer } from "flash/display//DisplayObjectContainer";
import { Rectangle } from "flash/geom/Rectangle";
import { StageAlign } from "flash/display/StageAlign";
import { StageDisplayState } from "flash/display/StageDisplayState";
import { StageQuality } from "flash/display/StageQuality";
import { StageScaleMode } from "flash/display/StageScaleMode";
import { InteractiveObject } from "flash/display/InteractiveObject";
import { DisplayObject } from "flash/display/DisplayObject";
import { IDisplayObjectContainer } from "flash/display/IDisplayObjectContainer";
import { Utils } from "flash/rendering/webgl/Utils";
import { Texture } from "flash/rendering/textures/Texture";
import { RenderTexture } from "flash/rendering/textures/RenderTexture";
import { Matrix } from "flash/geom/Matrix";
import { VertexArrayObject } from "flash/rendering/core/gl/VertexArrayObject";
import { MaskManager } from "flash/rendering/webgl/MaskManager";
import { StencilManager } from "flash/rendering/webgl/StencilManager";
import { ObjectRenderer } from "flash/display3D/renderers/ObjectRenderer";
import { TextureManager } from "flash/rendering/textures/TextureManager";
import { FilterManager } from "flash/rendering/webgl/FilterManager";
import { WebGLState } from "flash/rendering/webgl/WebGLState";
import { GLShader } from "flash/rendering/core/gl/GLShader";
import { RenderTarget } from "flash/rendering/webgl/RenderTarget";
import { TextureGarbageCollector } from "flash/rendering/webgl/TextureGarbageCollector";
import { GLTexture } from "flash/rendering/core/gl/GLTexture";
import { BaseTexture } from "flash/rendering/textures/BaseTexture";
import { Event } from "flash/events/Event";
import { Constants } from "flash/rendering/managers/Constants";
import { Transform } from "flash/geom/Transform";
import { IChildrenOwner } from "flash/display3D/types/IChildrenOwner";
import { IStage } from "flash/display3D/types/IStage";
import { StageSettings } from "flash/display/StageSettings";
import { Timer } from "flash/utils/Timer";
import { numberDictionary } from "flash/display3D/types/DataDictionaries";

// TYPED

export class Stage extends DisplayObjectContainer implements IChildrenOwner, IStage
{
    protected _tempDisplayObjectParent:IDisplayObjectContainer; 
    protected _invalidate:boolean;
    protected CONTEXT_UID:number;
    protected _align:string;
    protected _scaleMode:string;
    protected _orientation:string;
    protected _quality:string;
    protected _deviceOrientation:string;
    protected _displayState:string;    
    protected _supportedOrientations:string[];
    protected _allowsFullScreen:boolean;
    protected _autoOrients:boolean;
    protected _color:number;
    protected _stageHeight:number;
    protected _fullScreenWidth:number;
    protected _fullScreenHeight:number;
    protected _stageWidth:number;
    protected _fullScreenSourceRect:Rectangle;
    protected _focus:InteractiveObject;       
    protected stageOptions:StageOptions; 
    protected _screen:Rectangle;    
    protected _backgroundColorRgba:number[];
    protected _backgroundColorString:string;
    protected _lastObjectRendered:DisplayObject;
    protected maskManager:MaskManager; 
    protected stencilManager:StencilManager;
    protected emptyRenderer:ObjectRenderer;
    protected _currentRenderer:ObjectRenderer;
    protected textureManager:TextureManager;
    protected filterManager:FilterManager;
    protected state:WebGLState;
    protected renderingToScreen:boolean;
    protected _activeShader:GLShader;
    protected _activeVao:VertexArrayObject;   
    protected _activeRenderTarget:RenderTarget;
    protected _nextTextureLocation:number;
    protected _textureGC:TextureGarbageCollector;
    protected rootRenderTarget:RenderTarget;
    protected _started:boolean;    
    protected _renderEvent:Event;
    protected _boundTextures:Array<BaseTexture>;    
    protected _emptyTextures:BaseTexture[];
    protected drawModes:numberDictionary;

    constructor()
    {
        super();
        this._invalidate = false;
        this._renderEvent = new Event(Event.RENDER);
        this._parent = null;
        this._started = false;
        this.stageOptions = new StageOptions();
        this._align = StageAlign.TOP_LEFT;
        this._scaleMode = StageScaleMode.NO_SCALE;
        this._orientation = '';
        this._quality = StageQuality.HIGH;
        this._deviceOrientation = '';
        this._displayState = StageDisplayState.NORMAL;  
        this._supportedOrientations = [];
        this._allowsFullScreen = true;
        this._autoOrients = true;
        this._color = 0xFFFFFF;
        this._stageHeight = 0;
        this._fullScreenWidth = 0;
        this._fullScreenHeight = 0;
        this._stageWidth = 0;
        this._fullScreenSourceRect = new Rectangle();
        this._focus = null;
        this._screen = new Rectangle(0, 0, this.stageOptions.width, this.stageOptions.height);
        this._backgroundColorRgba = Utils.hex2rgb(this.stageOptions.backgroundColor);
        this._backgroundColorString = Utils.hex2string(this.stageOptions.backgroundColor);
        this._lastObjectRendered = null;
        this.CONTEXT_UID = 1;
        this.maskManager = null;
        this.stencilManager = null;
        this.emptyRenderer = null;
        this._currentRenderer = null;
        this.textureManager = null;
        this.filterManager = null;        
        this.state = null;
        this.renderingToScreen = true;
        this._boundTextures = null;
        this._emptyTextures = null;
        this._activeShader = null;
        this._activeVao = null;
        this._activeRenderTarget = null;
        this.drawModes = null;
        this._textureGC = null;
        this.rootRenderTarget = null;
        this._nextTextureLocation = 0;       
    }

    public get currentRenderer():ObjectRenderer
    {
        return this._currentRenderer;
    }

    public clear(clearColor:number[])
    {
        this._activeRenderTarget.clear(clearColor);
    }

    public get screen():Rectangle
    {
        return this._screen;
    }

    public get activeRenderTarget():RenderTarget
    {
        return this._activeRenderTarget;
    }    

    protected setOptionsRendering():void
    {
        if(!this.stageOptions.view)
        {
            return;
        }
        if (this.stageOptions.legacy)
        {
            VertexArrayObject.FORCE_NATIVE = true;
        }
        this.stageOptions.view.addEventListener('webglcontextlost', this.handleContextLost, false);
        this.stageOptions.view.addEventListener('webglcontextrestored', this.handleContextRestored, false);
        var attributes:WebGLContextAttributes = 
        {
            failIfMajorPerformanceCaveat: true,
            alpha: this.stageOptions.transparent,
            antialias: this.stageOptions.antialias,
            depth: true,
            premultipliedAlpha: this.stageOptions.transparent,
            preserveDrawingBuffer: this.stageOptions.preserveDrawingBuffer,
            stencil: true
        }
        if(!this.stageOptions.context)
        {
            this.stageOptions.context = Utils.createContext(this.stageOptions.view, attributes);
            const maxTextures:number = this.stageOptions.context.getParameter(this.stageOptions.context.MAX_TEXTURE_IMAGE_UNITS);
            this._boundTextures = new Array(maxTextures);
            this._emptyTextures = new Array(maxTextures);            
            this._textureGC = new TextureGarbageCollector(this);
            this.state = new WebGLState(this.stageOptions.context);
            this.state.resetToDefault();
            this.rootRenderTarget = new RenderTarget(this.stageOptions.context, this.stageOptions.width, this.stageOptions.height, null, this.stageOptions.resolution, true);
            this.rootRenderTarget.clearColor = this._backgroundColorRgba;
            this.bindRenderTarget(this.rootRenderTarget);
            const emptyGLTexture:GLTexture = GLTexture.fromData(this.stageOptions.context, null, 1, 1);
            const tempObj = new BaseTexture();
            tempObj._glTextures[this.CONTEXT_UID] = null;
            for (let i:number = 0; i < maxTextures; i++)
            {
                const empty:BaseTexture = new BaseTexture();
                empty._glTextures[this.CONTEXT_UID] = emptyGLTexture;
                this._boundTextures[i] = tempObj;
                this._emptyTextures[i] = empty;
                this.bindTexture(null, i);
            }
            this.dispatchEvent(new Event(Event.CONTEXT3D_CREATE));           
            this.resize(this.stageOptions.width, this.stageOptions.height);
        }
    }

    public bindTexture(texture:Texture|BaseTexture, location:number = undefined, forceLocation:boolean = false):number
    {
        texture = texture || this._emptyTextures[location];
        if(texture instanceof Texture)
        {
            texture.baseTexture.touched = this._textureGC.count;
            texture = texture.baseTexture            
        }
        else
        {
            texture = texture;
        }        
        if (!forceLocation)
        {
            for (let i:number = 0; i < this._boundTextures.length; i++)
            {
                if (this._boundTextures[i] === texture)
                {
                    return i;
                }
            }
            if (location === undefined)
            {
                this._nextTextureLocation++;
                this._nextTextureLocation %= this._boundTextures.length;
                location = this._boundTextures.length - this._nextTextureLocation - 1;
            }
        }
        else
        {
            location = location || 0;
        }
        var glTexture:GLTexture = null;
        if(texture instanceof Texture)
        {
            glTexture = null;
        }
        else
        {
            glTexture = texture._glTextures[this.CONTEXT_UID];
        }        
        if (!glTexture || !glTexture.texture)
        {
            this.textureManager.updateTexture(texture, location);
        }
        else
        {
            this._boundTextures[location] = texture;
            this.stageOptions.context.activeTexture(this.stageOptions.context.TEXTURE0 + location);
            this.stageOptions.context.bindTexture(this.stageOptions.context.TEXTURE_2D, glTexture.texture);            
        }
        return location;
    }

    public bindRenderTarget(renderTarget:RenderTarget):void
    {
        if(renderTarget !== this._activeRenderTarget)
        {
            this._activeRenderTarget = renderTarget;
            renderTarget.activate();
            if (this._activeShader)
            {
                this._activeShader.uniforms.projectionMatrix = renderTarget.projectionMatrix.toArray(true);
            }
            if(this.stencilManager)
            {
                this.stencilManager.setMaskStack(renderTarget.stencilMaskStack);
            }            
        }
    }

    public start():void
    {
        if(this._started)
        {
            return;
        }
        this._started = true;
        this.setOptionsRendering();
        if(!this.stageOptions.context)
        {
            this.show('Could not create context');
            return;
        }
        this.setMaskManager();        
        this.setDefaultObjectRenderer();
        this.setTextureManager();
        this.setFilterManager();
        if(Utils.validateMasking(this.stageOptions.context))
        {
            this.setStencilmanager();
        }
        this.CONTEXT_UID++;        
        this.renderingToScreen = true;        
        this.drawModes = Utils.mapWebGLDrawModesToPixi(this.stageOptions.context);
        this._nextTextureLocation = 0;
        this.state.setBlendMode(0);        
        if (this.stageOptions.context.isContextLost() && this.stageOptions.context.getExtension('WEBGL_lose_context'))
        {
            this.stageOptions.context.getExtension('WEBGL_lose_context').restoreContext();
        }
        Timer.shared.add(this.update, this, Constants.UPDATE_PRIORITY.LOW);
        Timer.shared.start();
    }

    public flush():void
    {
        this.setObjectRenderer(this.emptyRenderer);
    }

    public setObjectRenderer(objectRenderer:ObjectRenderer):void
    {
        if (this._currentRenderer === objectRenderer)
        {
            return;
        }        
        this._currentRenderer.stop(); 
        this._currentRenderer = objectRenderer;     
        this._currentRenderer.stageContext = this;          
        this._currentRenderer.start();
    }

    public get textureGCCount():number
    {
        return this._textureGC.count;
    }

    private update():void
    {
        this.render(this);
    }

    public render(displayObject:DisplayObject, renderTexture:RenderTexture = null, clear:boolean = true, transform:Transform = null, skipUpdateTransform:boolean = false):void
    {        
        if(this.hasEventListener(Event.ENTER_FRAME))
        {
            if(!this._enterFrameEvent)
            {
                this._enterFrameEvent = new Event(Event.ENTER_FRAME);
            }
            this.dispatchEvent(this._enterFrameEvent);
        }
        this.renderingToScreen = !renderTexture;
        if (!this.stageOptions.context || this.stageOptions.context.isContextLost())
        {
            return;
        }
        this._nextTextureLocation = 0;
        if (!renderTexture)
        {
            this._lastObjectRendered = displayObject;
        }
        if (!skipUpdateTransform)
        {
            const cacheParent = displayObject.parent;
            displayObject.parent = this.emptyRoot;
            displayObject.updateTransform();
            displayObject.parent = cacheParent;
        }
        this.bindRenderTexture(renderTexture, transform);
        this._currentRenderer.start();           
        if (this.stageOptions.clearBeforeRender)
        {            
            this._activeRenderTarget.clear(this._backgroundColorRgba);
        }
        displayObject.renderWebGL();
        this._currentRenderer.flush();
        this.setObjectRenderer(this.emptyRenderer);
        this._textureGC.update();
        if(this._invalidate)
        {
            this._invalidate = false;
            this.dispatchEvent(this._renderEvent);
        }
        if(this.hasEventListener(Event.EXIT_FRAME))
        {
            if(!this._exitFrameEvent)
            {
                this._exitFrameEvent = new Event(Event.EXIT_FRAME);
            }
            this.dispatchEvent(this._exitFrameEvent);
        }
    }

    protected bindRenderTexture(renderTexture:RenderTexture, transform:Transform):void
    {
        let renderTarget;
        if (renderTexture)
        {
            const baseTexture:BaseTexture = renderTexture.baseTexture;
            if (!baseTexture._glRenderTargets[this.CONTEXT_UID])
            {
                this.textureManager.updateTexture(baseTexture, 0);
            }
            this.unbindTexture(baseTexture);
            renderTarget = baseTexture._glRenderTargets[this.CONTEXT_UID];
            renderTarget.setFrame(renderTexture.frame);
        }
        else
        {
            renderTarget = this.rootRenderTarget;
        }
        renderTarget.transform = transform;
        this.bindRenderTarget(renderTarget);
    }

    public unbindTexture(value:Texture|BaseTexture):void
    {
        var basetex:Texture|BaseTexture = value
        if(value instanceof Texture)
        {
            basetex = value.baseTexture
        }
        for (let i:number = 0; i < this._boundTextures.length; i++)
        {
            if (this._boundTextures[i] === basetex)
            {
                this._boundTextures[i] = this._emptyTextures[i];
                this.stageOptions.context.activeTexture(this.stageOptions.context.TEXTURE0 + i);
                this.stageOptions.context.bindTexture(this.stageOptions.context.TEXTURE_2D, this._emptyTextures[i]._glTextures[this.CONTEXT_UID].texture);
            }
        }
    }

    public get emptyTextures():any
    {
        return this._emptyTextures;
    }

    public get boundTextures():Array<BaseTexture>
    {
        return this._boundTextures;
    }

    public createVao():VertexArrayObject
    {
        return new VertexArrayObject(this.context, this.state.attribState);
    }

    public stop():void
    {
        this._started = false;
        Timer.shared.remove(this.update, this);
    }

    public getFilterManager():FilterManager
    {
        return this.filterManager;
    }

    protected setFilterManager():void
    {
        if(this.filterManager)
        {
            return;
        }
        this.filterManager = new FilterManager();
    }

    public getTextureManager():TextureManager
    {
        return this.textureManager;
    }

    protected setTextureManager():void
    {
        if(this.textureManager)
        {
            return;
        }
        this.textureManager = new TextureManager();
        this.textureManager.stage = this;
    }

    protected setDefaultObjectRenderer():void
    {
        if(this.emptyRenderer)
        {
            return;
        }
        this.emptyRenderer = new ObjectRenderer();
        this._currentRenderer = this.emptyRenderer;
    }

    protected setStencilmanager():void
    {
        if(this.stencilManager)
        {
            return;
        }
        this.stencilManager = new StencilManager();
    }

    public getMaskManager():MaskManager
    {
        return this.maskManager;
    }

    protected setMaskManager():void
    {
        if(this.maskManager)
        {
            return;
        }
        this.maskManager = new MaskManager();
    }

    public get emptyRoot():IDisplayObjectContainer
    {
        if (this._tempDisplayObjectParent == null)
        {
            var temp:DisplayObjectContainer = new DisplayObjectContainer();
            this._tempDisplayObjectParent = temp;
        }
        return this._tempDisplayObjectParent;
    }

    protected handleContextRestored = (event:WebGLContextEvent)=>
    {
        this.textureManager.removeAll();
        this.filterManager.destroy(true);
        this.setOptionsRendering();
    }

    protected handleContextLost = (event:WebGLContextEvent)=>
    {
        event.preventDefault();
    }

    protected resize(screenWidth:number, screenHeight:number):void
    {
        if(!this.stageOptions.view)
        {
            return;
        }
        this._screen.width = screenWidth;
        this._screen.height = screenHeight;
        this.stageOptions.view.width = screenWidth * this.stageOptions.resolution;
        this.stageOptions.view.height = screenHeight * this.stageOptions.resolution;
        if (this.stageOptions.autoResize)
        {
            this.stageOptions.view.style.width = `${screenWidth}px`;
            this.stageOptions.view.style.height = `${screenHeight}px`;
        }
    }

    public destroy():void
    {
        if(this.stageOptions.view)
        {
            this.stageOptions.view.parentNode.removeChild(this.stageOptions.view);
        }
        this.stageOptions.view = null;
        this._screen = null;
        this.stageOptions = null;
        this._backgroundColorRgba = null;
        this._backgroundColorString = null;
        this._lastObjectRendered = null;
    }

    public generateTexture(displayObject:DisplayObject, scaleMode:number, resolution:number, region:Rectangle):Texture
    {
        region = region || displayObject.getLocalBounds();
        const renderTexture:RenderTexture = RenderTexture.create(region.width | 0, region.height | 0, scaleMode, resolution);
        Matrix.GLOBAL.tx = -region.x;
        Matrix.GLOBAL.ty = -region.y;
        //this.render(displayObject, renderTexture, false, Matrix.GLOBAL, true);
        return renderTexture;
    }

    public get height():number
    {
        if(this.stageOptions.view)
        {
            return this.stageOptions.view.height;
        }
        return 0;
    }

    public get width():number
    {
        if(this.stageOptions.view)
        {
            return this.stageOptions.view.width;
        }
        return 0;
    }

    public get align():string
    {
        return this._align;
    }

    public set align(value:string)
    {
        this._align = value;
    }
    
    public get allowsFullScreen():boolean    
    {
        return this._allowsFullScreen;
    }
    
    public get allowsFullScreenInteractive():boolean
    {
        return this._allowsFullScreen;
    }
    
    public get autoOrients():boolean
    {
        return this._autoOrients;
    }
    
    public set autoOrients(value:boolean)
    {
        this._autoOrients = value;
    }
    
    public get color():number
    {
        return this._color;
    }
    
    public set color(value:number)
    {
        this._color = value;
    }
    
    public get orientation():string
    {
        return this._orientation;
    }
    
    public get scaleMode():string
    {
        return this._scaleMode;
    }
    
    public set scaleMode(value:string)
    {
        this._scaleMode = value;
    }
    
    public get stageHeight():number
    {
        return this._stageHeight;
    }
    
    public set stageHeight(value:number)
    {
        this._stageHeight = value;
    }
    
    public get stageWidth():number
    {
        return this._stageWidth;
    }
    
    public set stageWidth(value:number)
    {
        this._stageWidth = value;
    }
    
    public get supportedOrientations():string[]
    {
        return this._supportedOrientations;
    }
    
    public get quality():string
    {
        return this._quality;
    }
    
    public set quality(value:string)
    {
        this._quality = value;
    }
    
    public get deviceOrientation():string
    {
        return this._deviceOrientation;
    }
    
    public get displayState():string
    {
        return this._displayState;
    }
    
    public set displayState(value:string)
    {
        this._displayState = value;
    }
    
    public get focus():InteractiveObject
    {
        return this._focus;
    }
    
    public set focus(value:InteractiveObject)
    {
        this._focus = value;
    }
    
    public get frameRate():number
    {
        return StageSettings.FPS;
    }
    
    public set frameRate(value:number)
    {
        StageSettings.FPS = value;
    }
    
    public get fullScreenHeight():number
    {
        return this._fullScreenHeight;
    }
    
    public get fullScreenWidth():number
    {
        return this._fullScreenWidth;
    }
    
    public get fullScreenSourceRect():Rectangle
    {
        return this._fullScreenSourceRect;
    }
    
    public set fullScreenSourceRect(value:Rectangle)
    {
        this._fullScreenSourceRect = value;
    }
    

    public assignFocus(objectToFocus:InteractiveObject, direction:string):void
    {

    }
    
    public invalidate():void
    {
        this._invalidate = true;
    }
    
    public setAspectRatio(newAspectRatio:string):void
    {

    }
    
    public setOrientation(newOrientation:string):void
    {

    }

    public setCanvas(canvas:string|HTMLCanvasElement = null)
    {
        if(!canvas)
        {
            return;
        }
        if(typeof(canvas) == 'string')
        {
            var domcanvas:HTMLCanvasElement = <HTMLCanvasElement> document.getElementById(canvas)
            domcanvas.width = this.stageOptions.width;
            domcanvas.height = this.stageOptions.height;
            this.stageOptions.view = domcanvas;
        }
        else if(canvas instanceof HTMLCanvasElement)
        {
            this.stageOptions.view = canvas;
            this.stageOptions.width = canvas.width;
            this.stageOptions.height = canvas.height;
        }        
    }

    public getCanvasView():HTMLCanvasElement
    {
        return this.stageOptions.view;
    }

    public set canvasWidth(value:number)
    {
        this.stageOptions.width = value;
    }

    public set canvasHeight(value:number)
    {
        this.stageOptions.height = value;
    }

    public set canvasColor(value:number)
    {
        this.stageOptions.backgroundColor = value;
        this._backgroundColorRgba = Utils.hex2rgb(this.stageOptions.backgroundColor);
        this._backgroundColorString = Utils.hex2string(this.stageOptions.backgroundColor);
    }

    public get stage():Stage
    {
        return this;
    }

    public get canvasResolution():number
    {
        return this.stageOptions.resolution;
    }

    public set canvasResolution(value:number)
    {
        this.stageOptions.resolution = value;
    }

    public set canvasLegacy(value:boolean)
    {
        this.stageOptions.legacy = value;
    }

    public set canvasRoundPixels(value:boolean)
    {
        this.stageOptions.roundPixels = value;
    }

    public set canvasForceFXAA(value:boolean)
    {
        this.stageOptions.forceFXAA = value;
    }

    public set clearBeforeRender(value:boolean)
    {
        this.stageOptions.clearBeforeRender = value;
    }

    public set preserveDrawingBuffer(value:boolean)
    {
        this.stageOptions.preserveDrawingBuffer = value;
    }

    public set antialias(value:boolean)
    {
        this.stageOptions.antialias = value;
    }

    public set canvasAutoResize(value:boolean)
    {
        this.stageOptions.autoResize = value;
    }

    public set canvasTransparent(value:boolean)
    {
        this.stageOptions.transparent = value;
    }

    public get context():WebGLRenderingContext
    {
        if(this.stageOptions)
        {
            return this.stageOptions.context;
        }
        return null;
    }

    public getContextID():number
    {
        return this.CONTEXT_UID;
    }

    public getRenderState():WebGLState
    {
        return this.state;
    }

    public bindShader(shader:GLShader, autoProject:boolean = true):void
    {
        if (this._activeShader !== shader)
        {
            this._activeShader = shader;
            shader.bind();
            if (autoProject !== false)
            {
                shader.uniforms.projectionMatrix = this._activeRenderTarget.projectionMatrix.toArray(true);
            }
        }
    }

    public bindVao(vao:VertexArrayObject):void
    {
        if (this._activeVao === vao)
        {
            return;
        }
        if (vao)
        {
            vao.bind();
        }
        else if (this._activeVao)
        {
            this._activeVao.unbind();
        }
        this._activeVao = vao;
    }
    
}   

class StageOptions
{
    public width:number;
    public height:number;
    public resolution:number;
    public view:HTMLCanvasElement;
    public transparent:boolean;
    public autoResize:boolean;
    public antialias:boolean;
    public preserveDrawingBuffer:boolean;
    public clearBeforeRender:boolean;
    public backgroundColor:number;
    public roundPixels:boolean;
    public forceFXAA:boolean;
    public legacy:boolean;
    public context:WebGLRenderingContext;

    constructor()
    {
        this.context = null;
        this.legacy = false;
        this.backgroundColor = 0xFF0000;
        this.resolution = 1;
        this.roundPixels = false;
        this.forceFXAA = true;
        this.clearBeforeRender = true;
        this.preserveDrawingBuffer = true;
        this.antialias = false;
        this.autoResize = true;
        this.transparent = false;
        this.view = null;
        this.width = 800;
        this.height = 600;
    }
}