define(["require", "exports", "flash/display/Bitmap", "flash/rendering/textures/Texture", "flash/display/Stage", "flash/display/Shape", "flash/display/Sprite", "flash/events/Event", "flash/net/URLRequest", "flash/net/URLLoader", "flash/net/URLLoaderDataFormat", "flash/rendering/textures/BaseTexture", "flash/system/Capabilities", "flash/rendering/display/Text", "flash/text/TextStyle"], function (require, exports, Bitmap_1, Texture_1, Stage_1, Shape_1, Sprite_1, Event_1, URLRequest_1, URLLoader_1, URLLoaderDataFormat_1, BaseTexture_1, Capabilities_1, Text_1, TextStyle_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Test extends Stage_1.Stage {
        constructor() {
            super();
            this.setCanvas("c");
            this.canvasColor = 0xA291FF;
            this.start();
            // make this auto
            this.show("device: " + Capabilities_1.Capabilities.isMobileDevice);
            var text = new Text_1.Text("hello", new TextStyle_1.TextStyle());
            this.addChild(text);
            text.width = 400;
            text.height = 60;
            text.x = 300;
            text.y = 100;
            text.style.fontSize = 40;
            this.urlloader = new URLLoader_1.URLLoader();
            this.urlloader.dataFormat = URLLoaderDataFormat_1.URLLoaderDataFormat.BLOB;
            this.urlloader.addEventListener(Event_1.Event.COMPLETE, this.handleComplete, this);
            this.urlloader.load(new URLRequest_1.URLRequest("resource_7642.png"));
            var loader = new URLLoader_1.URLLoader();
            loader.dataFormat = URLLoaderDataFormat_1.URLLoaderDataFormat.BLOB;
            loader.addEventListener(Event_1.Event.COMPLETE, this.handleComplete2, this);
            loader.load(new URLRequest_1.URLRequest("resource_7622.png"));
            this.sprite = new Sprite_1.Sprite();
            this.sprite.x = 400;
            this.sprite.y = 300;
            this.addChild(this.sprite);
            this.sprite.graphics.beginFill(0xFFFFFF * Math.random(), 1);
            this.sprite.graphics.drawRect(-100, -100, 200, 200);
            this.sprite.addEventListener(Event_1.Event.ENTER_FRAME, this.handleEnterFrame, this);
            var shape = new Shape_1.Shape();
            shape.graphics.beginFill(0xFFFFFF * Math.random(), 1);
            shape.graphics.drawCircle(0, 0, 25);
            shape.x = 50;
            shape.y = 50;
            this.sprite.addChild(shape);
            // fix texture ids overlapping
            // set stage to display modes > fixed > resizing > filling > sizes
            // detect webgl support and handle it
            // support textfield + imput
            // support all loaders
        }
        handleComplete2(event) {
            var data = this.urlloader.data;
            var img = document.createElement('img');
            img.onload = function (e) {
                window.URL.revokeObjectURL(img.src);
            };
            img.src = window.URL.createObjectURL(data);
            var text = new Texture_1.Texture(new BaseTexture_1.BaseTexture(img));
            this.bitmap = new Bitmap_1.Bitmap(text);
            this.addChild(this.bitmap);
            this.bitmap.alpha = 0.5;
            this.bitmap.x = 100;
            this.bitmap.y = 300;
            //document.body.appendChild(img);
        }
        handleComplete(event) {
            var data = this.urlloader.data;
            var img = document.createElement('img');
            img.onload = function (e) {
                window.URL.revokeObjectURL(img.src);
            };
            img.src = window.URL.createObjectURL(data);
            var text = new Texture_1.Texture(new BaseTexture_1.BaseTexture(img));
            this.bitmap = new Bitmap_1.Bitmap(text);
            this.addChild(this.bitmap);
            this.bitmap.alpha = 0.5;
            this.bitmap.x = 100;
            this.bitmap.y = 100;
            //document.body.appendChild(img);
        }
        handleEnterFrame(event) {
            this.sprite.rotation += 1.2;
            if (this.bitmap) {
                //this.bitmap.scaleX += 0.01
                //this.bitmap.scaleY += 0.01
            }
        }
    }
    exports.Test = Test;
});
//# sourceMappingURL=Test.js.map