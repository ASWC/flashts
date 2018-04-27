define(["require", "exports", "flash/events/EventDispatcher", "flash/rendering/math/Bounds", "flash/geom/Transform", "flash/geom/Point", "flash/geom/Matrix", "flash/geom/Rectangle", "flash/rendering/textures/RenderTexture", "flash/rendering/webgl/Utils", "flash/rendering/textures/BaseTexture", "flash/rendering/textures/Texture"], function (require, exports, EventDispatcher_1, Bounds_1, Transform_1, Point_1, Matrix_1, Rectangle_1, RenderTexture_1, Utils_1, BaseTexture_1, Texture_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CoreDisplayObject extends EventDispatcher_1.EventDispatcher {
        constructor() {
            super();
            this._mouseX = this._mouseX = 0;
            this._name = '';
            this._transform = new Transform_1.Transform();
            this._alpha = 1;
            this._visible = true;
            this._parent = null;
            this._filters = null;
            this._bounds = new Bounds_1.Bounds();
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
        getGlobalPosition(point = new Point_1.Point(), skipUpdate = false) {
            if (this._parent) {
                this._parent.toGlobal(this.position, point, skipUpdate);
            }
            else {
                point.x = this.position.x;
                point.y = this.position.y;
            }
            return point;
        }
        ;
        updateTransform() {
            if (this._parent) {
                this._transform.updateTransform(this._parent.transform);
                this._worldAlpha = this._alpha * this._parent.worldAlpha;
                this._bounds.updateID++;
            }
        }
        _calculateBounds() {
        }
        _recursivePostUpdateTransform() {
            if (this._parent) {
                this._parent._recursivePostUpdateTransform();
                this._transform.updateTransform(this._parent.transform);
            }
            else {
                this._transform.updateTransform(Transform_1.Transform.NEUTRAL);
            }
        }
        calculateBounds() {
            this._bounds.clear();
            this._calculateBounds();
            this._lastBoundsID = this._boundsID;
        }
        ;
        getBounds(skipUpdate = false, rect = null) {
            if (!skipUpdate) {
                if (!this._parent) {
                    this._parent = CoreDisplayObject.ROOT;
                    this.updateTransform();
                    this._parent = null;
                }
                else {
                    this._recursivePostUpdateTransform();
                    this.updateTransform();
                }
            }
            if (this._boundsID !== this._lastBoundsID) {
                this.calculateBounds();
            }
            if (!rect) {
                if (!this._boundsRect) {
                    this._boundsRect = new Rectangle_1.Rectangle();
                }
                rect = this._boundsRect;
            }
            return this._bounds.getRectangle(rect);
        }
        getLocalBounds(rect = null) {
            const transformRef = this._transform;
            const parentRef = this._parent;
            this._parent = null;
            this._transform = CoreDisplayObject.ROOT.transform;
            if (!rect) {
                if (!this._localBoundsRect) {
                    this._localBoundsRect = new Rectangle_1.Rectangle();
                }
                rect = this._localBoundsRect;
            }
            const bounds = this.getBounds(false, rect);
            this._parent = parentRef;
            this._transform = transformRef;
            return bounds;
        }
        toGlobal(position, point, skipUpdate = false) {
            if (!skipUpdate) {
                this._recursivePostUpdateTransform();
                if (!this._parent) {
                    this._parent = CoreDisplayObject.ROOT;
                    this.updateTransform();
                    this._parent = null;
                }
                else {
                    this.updateTransform();
                }
            }
            return this.worldTransform.apply(position, point);
        }
        destroy(options = null) {
            if (this._parent) {
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
        _renderCachedWebGL(renderer) {
            if (!this._visible || this._worldAlpha <= 0 || !this.renderable) {
                return;
            }
            this._initCachedDisplayObject(renderer);
            this._cacheData.sprite._transformID = -1;
            this._cacheData.sprite.worldAlpha = this._worldAlpha;
            this._cacheData.sprite._renderWebGL(renderer);
        }
        ;
        renderWebGL() {
        }
        _initCachedDisplayObject(renderer) {
            if (this._cacheData && this._cacheData.sprite) {
                return;
            }
            const cacheAlpha = this._alpha;
            this._alpha = 1;
            renderer.currentRenderer.flush();
            const bounds = this.getLocalBounds().clone();
            if (this._filters) {
                const padding = this._filters[0].padding;
                bounds.pad(padding, padding);
            }
            const cachedRenderTarget = renderer.activeRenderTarget;
            const stack = renderer.getFilterManager().filterStack;
            const renderTexture = RenderTexture_1.RenderTexture.create(bounds.width | 0, bounds.height | 0);
            const textureCacheId = `cacheAsBitmap_${Utils_1.Utils.uid()}`;
            this._cacheData.textureCacheId = textureCacheId;
            BaseTexture_1.BaseTexture.addToCache(renderTexture.baseTexture, textureCacheId);
            Texture_1.Texture.addToCache(renderTexture, textureCacheId);
            const m = Matrix_1.Matrix.TEMP_MATRIX;
            m.tx = -bounds.x;
            m.ty = -bounds.y;
            this._transform.worldTransform.identity();
            this.renderWebGL = this._cacheData.originalRenderWebGL;
            var transform = new Transform_1.Transform();
            transform.setFromMatrix(m);
            //renderer.render(this, renderTexture, true, transform, true);
            renderer.bindRenderTarget(cachedRenderTarget);
            renderer.getFilterManager().filterStack = stack;
            this.filterArea = null;
            //const cachedSprite:any = new Sprite(renderTexture); 
            this._cacheData.sprite = null; //SpriteBuffer.getSprite(renderTexture, this.transform.worldTransform, bounds, cacheAlpha, this._bounds);
            this._calculateBounds = this._calculateCachedBounds;
            this.getLocalBounds = this._getCachedLocalBounds;
            this._transform._parentID = -1;
            if (!this._parent) {
                this._parent = renderer.emptyRoot;
                this.updateTransform();
                this._parent = null;
            }
            else {
                this.updateTransform();
            }
            this.containsPoint = this._cacheData.sprite.containsPoint.bind(this._cacheData.sprite);
        }
        ;
        containsPoint(point = null) {
            return false;
        }
        _getCachedLocalBounds() {
            return this._cacheData.sprite.getLocalBounds();
        }
        ;
        _calculateCachedBounds() {
            this._cacheData.sprite._calculateBounds();
        }
        ;
        get cacheAsBitmap() {
            return this._cacheAsBitmap;
        }
        _cacheAsBitmapDestroy(options) {
            this.cacheAsBitmap = false;
            this.destroy(options);
        }
        ;
        _destroyCachedDisplayObject() {
            this._cacheData.sprite._texture.destroy(true);
            this._cacheData.sprite = null;
            BaseTexture_1.BaseTexture.removeFromCache(this._cacheData.textureCacheId);
            Texture_1.Texture.removeFromCache(this._cacheData.textureCacheId);
            this._cacheData.textureCacheId = null;
        }
        ;
        set cacheAsBitmap(value) {
            if (this._cacheAsBitmap === value) {
                return;
            }
            this._cacheAsBitmap = value;
            let data;
            if (value) {
                if (!this._cacheData) {
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
            else {
                data = this._cacheData;
                if (data.sprite) {
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
        set worldAlpha(value) {
            this._worldAlpha = value;
        }
        get worldAlpha() {
            return this._worldAlpha;
        }
        set alpha(value) {
            this._alpha = value;
        }
        get alpha() {
            return this._alpha;
        }
        set visible(value) {
            this._visible = value;
        }
        get visible() {
            return this._visible;
        }
        get width() {
            return this.scale.x * this.getLocalBounds().width;
        }
        set width(value) {
            const width = this.getLocalBounds().width;
            if (width !== 0) {
                this.scale.x = value / width;
            }
            else {
                this.scale.x = 1;
            }
            this._width = value;
        }
        get height() {
            return this.scale.y * this.getLocalBounds().height;
        }
        set height(value) {
            const height = this.getLocalBounds().height;
            if (height !== 0) {
                this.scale.y = value / height;
            }
            else {
                this.scale.y = 1;
            }
            this._height = value;
        }
        get x() {
            return this._transform.position.x;
        }
        set x(value) {
            this._transform.position.x = value;
        }
        get y() {
            return this._transform.position.y;
        }
        set y(value) {
            this._transform.position.y = value;
        }
        get worldTransform() {
            return this._transform.worldTransform;
        }
        get localTransform() {
            return this._transform.localTransform;
        }
        get position() {
            return this._transform.position;
        }
        set position(value) {
            this._transform.position.copy(value);
        }
        get scale() {
            return this._transform.scale;
        }
        set scale(value) {
            this._transform.scale.copy(value);
        }
        get pivot() {
            return this._transform.pivot;
        }
        set pivot(value) {
            this._transform.pivot.copy(value);
        }
        get skew() {
            return this._transform.skew;
        }
        set skew(value) {
            this._transform.skew.copy(value);
        }
        get name() {
            return this._name;
        }
        set name(value) {
            this._name = value;
        }
        get filters() {
            return this._filters && this._filters.slice();
        }
        set filters(value) {
            this._filters = value && value.slice();
        }
        get rotation() {
            return this._transform.rotation;
        }
        set rotation(value) {
            this._transform.rotation = value;
        }
        get transform() {
            return this._transform;
        }
        set transform(value) {
            this._transform = value;
        }
        get bounds() {
            return this._bounds;
        }
        set bounds(value) {
            this._bounds = value;
        }
        get scaleX() {
            return this._transform.scale.x;
        }
        set scaleX(value) {
            this._transform.scale.x = value;
        }
        get scaleY() {
            return this._transform.scale.y;
        }
        set scaleY(value) {
            this._transform.scale.y = value;
        }
        set parent(value) {
            this._parent = value;
        }
        get parent() {
            return this._parent;
        }
        get stage() {
            if (this._parent) {
                return this._parent.stage;
            }
            return null;
        }
        get mouseX() {
            return this._mouseX;
        }
        get mouseY() {
            return this._mouseY;
        }
    }
    exports.CoreDisplayObject = CoreDisplayObject;
    class CacheData {
        constructor() {
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
});
