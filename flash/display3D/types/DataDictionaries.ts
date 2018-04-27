import { GLAttributeData } from "flash/display3D/types/DataTypes";
import { WebGLData } from "flash/geom/shapes/WebGLData";

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

export interface numberDictionary 
{
    [name: string]: number;
}