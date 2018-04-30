import { GLAttributeData } from "flash/display3D/types/DataTypes";
import { ShaderUnniformData } from "flash/display3D/types/DataTypes";
import { WebGLData } from "flash/geom/shapes/WebGLData";
import { RenderTarget } from "flash/display3D/textures/RenderTarget";
import { Texture } from "flash/display3D/textures/Texture";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";

export interface AttributeDataDictionary 
{
    [name: string]: GLAttributeData;
}

export interface ShaderUnnifromDataDictionary 
{
    [name: string]: ShaderUnniformData;
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

export interface numberNumberArrayDictionary 
{
    [name: number]: number[];
}

export interface RenderTargetDictionary
{
    [name: number]: RenderTarget;
}

export interface TextureDictionary
{
    [name: number]: Texture;
}

export interface BaseTextureDictionary
{
    [name: number]: BaseTexture;
}