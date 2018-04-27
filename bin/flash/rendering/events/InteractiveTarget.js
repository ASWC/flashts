define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class InteractiveTarget {
        constructor() {
            /**
         * Map of all tracked pointers, by identifier. Use trackedPointers to access.
         *
         * @private
         * @type {Map<number, InteractionTrackingData>}
         */
            this._trackedPointers = undefined;
            /**
         * This defines what cursor mode is used when the mouse cursor
         * is hovered over the displayObject.
         *
         * @example
         * const sprite = new PIXI.Sprite(texture);
         * sprite.interactive = true;
         * sprite.cursor = 'wait';
         * @see https://developer.mozilla.org/en/docs/Web/CSS/cursor
         *
         * @member {string}
         * @memberof PIXI.DisplayObject#
         */
            this.cursor = null;
        }
        /**
         * If enabled, the mouse cursor use the pointer behavior when hovered over the displayObject if it is interactive
         * Setting this changes the 'cursor' property to `'pointer'`.
         *
         * @example
         * const sprite = new PIXI.Sprite(texture);
         * sprite.interactive = true;
         * sprite.buttonMode = true;
         * @member {boolean}
         * @memberof PIXI.DisplayObject#
         */
        get buttonMode() {
            return this.cursor === 'pointer';
        }
        set buttonMode(value) {
            if (value) {
                this.cursor = 'pointer';
            }
            else if (this.cursor === 'pointer') {
                this.cursor = null;
            }
        }
        /**
         * Internal set of all active pointers, by identifier
         *
         * @member {Map<number, InteractionTrackingData>}
         * @memberof PIXI.DisplayObject#
         * @private
         */
        get trackedPointers() {
            if (this._trackedPointers === undefined)
                this._trackedPointers = {};
            return this._trackedPointers;
        }
    }
    exports.InteractiveTarget = InteractiveTarget;
});
//# sourceMappingURL=InteractiveTarget.js.map