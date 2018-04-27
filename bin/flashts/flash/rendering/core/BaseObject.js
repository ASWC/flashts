define(["require", "exports", "flash/Tracer"], function (require, exports, Tracer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseObject {
        constructor() {
            this._instanceName = "instance_" + BaseObject.instanceid.toString();
            this._name = this.className + "_" + BaseObject.instanceid.toString();
            BaseObject.instanceid++;
        }
        get instanceName() {
            return this._instanceName;
        }
        get className() {
            return this.constructor.name;
        }
        show(value) {
            Tracer_1.Tracer.show(value);
        }
        static show(value) {
            Tracer_1.Tracer.show(value);
        }
        reveal(value) {
            Tracer_1.Tracer.reveal(value);
        }
        static reveal(value) {
            Tracer_1.Tracer.show(value);
        }
        revealMethods(value) {
            Tracer_1.Tracer.revealMethods(value);
        }
        static revealMethods(value) {
            Tracer_1.Tracer.revealMethods(value);
        }
        getProperty(source, property) {
            return BaseObject.getProperty(source, property);
        }
        static getProperty(source, property) {
            if (source[property] != null) {
                return source[property];
            }
            return null;
        }
    }
    BaseObject.instanceid = 0;
    exports.BaseObject = BaseObject;
});
