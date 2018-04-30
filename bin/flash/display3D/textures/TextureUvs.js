define(["require", "exports", "flash/display3D/textures/GroupD8"], function (require, exports, GroupD8_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextureUvs {
        constructor() {
            this._x0 = 0;
            this._y0 = 0;
            this._x1 = 1;
            this._y1 = 0;
            this._x2 = 1;
            this._y2 = 1;
            this._x3 = 0;
            this._y3 = 1;
            this._uvsUint32 = new Uint32Array(4);
        }
        get uvsUint32() {
            return this._uvsUint32;
        }
        get y1() {
            return this._y1;
        }
        get x2() {
            return this._x2;
        }
        get y2() {
            return this._y2;
        }
        get x3() {
            return this._x3;
        }
        get y3() {
            return this._y3;
        }
        get x1() {
            return this._x1;
        }
        get x0() {
            return this._x0;
        }
        get y0() {
            return this._y0;
        }
        set(frame, baseFrame, rotate) {
            const tw = baseFrame.width;
            const th = baseFrame.height;
            if (rotate) {
                const w2 = frame.width / 2 / tw;
                const h2 = frame.height / 2 / th;
                const cX = (frame.x / tw) + w2;
                const cY = (frame.y / th) + h2;
                rotate = GroupD8_1.GroupD8.add(rotate, GroupD8_1.GroupD8.NW);
                this._x0 = cX + (w2 * GroupD8_1.GroupD8.uX(rotate));
                this._y0 = cY + (h2 * GroupD8_1.GroupD8.uY(rotate));
                rotate = GroupD8_1.GroupD8.add(rotate, 2);
                this._x1 = cX + (w2 * GroupD8_1.GroupD8.uX(rotate));
                this._y1 = cY + (h2 * GroupD8_1.GroupD8.uY(rotate));
                rotate = GroupD8_1.GroupD8.add(rotate, 2);
                this._x2 = cX + (w2 * GroupD8_1.GroupD8.uX(rotate));
                this._y2 = cY + (h2 * GroupD8_1.GroupD8.uY(rotate));
                rotate = GroupD8_1.GroupD8.add(rotate, 2);
                this._x3 = cX + (w2 * GroupD8_1.GroupD8.uX(rotate));
                this._y3 = cY + (h2 * GroupD8_1.GroupD8.uY(rotate));
            }
            else {
                this._x0 = frame.x / tw;
                this._y0 = frame.y / th;
                this._x1 = (frame.x + frame.width) / tw;
                this._y1 = frame.y / th;
                this._x2 = (frame.x + frame.width) / tw;
                this._y2 = (frame.y + frame.height) / th;
                this._x3 = frame.x / tw;
                this._y3 = (frame.y + frame.height) / th;
            }
            this._uvsUint32[0] = (((this._y0 * 65535) & 0xFFFF) << 16) | ((this._x0 * 65535) & 0xFFFF);
            this._uvsUint32[1] = (((this._y1 * 65535) & 0xFFFF) << 16) | ((this._x1 * 65535) & 0xFFFF);
            this._uvsUint32[2] = (((this._y2 * 65535) & 0xFFFF) << 16) | ((this._x2 * 65535) & 0xFFFF);
            this._uvsUint32[3] = (((this._y3 * 65535) & 0xFFFF) << 16) | ((this._x3 * 65535) & 0xFFFF);
        }
    }
    exports.TextureUvs = TextureUvs;
});
//# sourceMappingURL=TextureUvs.js.map