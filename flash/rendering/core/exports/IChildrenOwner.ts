import { DisplayObject } from "flash/display/DisplayObject";


export interface IChildrenOwner
{
    numChildren:number;
    contains(child:DisplayObject):boolean;
    getChildByName(name:string):DisplayObject;
    addChild(child:DisplayObject):DisplayObject;
    addChildAt(child:DisplayObject, index:number):DisplayObject;
    swapChildren(child:DisplayObject, child2:DisplayObject):void;
    getChildIndex(child:DisplayObject):number;
    setChildIndex(child:DisplayObject, index:number):void;
    getChildAt(index:number):DisplayObject;
    removeChild(child:DisplayObject):DisplayObject;
    removeChildAt(index:number):DisplayObject;
    removeChildren(beginIndex:number, endIndex:number):DisplayObject[];
    getChildren():DisplayObject[];
}