define(["require", "exports", "flash/display/Bitmap", "flash/display3D/textures/Texture", "flash/display/Stage", "flash/display3D/textures/BaseTexture"], function (require, exports, Bitmap_1, Texture_1, Stage_1, BaseTexture_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Test extends Stage_1.Stage {
        constructor() {
            super();
            this.setCanvas("c");
            this.canvasColor = 0xA291FF;
            this.start();
            this.count = 0;
            // make this auto
            /*this.show("device: " + Capabilities.isMobileDevice)
    
            var text:Text = new Text("hello", new TextStyle())
            this.addChild(text);
            text.width = 400
            text.height = 60
            text.x = 300;
            text.y = 100
            text.style.fontSize = 40;*/
            /*var loader = new URLLoader();
            loader.dataFormat = URLLoaderDataFormat.BLOB;
            loader.addEventListener(Event.COMPLETE, this.handleComplete, this);
            loader.load(new URLRequest("b1.png"))
    
    
            var loader = new URLLoader();
            loader.dataFormat = URLLoaderDataFormat.BLOB;
            loader.addEventListener(Event.COMPLETE, this.handleComplete2, this);
            loader.load(new URLRequest("b2.png"))
    
            var loader = new URLLoader();
            loader.dataFormat = URLLoaderDataFormat.BLOB;
            loader.addEventListener(Event.COMPLETE, this.handleComplete3, this);
            loader.load(new URLRequest("b3.png"))*/
            /*var loader = new URLLoader();
            loader.dataFormat = URLLoaderDataFormat.BLOB;
            loader.addEventListener(Event.COMPLETE, this.handleComplete4, this);
            loader.load(new URLRequest("b4.png"))*/
            /*var text:Texture = Texture.WHITE
            var bitmap = new Bitmap(text)
            this.addChild(bitmap)
            bitmap.alpha = 1;
            bitmap.x = 0;
            bitmap.y = 0;*/
            var basetex = BaseTexture_1.BaseTexture.fromImage("b4.png", false, 1, 1); // is 18
            var basetex2 = BaseTexture_1.BaseTexture.fromImage("b3.png", false, 1, 1); // id 19
            var text = new Texture_1.Texture(basetex);
            var text2 = new Texture_1.Texture(basetex2);
            var bitmap = new Bitmap_1.Bitmap(text);
            this.addChild(bitmap);
            bitmap.x = 0;
            bitmap.y = 0;
            var bitmap = new Bitmap_1.Bitmap(text2);
            this.addChild(bitmap);
            bitmap.x = 200;
            bitmap.y = 0;
            //this.addChild(bitmap)
            //bitmap.alpha = 1;
            //bitmap.x = 0;
            //bitmap.y = 0;
            //var text:Texture = Texture.fromImage("b3.png")
            /*var bitmap = new Bitmap(text)
            this.addChild(bitmap)
            bitmap.alpha = 1;
            bitmap.x = 200;
            bitmap.y = 0;*/
            /*this.sprite = new Sprite();
            this.sprite.x = 400;
            this.sprite.y = 300;
            this.addChild(this.sprite);
            this.sprite.graphics.beginFill(0xFFFFFF * Math.random(), 1);
            this.sprite.graphics.drawRect(-100, -100, 200, 200)
            this.sprite.addEventListener(Event.ENTER_FRAME, this.handleEnterFrame, this);
    
    
           
            var shape:Shape = new Shape();
            shape.graphics.beginFill(0xFFFFFF * Math.random(), 1);
            shape.graphics.drawCircle(0, 0, 25)
            shape.x = 50;
            shape.y = 50;
            this.sprite.addChild(shape);*/
            // fix texture ids overlapping
            // set stage to display modes > fixed > resizing > filling > sizes
            // detect webgl support and handle it
            // support textfield + imput
            // support all loaders
        }
        handleComplete4(event) {
            var loader = event.currentTarget;
            var data = loader.data;
            var img = document.createElement('img');
            img.onload = function (e) {
                window.URL.revokeObjectURL(img.src);
            };
            img.src = window.URL.createObjectURL(data);
            var text = new Texture_1.Texture(new BaseTexture_1.BaseTexture(img));
            var bitmap = new Bitmap_1.Bitmap(text);
            this.addChild(bitmap);
            bitmap.alpha = 0.5;
            bitmap.x = 600;
            bitmap.y = 400;
            //document.body.appendChild(img);
        }
        handleComplete3(event) {
            var loader = event.currentTarget;
            var data = loader.data;
            var img = document.createElement('img');
            img.onload = function (e) {
                window.URL.revokeObjectURL(img.src);
            };
            img.src = window.URL.createObjectURL(data);
            var text = new Texture_1.Texture(new BaseTexture_1.BaseTexture(img));
            var bitmap = new Bitmap_1.Bitmap(text);
            this.addChild(bitmap);
            bitmap.alpha = 0.5;
            bitmap.x = 600;
            bitmap.y = 100;
            //document.body.appendChild(img);
        }
        handleComplete2(event) {
            var loader = event.currentTarget;
            var data = loader.data;
            var img = document.createElement('img');
            img.onload = function (e) {
                window.URL.revokeObjectURL(img.src);
            };
            img.src = window.URL.createObjectURL(data);
            var text = new Texture_1.Texture(new BaseTexture_1.BaseTexture(img));
            var bitmap = new Bitmap_1.Bitmap(text);
            this.addChild(bitmap);
            bitmap.alpha = 0.5;
            bitmap.x = 100;
            bitmap.y = 400;
            //document.body.appendChild(img);
        }
        handleComplete(event) {
            var loader = event.currentTarget;
            var data = loader.data;
            var img = document.createElement('img');
            img.onload = function (e) {
                window.URL.revokeObjectURL(img.src);
            };
            img.src = window.URL.createObjectURL(data);
            var text = new Texture_1.Texture(new BaseTexture_1.BaseTexture(img));
            var bitmap = new Bitmap_1.Bitmap(text);
            this.addChild(bitmap);
            bitmap.alpha = 0.5;
            bitmap.x = Math.random() * 1024;
            bitmap.y = Math.random() * 768;
            //document.body.appendChild(img);
        }
        handleEnterFrame(event) {
            this.sprite.rotation += 1.2;
            this.count++;
            if (this.count > 600) {
                this.count = 0;
                /*var loader = new URLLoader();
                loader.dataFormat = URLLoaderDataFormat.BLOB;
                loader.addEventListener(Event.COMPLETE, this.handleComplete, this);
                var target:number = Math.ceil(Math.random() * 4);
                this.show("loading " + target)
                loader.load(new URLRequest("b" + target + ".png"))*/
            }
            if (this.bitmap) {
                //this.bitmap.scaleX += 0.01
                //this.bitmap.scaleY += 0.01
            }
        }
    }
    exports.Test = Test;
});
//# sourceMappingURL=Test.js.map