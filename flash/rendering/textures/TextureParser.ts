import { Texture } from "flash/display3D/textures/Texture";
import { Resource } from "../loading/Resource";


class TextureParser
{
    public static textureParser ()
    {
        return function textureParser(resource, next)
        {
            // create a new texture if the data is an Image object
            if (resource.data && resource.type === Resource.TYPE.IMAGE)
            {
                resource.texture = Texture.fromLoader(
                    resource.data,
                    resource.url,
                    resource.name
                );
            }
            next();
        };
    }
}
export { TextureParser };