import { EventDispatcher } from "flash/events/EventDispatcher";
import { IBitmapDrawable } from "flash/display/IBitmapDrawable";
import { TransformBase } from "flash/rendering/math/TransformBase";
import { IDisplayObjectContainer } from "flash/display/IDisplayObjectContainer";
import { Bounds } from "flash/rendering/math/Bounds";
import { Filter } from "flash/rendering/filters/Filter";
import { Constants } from "flash/rendering/managers/Constants";
import { TransformStatic } from "flash/rendering/math/TransformStatic";
import { Transform } from "flash/geom/Transform";
import { Point } from "flash/geom/Point";
import { Matrix } from "flash/geom/Matrix";
import { Rectangle } from "flash/geom/Rectangle";
import { RenderTexture } from "flash/rendering/textures/RenderTexture";
import { Utils } from "flash/rendering/webgl/Utils";
import { BaseTexture } from "flash/rendering/textures/BaseTexture";
import { Texture } from "flash/rendering/textures/Texture";
import { IStage } from "flash/display3D/types/IStage";

export class CoreDisplayObject extends EventDispatcher implements IBitmapDrawable
{
    public static ROOT:IDisplayObjectContainer;
    protected _transform:TransformBase;    
    protected _alpha:number;
    protected _mouseX:number;
    protected _mouseY:number;
    protected _visible:boolean;
    protected _parent:IDisplayObjectContainer;
    protected _bounds:Bounds;    
    protected _filters:Filter[];
    protected _width:any;
    protected _height:any;
    protected _cacheAsBitmap:any;
    protected _name:string;
    protected _stage:IStage;
    public _worldAlpha:number;
    public _boundsID:any;    
    public _lastBoundsID:any;
    public _boundsRect:any;    
    public renderable:boolean;    
    public filterArea:Rectangle;    
    public _destroyed:boolean;
    public isMask:boolean;        
    public _cacheData:any;    
    public _localBoundsRect:any;    
    public  _enabledFilters:any;
    public interactive:any;
    public interactiveChildren:any;
    public _currentBounds:any; 

    constructor()
    {
        super();
        this._mouseX = this._mouseX = 0;
        this._name = ''; 
        this._transform = new Transform();
        this._alpha = 1;
        this._visible = true;
        this._parent = null;
        this._filters = null;
        this._bounds = new Bounds();        
        this.renderable = true;        
        this._worldAlpha = 1;
        this.filterArea = null;        
        this._enabledFilters = null;        
        this._boundsID = 0;
        this._lastBoundsID = -1;
        this._boundsRect = null;
        this._localBoundsRect = null;        
        this._destroyed = false;
    }

    public getGlobalPosition(point:Point = new Point(), skipUpdate:boolean = false):Point
    {
        if (this._parent)        
        {
            this._parent.toGlobal(this.position, point, skipUpdate);
        }
        else
        {
            point.x = this.position.x;
            point.y = this.position.y;
        }
        return point;
    };

    public updateTransform():void
    {
        if(this._parent)
        {
            this._transform.updateTransform(this._parent.transform);
            this._worldAlpha = this._alpha * this._parent.worldAlpha;
            this._bounds.updateID++;
        }        
    }

    public _calculateBounds():void
    {

    }

    public _recursivePostUpdateTransform():void
    {
        if (this._parent)
        {
            this._parent._recursivePostUpdateTransform();
            this._transform.updateTransform(this._parent.transform);
        }
        else
        {
            this._transform.updateTransform(Transform.NEUTRAL);
        }
    }

    public calculateBounds():void
    {
        this._bounds.clear();
        this._calculateBounds();
        this._lastBoundsID = this._boundsID;
    };

    public getBounds(skipUpdate:boolean = false, rect:Rectangle = null):Rectangle
    {
        if (!skipUpdate)
        {
            if (!this._parent)
            {
                this._parent = CoreDisplayObject.ROOT;
                this.updateTransform();
                this._parent = null;
            }
            else
            {
                this._recursivePostUpdateTransform();
                this.updateTransform();
            }
        }
        if (this._boundsID !== this._lastBoundsID)
        {
            this.calculateBounds();
        }
        if (!rect)
        {
            if (!this._boundsRect)
            {
                this._boundsRect = new Rectangle();
            }
            rect = this._boundsRect;
        }
        return this._bounds.getRectangle(rect);
    }

    public getLocalBounds(rect:Rectangle = null):Rectangle
    {
        const transformRef = this._transform;
        const parentRef = this._parent;
        this._parent = null;
        this._transform = CoreDisplayObject.ROOT.transform;
        if (!rect)
        {
            if (!this._localBoundsRect)
            {
                this._localBoundsRect = new Rectangle();
            }
            rect = this._localBoundsRect;
        }
        const bounds = this.getBounds(false, rect);
        this._parent = parentRef;
        this._transform = transformRef;
        return bounds;
    }

