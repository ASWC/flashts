define(["require", "exports", "flash/rendering/core/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class LoaderContext extends BaseObject_1.BaseObject {
        constructor(checkPolicyFile = false, applicationDomain = null, securityDomain = null) {
            super();
        }
    }
    exports.LoaderContext = LoaderContext;
});
