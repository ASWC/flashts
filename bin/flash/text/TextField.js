define(["require", "exports", "flash/display/InteractiveObject", "flash/text/AntiAliasType", "flash/text/TextFieldAutoSize"], function (require, exports, InteractiveObject_1, AntiAliasType_1, TextFieldAutoSize_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextField extends InteractiveObject_1.InteractiveObject {
        constructor() {
            super();
            this._alwaysShowSelection = false;
            this._antiAliasType = AntiAliasType_1.AntiAliasType.NORMAL;
            this._autoSize = TextFieldAutoSize_1.TextFieldAutoSize.NONE;
            this._background = false;
            this._border = false;
            this._backgroundColor = 0xFFFFFF;
            this._borderColor = 0x000000;
            this._bottomScrollV = 1;
            this._caretIndex = 0;
            this._condenseWhite = false;
        }
        get condenseWhite() {
            return this._condenseWhite;
        }
        set condenseWhite(value) {
            this._condenseWhite = value;
        }
        get caretIndex() {
            return this._caretIndex;
        }
        get bottomScrollV() {
            return this._bottomScrollV;
        }
        get borderColor() {
            return this._borderColor;
        }
        set borderColor(value) {
            this._borderColor = value;
        }
        get border() {
            return this._border;
        }
        set border(value) {
            this._border = value;
        }
        get backgroundColor() {
            return this._backgroundColor;
        }
        set backgroundColor(value) {
            this._backgroundColor = value;
        }
        get background() {
            return this._background;
        }
        set background(value) {
            this._background = value;
        }
        get autoSize() {
            return this._autoSize;
        }
        set autoSize(value) {
            this._autoSize = value;
        }
        get alwaysShowSelection() {
            return this._alwaysShowSelection;
        }
        set alwaysShowSelection(value) {
            this._alwaysShowSelection = value;
        }
        get antiAliasType() {
            return this._antiAliasType;
        }
        set antiAliasType(value) {
            this._antiAliasType = value;
        }
    }
    exports.TextField = TextField;
});
//# sourceMappingURL=TextField.js.map