    public toGlobal(position:Point, point:Point, skipUpdate:boolean = false):Point
    {
        if (!skipUpdate)
        {
            this._recursivePostUpdateTransform();
            if (!this._parent)
            {
                this._parent = CoreDisplayObject.ROOT;
                this.updateTransform();
                this._parent = null;
            }
            else
            {
                this.updateTransform();
            }
        }
        return this.worldTransform.apply(position, point);
    }

    public destroy(options:any = null):void
    {
        if (this._parent)
        {
            //this._parent.removeChildren()
        }
        this._transform = null;
        this._parent = null;
        this._bounds = null;
        this._currentBounds = null;        
        this.filterArea = null;
        this.interactive = false;
        this.interactiveChildren = false;
        this._destroyed = true;
    }

    public _renderCachedWebGL(renderer:IStage):void
    {
        if (!this._visible || this._worldAlpha <= 0 || !this.renderable)
        {
            return;
        }
        this._initCachedDisplayObject(renderer);
        this._cacheData.sprite._transformID = -1;
        this._cacheData.sprite.worldAlpha = this._worldAlpha;
        this._cacheData.sprite._renderWebGL(renderer);
    };

    public renderWebGL():void 
    {
       
    }

    public _initCachedDisplayObject(renderer:IStage):void
    {
        if (this._cacheData && this._cacheData.sprite)
        {
            return;
        }
        const cacheAlpha = this._alpha;
        this._alpha = 1;
        renderer.currentRenderer.flush();
        const bounds = this.getLocalBounds().clone();
        if (this._filters)
        {
            const padding = this._filters[0].padding;
            bounds.pad(padding, padding);
        }
        const cachedRenderTarget = renderer.activeRenderTarget;
        const stack = renderer.getFilterManager().filterStack;
        const renderTexture = RenderTexture.create(bounds.width | 0, bounds.height | 0);
        const textureCacheId = `cacheAsBitmap_${Utils.uid()}`;
        this._cacheData.textureCacheId = textureCacheId;
        BaseTexture.addToCache(renderTexture.baseTexture, textureCacheId);
        Texture.addToCache(renderTexture, textureCacheId);
        const m = Matrix.TEMP_MATRIX;
        m.tx = -bounds.x;
        m.ty = -bounds.y;
        this._transform.worldTransform.identity();
        this.renderWebGL = this._cacheData.originalRenderWebGL;
        var transform:Transform = new Transform();
        transform.setFromMatrix(m);
        //renderer.render(this, renderTexture, true, transform, true);
        renderer.bindRenderTarget(cachedRenderTarget);
        renderer.getFilterManager().filterStack = stack;       
        this.filterArea = null;
        //const cachedSprite:any = new Sprite(renderTexture); 
        this._cacheData.sprite = null//SpriteBuffer.getSprite(renderTexture, this.transform.worldTransform, bounds, cacheAlpha, this._bounds);
        this._calculateBounds = this._calculateCachedBounds;
        this.getLocalBounds = this._getCachedLocalBounds;        
        this._transform._parentID = -1;
        if (!this._parent)
        {
            this._parent = renderer.emptyRoot;
            this.updateTransform();
            this._parent = null;
        }
        else
        {
            this.updateTransform();
        }
        this.containsPoint = this._cacheData.sprite.containsPoint.bind(this._cacheData.sprite);
    };

    public containsPoint(point:Point = null):boolean
    {
        return false;
    }

    public _getCachedLocalBounds():Rectangle
    {
        return this._cacheData.sprite.getLocalBounds();
    };

    public _calculateCachedBounds():void
    {
        this._cacheData.sprite._calculateBounds();
    };



    public get cacheAsBitmap():boolean
    {
        return this._cacheAsBitmap;
    }

    public _cacheAsBitmapDestroy(options:any)
    {
        this.cacheAsBitmap = false;
        this.destroy(options);
    };

    public _destroyCachedDisplayObject():void
    {
        this._cacheData.sprite._texture.destroy(true);
        this._cacheData.sprite = null;
        BaseTexture.removeFromCache(this._cacheData.textureCacheId);
        Texture.removeFromCache(this._cacheData.textureCacheId);
        this._cacheData.textureCacheId = null;
    };

    public set cacheAsBitmap(value:boolean)
    {
        if (this._cacheAsBitmap === value)
            {
                return;
            }
            this._cacheAsBitmap = value;
            let data;
            if (value)
            {
                if (!this._cacheData)
                {
                    this._cacheData = new CacheData();
                }
                data = this._cacheData;
                data.originalRenderWebGL = this.renderWebGL;
                data.originalUpdateTransform = this.updateTransform;
                data.originalCalculateBounds = this._calculateBounds;
                data.originalGetLocalBounds = this.getLocalBounds;
                data.originalDestroy = this.destroy;
                data.originalContainsPoint = this.containsPoint;
                //data.originalMask = this._mask;
                data.originalFilterArea = this.filterArea;
                this.destroy = this._cacheAsBitmapDestroy;
            }
            else
            {
                data = this._cacheData;
                if (data.sprite)
                {
                    this._destroyCachedDisplayObject();
                }
                this.renderWebGL = data.originalRenderWebGL;
                this._calculateBounds = data.originalCalculateBounds;
                this.getLocalBounds = data.originalGetLocalBounds;
                this.destroy = data.originalDestroy;
                this.updateTransform = data.originalUpdateTransform;
                this.containsPoint = data.originalContainsPoint;
                //this._mask = data.originalMask;
                this.filterArea = data.originalFilterArea;
            }
    }

