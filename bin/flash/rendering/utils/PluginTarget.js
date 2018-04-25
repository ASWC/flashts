define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class PluginTarget {
        /**
         * Adds a plugin to an object
         *
         * @param {string} pluginName - The events that should be listed.
         * @param {Function} ctor - The constructor function for the plugin.
         */
        static registerPlugin(pluginName, ctor) {
            PluginTarget.__plugins[pluginName] = ctor;
        }
        ;
        /**
         * Instantiates all the plugins of this object
         *
         */
        initPlugins() {
            this.plugins = this.plugins || {};
            for (const o in PluginTarget.__plugins) {
                this.plugins[o] = new (PluginTarget.__plugins[o])(this);
            }
        }
        ;
        /**
         * Removes all the plugins of this object
         *
         */
        destroyPlugins() {
            for (const o in this.plugins) {
                this.plugins[o].destroy();
                this.plugins[o] = null;
            }
            this.plugins = null;
        }
        ;
    }
    PluginTarget.__plugins = {};
    exports.PluginTarget = PluginTarget;
});
