define(["require", "exports", "../../display/DisplayObjectContainer"], function (require, exports, DisplayObjectContainer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function getDisplayObjectConatiner() {
        return class CoreDisplayObject extends DisplayObjectContainer_1.DisplayObjectContainer {
        };
    }
    exports.getDisplayObjectConatiner = getDisplayObjectConatiner;
});