    public set worldAlpha(value:number)
    {
        this._worldAlpha = value;
    }

    public get worldAlpha():number
    {
        return this._worldAlpha;
    }

    public set alpha(value:number)
    {
        this._alpha = value;
    }

    public get alpha():number
    {
        return this._alpha;
    }

    public set visible(value:boolean)
    {
        this._visible = value;
    }

    public get visible():boolean
    {
        return this._visible;
    }

    public get width():number
    {
        return this.scale.x * this.getLocalBounds().width;
    }

    public set width(value:number) 
    {
        const width = this.getLocalBounds().width;
        if (width !== 0)
        {
            this.scale.x = value / width;
        }
        else
        {
            this.scale.x = 1;
        }
        this._width = value;
    }

    public get height():number
    {
        return this.scale.y * this.getLocalBounds().height;
    }

    public set height(value:number) 
    {
        const height = this.getLocalBounds().height;
        if (height !== 0)
        {
            this.scale.y = value / height;
        }
        else
        {
            this.scale.y = 1;
        }
        this._height = value;
    }

    public get x():number
    {
        return this._transform.position.x;
    }

    public set x(value:number)
    {
        this._transform.position.x = value;
    }

    public get y():number
    {
        return this._transform.position.y;
    }

    public set y(value:number) 
    {
        this._transform.position.y = value;
    }

    public get worldTransform():Matrix
    {
        return this._transform.worldTransform;
    }

    public get localTransform():Matrix
    {
        return this._transform.localTransform;
    }

    public get position():Point
    {
        return this._transform.position;
    }

    public set position(value:Point)
    {
        this._transform.position.copy(value);
    }

    public get scale():Point
    {
        return this._transform.scale;
    }

    public set scale(value:Point)
    {
        this._transform.scale.copy(value);
    }

    public get pivot():Point
    {
        return this._transform.pivot;
    }

    public set pivot(value:Point) 
    {
        this._transform.pivot.copy(value);
    }

    public get skew():Point
    {
        return this._transform.skew;
    }

    public set skew(value:Point) 
    {
        this._transform.skew.copy(value);
    }
    
    public get name():string
    {
        return this._name;
    }

    public set name(value:string)
    {
        this._name = value;
    }

    public get filters():Filter[]
    {
        return this._filters && this._filters.slice();
    }

    public set filters(value:Filter[]) 
    {
        this._filters = value && value.slice();
    }

    public get rotation():number
    {
        return this._transform.rotation;
    }

    public set rotation(value:number)
    {
        this._transform.rotation = value;
    }

    public get transform():TransformBase
    {
        return this._transform;
    }

    public set transform(value:TransformBase)
    {
        this._transform = value;
    }

    public get bounds():Bounds
    {
        return this._bounds;
    }

    public set bounds(value:Bounds)
    {
        this._bounds = value;
    }  

    public get scaleX():number
    {
        return this._transform.scale.x;
    }

    public set scaleX(value:number)
    {
        this._transform.scale.x = value;
    }

    public get scaleY():number
    {
        return this._transform.scale.y;
    }

    public set scaleY(value:number)
    {
        this._transform.scale.y = value;
    }

    public set parent(value:IDisplayObjectContainer)
    {
        this._parent = value;
    }

    public get parent():IDisplayObjectContainer
    {
        return this._parent;
    }

    public get stage():IStage
    {
        if(this._parent)
        {
            return this._parent.stage;
        }
        return null;
    }  

    public get mouseX():number
    {
        return this._mouseX;
    }

    public get mouseY():number
    {
        return this._mouseY;
    }
}

class CacheData
{
    public sprite:any;
    public originalDestroy:any;
    public textureCacheId:any;
    public originalUpdateTransform:any;
    public originalCalculateBounds:any;
    public originalRenderCanvas:any;
    public originalGetLocalBounds:any;
    public originalHitTest:any;
    public originalMask:any;
    public originalFilterArea:any;
    public originalRenderWebGL:any;

    constructor()
    {
        this.textureCacheId = null;

        this.originalRenderWebGL = null;
        this.originalRenderCanvas = null;
        this.originalCalculateBounds = null;
        this.originalGetLocalBounds = null;

        this.originalUpdateTransform = null;
        this.originalHitTest = null;
        this.originalDestroy = null;
        this.originalMask = null;
        this.originalFilterArea = null;
        this.sprite = null;
    }
}