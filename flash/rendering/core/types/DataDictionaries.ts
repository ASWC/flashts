import { GLAttributeData } from "flash/rendering/core/types/DataTypes";
import { WebGLData } from "flash/rendering/core/shapes/WebGLData";

export interface AttributeDataDictionary 
{
    [name: string]: GLAttributeData;
}

export interface StringNumberDictionary 
{
    [name: string]: number;
}

export interface StringStringDictionary 
{
    [name: string]: string;
}

export interface WebGlDataDictionary 
{
    [name: string]: WebGLData;
}