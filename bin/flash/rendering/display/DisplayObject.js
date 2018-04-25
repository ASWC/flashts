define(["require", "exports", "../Settings", "../managers/Constants", "../math/TransformStatic", "../../geom/Transform", "../math/Bounds", "flash/geom/Rectangle", "../../geom/Matrix", "../textures/RenderTexture", "../webgl/Utils", "../textures/BaseTexture", "../textures/Texture", "../../geom/Point", "./Container", "flash/events/EventDispatcher"], function (require, exports, Settings_1, Constants_1, TransformStatic_1, Transform_1, Bounds_1, Rectangle_1, Matrix_1, RenderTexture_1, Utils_1, BaseTexture_1, Texture_1, Point_1, Container_1, EventDispatcher_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class DisplayObject extends EventDispatcher_1.EventDispatcher {
        constructor() {
            super();
            this._name = '';
            const TransformClass = Settings_1.Settings.TRANSFORM_MODE === Constants_1.Constants.TRANSFORM_MODE.STATIC ? TransformStatic_1.TransformStatic : Transform_1.Transform;
            this.tempDisplayObjectParent = null;
            this.transform = new TransformClass();
            this._alpha = 1;
            this._visible = true;
            this.renderable = true;
            this._parent = null;
            this.worldAlpha = 1;
            this.filterArea = null;
            this._filters = null;
            this._enabledFilters = null;
            this._bounds = new Bounds_1.Bounds();
            this._boundsID = 0;
            this._lastBoundsID = -1;
            this._boundsRect = null;
            this._localBoundsRect = null;
            this._mask = null;
            this._destroyed = false;
        }
        get _tempDisplayObjectParent() {
            if (this.tempDisplayObjectParent === null) {
                this.tempDisplayObjectParent = new Container_1.Container();
            }
            return this.tempDisplayObjectParent;
        }
        containsPoint(point = null) {
            return false;
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
            this.transform.updateTransform(this._parent.transform);
            this.worldAlpha = this._alpha * this._parent.worldAlpha;
            this._bounds.updateID++;
        }
        _recursivePostUpdateTransform() {
            if (this._parent) {
                this._parent._recursivePostUpdateTransform();
                this.transform.updateTransform(this._parent.transform);
            }
            else {
                this.transform.updateTransform(this._tempDisplayObjectParent.transform);
            }
        }
        _calculateBounds() {
        }
        calculateBounds() {
            this._bounds.clear();
            this._calculateBounds();
            this._lastBoundsID = this._boundsID;
        }
        ;
        getBounds(skipUpdate = null, rect = null) {
            if (!skipUpdate) {
                if (!this._parent) {
                    this._parent = this._tempDisplayObjectParent;
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
            const transformRef = this.transform;
            const parentRef = this._parent;
            this._parent = null;
            this.transform = this._tempDisplayObjectParent.transform;
            if (!rect) {
                if (!this._localBoundsRect) {
                    this._localBoundsRect = new Rectangle_1.Rectangle();
                }
                rect = this._localBoundsRect;
            }
            const bounds = this.getBounds(false, rect);
            this._parent = parentRef;
            this.transform = transformRef;
            return bounds;
        }
        toGlobal(position, point, skipUpdate = false) {
            if (!skipUpdate) {
                this._recursivePostUpdateTransform();
                if (!this._parent) {
                    this._parent = this._tempDisplayObjectParent;
                    this.updateTransform();
                    this._parent = null;
                }
                else {
                    this.updateTransform();
                }
            }
            return this.worldTransform.apply(position, point);
        }
        toLocal(position, from, point, skipUpdate) {
            if (from) {
                position = from.toGlobal(position, point, skipUpdate);
            }
            if (!skipUpdate) {
                this._recursivePostUpdateTransform();
                if (!this._parent) {
                    this._parent = this._tempDisplayObjectParent;
                    this.updateTransform();
                    this._parent = null;
                }
                else {
                    this.updateTransform();
                }
            }
            return this.worldTransform.applyInverse(position, point);
        }
        renderWebGL(renderer) {
            //this.show("rendering " + this.className)
        }
        setParent(container) {
            if (!container || !container.addChild) {
                throw new Error('setParent: Argument must be a Container');
            }
            container.addChild(this);
            return container;
        }
        setTransform(x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0, skewX = 0, skewY = 0, pivotX = 0, pivotY = 0) {
            this.position.x = x;
            this.position.y = y;
            this.scale.x = !scaleX ? 1 : scaleX;
            this.scale.y = !scaleY ? 1 : scaleY;
            this.rotation = rotation;
            this.skew.x = skewX;
            this.skew.y = skewY;
            this.pivot.x = pivotX;
            this.pivot.y = pivotY;
            return this;
        }
        destroy(options = null) {
            if (this._parent) {
                this._parent.removeChild(this);
            }
            this.transform = null;
            this._parent = null;
            this._bounds = null;
            this._currentBounds = null;
            this._mask = null;
            this.filterArea = null;
            this.interactive = false;
            this.interactiveChildren = false;
            this._destroyed = true;
        }
        get mask() {
            return this._mask;
        }
        set mask(value) {
            if (this._mask) {
                this._mask.renderable = true;
                this._mask.isMask = false;
            }
            this._mask = value;
            if (this._mask) {
                this._mask.renderable = false;
                this._mask.isMask = true;
            }
        }
        _renderCachedWebGL(renderer) {
            if (!this._visible || this.worldAlpha <= 0 || !this.renderable) {
                return;
            }
            this._initCachedDisplayObject(renderer);
            this._cacheData.sprite._transformID = -1;
            this._cacheData.sprite.worldAlpha = this.worldAlpha;
            this._cacheData.sprite._renderWebGL(renderer);
        }
        ;
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
            const cachedRenderTarget = renderer._activeRenderTarget;
            const stack = renderer.filterManager.filterStack;
            const renderTexture = RenderTexture_1.RenderTexture.create(bounds.width | 0, bounds.height | 0);
            const textureCacheId = `cacheAsBitmap_${Utils_1.Utils.uid()}`;
            this._cacheData.textureCacheId = textureCacheId;
            BaseTexture_1.BaseTexture.addToCache(renderTexture.baseTexture, textureCacheId);
            Texture_1.Texture.addToCache(renderTexture, textureCacheId);
            const m = DisplayObject._tempMatrix;
            m.tx = -bounds.x;
            m.ty = -bounds.y;
            this.transform.worldTransform.identity();
            this.renderWebGL = this._cacheData.originalRenderWebGL;
            var transform = new Transform_1.Transform();
            transform.setFromMatrix(m);
            renderer.render(this, renderTexture, true, transform, true);
            renderer.bindRenderTarget(cachedRenderTarget);
            renderer.filterManager.filterStack = stack;
            this.renderWebGL = this._renderCachedWebGL;
            this._mask = null;
            this.filterArea = null;
            //const cachedSprite:any = new Sprite(renderTexture); 
            this._cacheData.sprite = null; //SpriteBuffer.getSprite(renderTexture, this.transform.worldTransform, bounds, cacheAlpha, this._bounds);
            this._calculateBounds = this._calculateCachedBounds;
            this.getLocalBounds = this._getCachedLocalBounds;
            this.transform._parentID = -1;
            if (!this._parent) {
                this._parent = renderer._tempDisplayObjectParent;
                this.updateTransform();
                this._parent = null;
            }
            else {
                this.updateTransform();
            }
            this.containsPoint = this._cacheData.sprite.containsPoint.bind(this._cacheData.sprite);
        }
        ;
        _calculateCachedBounds() {
            this._cacheData.sprite._calculateBounds();
        }
        ;
        _getCachedLocalBounds() {
            return this._cacheData.sprite.getLocalBounds();
        }
        ;
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
        get cacheAsBitmap() {
            return this._cacheAsBitmap;
        }
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
                data.originalMask = this._mask;
                data.originalFilterArea = this.filterArea;
                this.renderWebGL = this._renderCachedWebGL;
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
                this._mask = data.originalMask;
                this.filterArea = data.originalFilterArea;
            }
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
        set parent(value) {
            this._parent = value;
        }
        get parent() {
            return this._parent;
        }
        get x() {
            return this.position.x;
        }
        set x(value) {
            this.transform.position.x = value;
        }
        get y() {
            return this.position.y;
        }
        set y(value) {
            this.transform.position.y = value;
        }
        get worldTransform() {
            return this.transform.worldTransform;
        }
        get localTransform() {
            return this.transform.localTransform;
        }
        get position() {
            return this.transform.position;
        }
        set position(value) {
            this.transform.position.copy(value);
        }
        get scale() {
            return this.transform.scale;
        }
        set scale(value) {
            this.transform.scale.copy(value);
        }
        get pivot() {
            return this.transform.pivot;
        }
        set pivot(value) {
            this.transform.pivot.copy(value);
        }
        get skew() {
            return this.transform.skew;
        }
        set skew(value) {
            this.transform.skew.copy(value);
        }
        get name() {
            return this._name;
        }
        set name(value) {
            this._name = value;
        }
        get rotation() {
            return this.transform.rotation;
        }
        set rotation(value) {
            this.transform.rotation = value;
        }
        get worldVisible() {
            let item = this;
            do {
                if (!item._visible) {
                    return false;
                }
                item = item._parent;
            } while (item);
            return true;
        }
        get filters() {
            return this._filters && this._filters.slice();
        }
        set filters(value) {
            this._filters = value && value.slice();
        }
    }
    DisplayObject._tempMatrix = new Matrix_1.Matrix();
    exports.DisplayObject = DisplayObject;
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
