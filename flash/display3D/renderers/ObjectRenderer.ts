
import { DisplayObject } from "flash/display/DisplayObject";
import { BaseObject } from "flash/display/BaseObject";
import { Stage } from "flash/display/Stage";

export class ObjectRenderer extends BaseObject
{
    public stageContext:Stage;
    
    public static get renderer():ObjectRenderer
    {
        return null;
    }

    public onContextChange(event:Event):void
    {
        
    }

    public destroy():void
    {
        
    }

    public start()
    {
       
    }

    public stop()
    {
        this.flush();
    }

    public flush()
    {
       
    }

    public render(object:DisplayObject)
    {
       
    }
}