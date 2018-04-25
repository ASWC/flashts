define(["require", "exports", "flash/geom/Point"], function (require, exports, Point_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ObservablePoint extends Point_1.Point {
        constructor(x = 0, y = 0) {
            super(x, y);
        }
    }
    exports.ObservablePoint = ObservablePoint;
});
