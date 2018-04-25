import { ResourceLoader } from "./ResourceLoader";
import { Resource } from "./Resource";
import { TextureParser } from "../textures/TextureParser";
import { BitmapFontParser } from "../managers/BitmapFontParser";
import { SpritesheetParser } from "./SpritesheetParser";
import { Event } from "flash/events/Event";

export class Loader extends ResourceLoader
{
    public static _pixiMiddleware = [
        // parse any blob into more usable objects (e.g. Image)
        SpritesheetParser.blobMiddlewareFactory,
        // parse any Image objects into textures
        TextureParser.textureParser,
        // parse any spritesheet data into multiple textures
        SpritesheetParser.spritesheetParser,
        // parse bitmap font data into multiple textures
        BitmapFontParser.bitmapFontParser,
    ];

    /**
     * @param {string} [baseUrl=''] - The base url for all resources loaded by this loader.
     * @param {number} [concurrency=10] - The number of resources to load concurrently.
     */
    constructor(baseUrl, concurrency)
    {
        super(baseUrl, concurrency);

        Resource.setExtensionXhrType('fnt', Resource.XHR_RESPONSE_TYPE.DOCUMENT);

        for (let i = 0; i < Loader._pixiMiddleware.length; ++i)
        {
            this.use(Loader._pixiMiddleware[i]);
        }

        // Compat layer, translate the new v2 signals into old v1 events.
        this.onStart.add((l) => {
            //this.emit('start', l));
            this.dispatchEvent(new Event(Event.OPEN));
        })
        this.onProgress.add((l, r) => {

            //this.emit('progress', l, r));
            this.dispatchEvent(new Event(Event.OPEN));

        })
        this.onError.add((e, l, r) => {
            //this.emit('error', e, l, r)
        });
        this.onLoad.add((l, r) => {
            //this.emit('load', l, r)
        });
        this.onComplete.add((l, r) => {
            //this.emit('complete', l, r)
        });
    }

    /**
     * Adds a default middleware to the PixiJS loader.
     *
     * @static
     * @param {Function} fn - The middleware to add.
     */
    public static addPixiMiddleware(fn)
    {
        Loader._pixiMiddleware.push(fn);
    }

    /**
     * Destroy the loader, removes references.
     */
    public destroy()
    {
        this.reset();
    }
}