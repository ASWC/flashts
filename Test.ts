

import { Tracer } from "flash/Tracer";
import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { Graphics } from "flash/display/Graphics";
import { Bitmap } from "flash/display/Bitmap";
import { Texture } from "flash/rendering/textures/Texture";
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
import { BaseTexture } from "flash/rendering/textures/BaseTexture";
import { Capabilities } from "flash/system/Capabilities";
import { Text } from "flash/rendering/display/Text";
import { TextStyle } from "flash/text/TextStyle";

export class Test extends Stage
{
    private sprite:Sprite;
    private loader:Loader;
    private urlloader:URLLoader;
    private bitmap:Bitmap;

    constructor()
    {
        super();

        this.setCanvas("c");
        this.canvasColor = 0xA291FF;
        this.start();
        // make this auto




        this.show("device: " + Capabilities.isMobileDevice)

        var text:Text = new Text("hello", new TextStyle())
        this.addChild(text);
        text.width = 400
        text.height = 60
        text.x = 300;
        text.y = 100
        text.style.fontSize = 40;
        


        this.urlloader = new URLLoader();
        this.urlloader.dataFormat = URLLoaderDataFormat.BLOB;
        this.urlloader.addEventListener(Event.COMPLETE, this.handleComplete, this);
        this.urlloader.load(new URLRequest("resource_7642.png"))


        var loader = new URLLoader();
        loader.dataFormat = URLLoaderDataFormat.BLOB;
        loader.addEventListener(Event.COMPLETE, this.handleComplete2, this);
        loader.load(new URLRequest("resource_7622.png"))
        
        


        this.sprite = new Sprite();
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
        this.sprite.addChild(shape);

        
        // fix texture ids overlapping
        
        // set stage to display modes > fixed > resizing > filling > sizes

        // detect webgl support and handle it

        // support textfield + imput

        // support all loaders

        


        
    }

    private handleComplete2(event:Event):void
    {
        var data:Blob = this.urlloader.data;
        var img = document.createElement('img');
        img.onload = function(e) {
            window.URL.revokeObjectURL(img.src);
        };
        img.src = window.URL.createObjectURL(data);

        var text:Texture = new Texture(new BaseTexture(img))
        this.bitmap = new Bitmap(text)
        this.addChild(this.bitmap)
        this.bitmap.alpha = 0.5;
        this.bitmap.x = 100;
        this.bitmap.y = 300;
        //document.body.appendChild(img);
    }

    private handleComplete(event:Event):void
    {
        var data:Blob = this.urlloader.data;
        var img = document.createElement('img');
        img.onload = function(e) {
            window.URL.revokeObjectURL(img.src);
        };
        img.src = window.URL.createObjectURL(data);

        var text:Texture = new Texture(new BaseTexture(img))
        this.bitmap = new Bitmap(text)
        this.addChild(this.bitmap)
        this.bitmap.alpha = 0.5;
        this.bitmap.x = 100;
        this.bitmap.y = 100;
        //document.body.appendChild(img);
    }

    private handleEnterFrame(event:Event):void
    {
        this.sprite.rotation += 1.2
        if(this.bitmap)
        {
            //this.bitmap.scaleX += 0.01
            //this.bitmap.scaleY += 0.01
        }
    }

  

    
    
}