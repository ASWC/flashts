

import { Tracer } from "flash/Tracer";
import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { Graphics } from "flash/display/Graphics";
import { Bitmap } from "flash/display/Bitmap";
import { Texture } from "flash/display3D/textures/Texture";
import { Stage } from "flash/display/Stage";
import { DisplayObject } from "flash/display/DisplayObject";
import { Shape } from "flash/display/Shape";
import { Sprite } from "flash/display/Sprite";
import { Loader } from "flash/display/Loader";
import { InteractiveObject } from "flash/display/InteractiveObject";
import { Event } from "flash/events/Event";
import { Utils } from "flash/rendering/math/Utils";
import { Constants } from "flash/rendering/managers/Constants";
import { Polygon } from "flash/geom/shapes/Polygon";
import { URLRequest } from "flash/net/URLRequest";
import { URLLoader } from "flash/net/URLLoader";
import { URLLoaderDataFormat } from "flash/net/URLLoaderDataFormat";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { Capabilities } from "flash/system/Capabilities";
import { Text } from "flash/rendering/display/Text";
import { TextStyle } from "flash/text/TextStyle";

export class Test extends Stage
{
    private sprite:Sprite;
    private loader:Loader;
    private urlloader:URLLoader;
    private bitmap:Bitmap;
    private count:number;

    constructor()
    {
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

        var basetex = BaseTexture.fromImage("b4.png", false, 1, 1); // is 18
        var basetex2 = BaseTexture.fromImage("b3.png", false, 1, 1); // id 19

        

        var text:Texture = new Texture(basetex);
        var text2:Texture = new Texture(basetex2);


        var bitmap = new Bitmap(text)
        this.addChild(bitmap)
        bitmap.x = 0;
        bitmap.y = 0;


        var bitmap = new Bitmap(text2)
        this.addChild(bitmap)
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

    private handleComplete4(event:Event):void
    {
        var loader = event.currentTarget
        var data:Blob = loader.data;
        var img = document.createElement('img');
        img.onload = function(e) {
            window.URL.revokeObjectURL(img.src);
        };
        img.src = window.URL.createObjectURL(data);

        var text:Texture = new Texture(new BaseTexture(img))
        var bitmap = new Bitmap(text)
        this.addChild(bitmap)
        bitmap.alpha = 0.5;
        bitmap.x = 600;
        bitmap.y = 400;
        //document.body.appendChild(img);
    }

    private handleComplete3(event:Event):void
    {
        var loader = event.currentTarget
        var data:Blob = loader.data;
        var img = document.createElement('img');
        img.onload = function(e) {
            window.URL.revokeObjectURL(img.src);
        };
        img.src = window.URL.createObjectURL(data);

        var text:Texture = new Texture(new BaseTexture(img))
        var bitmap = new Bitmap(text)
        this.addChild(bitmap)
        bitmap.alpha = 0.5;
        bitmap.x = 600;
        bitmap.y = 100;
        //document.body.appendChild(img);
    }

    private handleComplete2(event:Event):void
    {
        var loader = event.currentTarget
        var data:Blob = loader.data;
        var img = document.createElement('img');
        img.onload = function(e) {
            window.URL.revokeObjectURL(img.src);
        };
        img.src = window.URL.createObjectURL(data);

        var text:Texture = new Texture(new BaseTexture(img))
        var bitmap = new Bitmap(text)
        this.addChild(bitmap)
        bitmap.alpha = 0.5;
        bitmap.x = 100;
        bitmap.y = 400;
        //document.body.appendChild(img);
    }

    private handleComplete(event:Event):void
    {
        var loader = event.currentTarget
        var data:Blob = loader.data;
        var img = document.createElement('img');
        img.onload = function(e) {
            window.URL.revokeObjectURL(img.src);
        };
        img.src = window.URL.createObjectURL(data);

        var text:Texture = new Texture(new BaseTexture(img))
        var bitmap = new Bitmap(text)
        this.addChild(bitmap)
        bitmap.alpha = 0.5;
        bitmap.x = Math.random() * 1024;
        bitmap.y = Math.random() * 768;
        //document.body.appendChild(img);
    }

    private handleEnterFrame(event:Event):void
    {
        this.sprite.rotation += 1.2

        this.count++;
        if(this.count > 600)
        {
            this.count = 0;
            /*var loader = new URLLoader();
            loader.dataFormat = URLLoaderDataFormat.BLOB;
            loader.addEventListener(Event.COMPLETE, this.handleComplete, this);
            var target:number = Math.ceil(Math.random() * 4);
            this.show("loading " + target)
            loader.load(new URLRequest("b" + target + ".png"))*/

        }
        if(this.bitmap)
        {
            //this.bitmap.scaleX += 0.01
            //this.bitmap.scaleY += 0.01
        }
    }

  

    
    
}