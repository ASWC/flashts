define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Plugins {
        /**
         * Mixes all enumerable properties and methods from a source object to a target object.
         *
         * @memberof PIXI.utils.mixins
         * @function mixin
         * @param {object} target The prototype or instance that properties and methods should be added to.
         * @param {object} source The source of properties and methods to mix in.
         */
        static mixin(target, source) {
            if (!target || !source)
                return;
            // in ES8/ES2017, this would be really easy:
            // Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
            // get all the enumerable property keys
            const keys = Object.keys(source);
            // loop through properties
            for (let i = 0; i < keys.length; ++i) {
                const propertyName = keys[i];
                // Set the property using the property descriptor - this works for accessors and normal value properties
                Object.defineProperty(target, propertyName, Object.getOwnPropertyDescriptor(source, propertyName));
            }
        }
        /**
         * Queues a mixin to be handled towards the end of the initialization of PIXI, so that deprecation
         * can take effect.
         *
         * @memberof PIXI.utils.mixins
         * @function delayMixin
         * @private
         * @param {object} target The prototype or instance that properties and methods should be added to.
         * @param {object} source The source of properties and methods to mix in.
         */
        static delayMixin(target, source) {
            Plugins.mixins.push(target, source);
        }
        /**
         * Handles all mixins queued via delayMixin().
         *
         * @memberof PIXI.utils.mixins
         * @function performMixins
         * @private
         */
        static performMixins() {
            for (let i = 0; i < Plugins.mixins.length; i += 2) {
                Plugins.mixin(Plugins.mixins[i], Plugins.mixins[i + 1]);
            }
            Plugins.mixins.length = 0;
        }
    }
    Plugins.mixins = [];
    exports.Plugins = Plugins;
});
