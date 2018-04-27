define(["require", "exports", "flash/rendering/webgl/Utils", "flash/events/Event", "flash/display/DisplayObject", "flash/geom/Transform"], function (require, exports, Utils_1, Event_1, DisplayObject_1, Transform_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // TYPED
    class DisplayObjectContainer extends DisplayObject_1.DisplayObject {
        constructor() {
            super();
            this.children = [];
        }
        contains(child) {
            var index = this.children.indexOf(child);
            if (index >= 0) {
                return true;
            }
            return false;
        }
        getChildByName(name) {
            for (let i = 0; i < this.children.length; i++) {
                if (this.children[i].name === name) {
                    return this.children[i];
                }
            }
            return null;
        }
        ;
        onChildrenChange(value = null) {
        }
        addChild(child) {
            if (!child) {
                return;
            }
            if (child.parent) {
                child.parent.removeChild(child);
            }
            child.parent = this;
            child.transform._parentID = -1;
            this.children.push(child);
            this._boundsID++;
            this.onChildrenChange(this.children.length - 1);
            child.dispatchEvent(new Event_1.Event(Event_1.Event.ADDED));
            return child;
        }
        addChildAt(child, index) {
            if (index < 0 || index > this.children.length) {
                throw new Error(`${child}addChildAt: The index ${index} supplied is out of bounds ${this.children.length}`);
            }
            if (child.parent) {
                child.parent.removeChild(child);
            }
            child.parent = this;
            child.transform._parentID = -1;
            this.children.splice(index, 0, child);
            this._boundsID++;
            this.onChildrenChange(index);
            child.dispatchEvent(new Event_1.Event(Event_1.Event.ADDED));
            return child;
        }
        swapChildren(child, child2) {
            if (child === child2) {
                return;
            }
            const index1 = this.getChildIndex(child);
            const index2 = this.getChildIndex(child2);
            this.children[index1] = child2;
            this.children[index2] = child;
            this.onChildrenChange(index1 < index2 ? index1 : index2);
        }
        getChildIndex(child) {
            const index = this.children.indexOf(child);
            if (index < 0) {
                throw new Error('The supplied DisplayObject must be a child of the caller');
            }
            return index;
        }
        setChildIndex(child, index) {
            if (index < 0 || index >= this.children.length) {
                throw new Error(`The index ${index} supplied is out of bounds ${this.children.length}`);
            }
            const currentIndex = this.getChildIndex(child);
            Utils_1.Utils.removeItems(this.children, currentIndex, 1);
            this.children.splice(index, 0, child);
            this.onChildrenChange(index);
        }
        getChildAt(index) {
            if (index < 0 || index >= this.children.length) {
                throw new Error(`getChildAt: Index (${index}) does not exist.`);
            }
            return this.children[index];
        }
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index < 0)
                return null;
            child.parent = null;
            child.transform._parentID = -1;
            Utils_1.Utils.removeItems(this.children, index, 1);
            this._boundsID++;
            this.onChildrenChange(index);
            child.dispatchEvent(new Event_1.Event(Event_1.Event.REMOVED));
            return child;
        }
        removeChildAt(index) {
            const child = this.getChildAt(index);
            child.parent = null;
            child.transform._parentID = -1;
            Utils_1.Utils.removeItems(this.children, index, 1);
            this._boundsID++;
            this.onChildrenChange(index);
            child.dispatchEvent(new Event_1.Event(Event_1.Event.REMOVED));
            return child;
        }
        removeChildren(beginIndex = 0, endIndex = 0) {
            const begin = beginIndex;
            const end = typeof endIndex === 'number' ? endIndex : this.children.length;
            const range = end - begin;
            let removed;
            if (range > 0 && range <= end) {
                removed = this.children.splice(begin, range);
                for (let i = 0; i < removed.length; ++i) {
                    removed[i].parent = null;
                    if (removed[i].transform) {
                        removed[i].transform._parentID = -1;
                    }
                }
                this._boundsID++;
                this.onChildrenChange(beginIndex);
                for (let i = 0; i < removed.length; ++i) {
                    removed[i].dispatchEvent(new Event_1.Event(Event_1.Event.REMOVED));
                }
                return removed;
            }
            else if (range === 0 && this.children.length === 0) {
                return [];
            }
            throw new RangeError('removeChildren: numeric values are outside the acceptable range.');
        }
        updateTransform() {
            if (this._parent) {
                this._boundsID++;
                this.transform.updateTransform(this.parent.transform);
                this.worldAlpha = this.alpha * this.parent.worldAlpha;
                for (let i = 0, j = this.children.length; i < j; ++i) {
                    const child = this.children[i];
                    if (child.visible) {
                        child.updateTransform();
                    }
                }
            }
        }
        calculateBounds() {
            this._bounds.clear();
            this._calculateBounds();
            for (let i = 0; i < this.children.length; i++) {
                const child = this.children[i];
                if (!child.visible || !child.renderable) {
                    continue;
                }
                child.calculateBounds();
                if (child.mask) {
                    child.mask.calculateBounds();
                    this._bounds.addBoundsMask(child.bounds, child.mask.bounds);
                }
                else if (child.filterArea) {
                    this._bounds.addBoundsArea(child.bounds, child.filterArea);
                }
                else {
                    this._bounds.addBounds(child.bounds);
                }
            }
            this._lastBoundsID = this._boundsID;
        }
        _calculateBounds() {
        }
        renderWebGL() {
            super.renderWebGL();
            if (!this.visible || this.worldAlpha <= 0 || !this.renderable) {
                return;
            }
            if (this.transform.requireUpdate) {
                if (this.parent) {
                    this.transform.updateWorldTransform(this.parent.transform);
                }
                else {
                    this.transform.updateWorldTransform(Transform_1.Transform.NEUTRAL);
                }
                this.transform.update();
            }
            if (this._mask || this._filters) {
                this.renderAdvancedWebGL();
            }
            else {
                this._renderWebGL();
                for (let i = 0, j = this.children.length; i < j; ++i) {
                    this.children[i].renderWebGL();
                }
            }
        }
        renderAdvancedWebGL() {
            if (!this.stage) {
                return;
            }
            this.stage.flush();
            const filters = this._filters;
            const mask = this._mask;
            if (filters) {
                if (!this._enabledFilters) {
                    this._enabledFilters = [];
                }
                this._enabledFilters.length = 0;
                for (let i = 0; i < filters.length; i++) {
                    if (filters[i].enabled) {
                        this._enabledFilters.push(filters[i]);
                    }
                }
                if (this._enabledFilters.length) {
                    this.stage.getFilterManager().pushFilter(this, this._enabledFilters);
                }
            }
            if (mask) {
                this.stage.getMaskManager().pushMask(this, this._mask);
            }
            this._renderWebGL();
            for (let i = 0, j = this.children.length; i < j; i++) {
                this.children[i].renderWebGL();
            }
            this.stage.flush();
            if (mask) {
                this.stage.getMaskManager().popMask(this, this._mask);
            }
            if (filters && this._enabledFilters && this._enabledFilters.length) {
                this.stage.getFilterManager().popFilter();
            }
        }
        _renderWebGL() {
        }
        destroy() {
            super.destroy();
            const oldChildren = this.removeChildren(0, this.children.length);
            for (let i = 0; i < oldChildren.length; ++i) {
                oldChildren[i].destroy();
            }
        }
        getChildren() {
            return this.children;
        }
        get mouseChildren() {
            return this._mouseChildren;
        }
        set mouseChildren(value) {
            this._mouseChildren = value;
            for (let i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                child['mouseEnabled'] = this._mouseChildren;
            }
        }
        get numChildren() {
            if (this.children) {
                return this.children.length;
            }
            return 0;
        }
    }
    exports.DisplayObjectContainer = DisplayObjectContainer;
});
//# sourceMappingURL=DisplayObjectContainer.js.map