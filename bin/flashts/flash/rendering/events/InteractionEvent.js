define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class InteractionEvent {
        /**
         *
         */
        constructor() {
            /**
             * Whether this event will continue propagating in the tree
             *
             * @member {boolean}
             */
            this.stopped = false;
            /**
             * The object which caused this event to be dispatched.
             * For listener callback see {@link PIXI.interaction.InteractionEvent.currentTarget}.
             *
             * @member {PIXI.DisplayObject}
             */
            this.target = null;
            /**
             * The object whose event listener’s callback is currently being invoked.
             *
             * @member {PIXI.DisplayObject}
             */
            this.currentTarget = null;
            /**
             * Type of the event
             *
             * @member {string}
             */
            this.type = null;
            /**
             * InteractionData related to this event
             *
             * @member {PIXI.interaction.InteractionData}
             */
            this.data = null;
        }
        /**
         * Prevents event from reaching any objects other than the current object.
         *
         */
        stopPropagation() {
            this.stopped = true;
        }
        /**
         * Resets the event.
         */
        reset() {
            this.stopped = false;
            this.currentTarget = null;
            this.target = null;
        }
    }
    exports.InteractionEvent = InteractionEvent;
});
//# sourceMappingURL=InteractionEvent.js.map