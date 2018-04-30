import { Point } from "flash/geom/Point";
import { TransformBase } from "flash/geom/TransformBase";
import { DisplayObject } from "flash/display/DisplayObject";
import { Stage } from "flash/display/Stage";
import { IStage } from "flash/display3D/types/IStage";

// TYPED

export interface IDisplayObjectContainer
{
    worldAlpha:number;
    transform:TransformBase;
    stage:IStage;
    removeChild(child:DisplayObject):DisplayObject
    _recursivePostUpdateTransform():void;
    toGlobal(position:Point, point:Point, skipUpdate:boolean):Point;
}