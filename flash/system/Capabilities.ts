import { TouchscreenType } from "flash/system/TouchscreenType";
import { BaseObject } from "flash/rendering/core/BaseObject";

export class Capabilities
{
    private static _mobileData:any;

    public static hasMultiChannelAudio(type:string):boolean
    {
        return true;
    }

    public static get isMobileDevice():boolean
    {
        if(MobileData.tablet && MobileData.phone)
        {
            return true;
        }


        return false;
    }

    public static get isWebGLSupported():boolean
    {
        var contextOptions = { stencil: true, failIfMajorPerformanceCaveat: true };
        try 
        {
            if (!window['WebGLRenderingContext']) 
            {
                return false;
            }    
            var canvas:HTMLCanvasElement = document.createElement('canvas');
            var gl:WebGLRenderingContext|CanvasRenderingContext2D = canvas.getContext('webgl', contextOptions) || canvas.getContext('experimental-webgl', contextOptions);  
            if(gl instanceof WebGLRenderingContext)
            {
                var success = !!(gl && gl.getContextAttributes().stencil);    
                if (gl) 
                {
                    var loseContext = gl.getExtension('WEBGL_lose_context');    
                    if (loseContext) 
                    {
                        loseContext.loseContext();
                    }
                }    
                gl = null;    
                return success;
            }              
        } 
        catch (e) 
        {
            return false;
        }
        return true;
    }

    public static get version():string
    {
        return "1.0.0";
    }

    public static get touchscreenType():string
    {
        return TouchscreenType.NOT_ACQUIRED;
    }

    public static get supports64BitProcesses():boolean
    {
        return true;
    }

    public static get supports32BitProcesses():boolean
    {
        return true;
    }

    public static get serverString():string
    {
        return 'color';
    }

    public static get screenResolutionY():number
    {
        // check
        return 0;
    }

    public static get screenResolutionX():number
    {
        // check
        return 0;
    }

    public static get screenDPI():number
    {
        return 320;
    }

    public static get screenColor():string
    {
        return 'color';
    }

    public static get playerType():string
    {
        return 'Desktop';
    }

    public static get pixelAspectRatio():number
    {
        // check
        return 320;
    }

    public static get os():string
    {
        return 'unknow';
    }

    public static get maxLevelIDC():string
    {
        return 'unknow';
    }

    public static get manufacturer():string
    {
        // check
        return 'unknow';
    }

    public static get localFileReadDisable():boolean
    {
        return true;
    }

    public static get languages():string[]
    {
        return null;
    }

    public static get language():string
    {
        return 'en';
    }

    public static get isEmbeddedInAcrobat():boolean
    {
        return false;
    }

    public static get isDebugger():boolean
    {
        return false;
    }

    public static get hasVideoEncoder():boolean
    {
        return false;
    }

    public static get hasTLS():boolean
    {
        return false;
    }

    public static get hasStreamingVideo():boolean
    {
        return true;
    }

    public static get hasStreamingAudio():boolean
    {
        // check
        return true;
    }

    public static get hasScreenPlayback():boolean
    {
        return false;
    }

    public static get hasScreenBroadcast():boolean
    {
        return false;
    }

    public static get hasPrinting():boolean
    {
        // check
        return true;
    }

    public static get hasMP3():boolean
    {
        // check
        return true;
    }

    public static get hasIME():boolean
    {
        return false;
    }

    public static get hasEmbeddedVideo():boolean
    {
        return false;
    }

    public static get hasAudioEncoder():boolean
    {
        // check
        return false;
    }

    public static get hasAudio():boolean
    {
        // check audio
        return true;
    }

    public static get hasAccessibility():boolean
    {
        return false;
    }

    public static  get cpuArchitecture():string
    {
        return 'ARM';
    }

    public static get avHardwareDisable():boolean
    {
        return false;
    }
}


class MobileData
{
    private static _dataLoaded:boolean;
    private static _applePhone:boolean;
    private static _appleIPod:boolean;
    private static _appleTablet:boolean;
    private static _appleDevice:boolean;
    private static _amazonPhone:boolean;
    private static _amazonTablet:boolean;
    private static _amazonDevice:boolean;
    private static _androidPhone:boolean;
    private static _androidTablet:boolean;
    private static _androidDevice:boolean;
    private static _windowsPhone:boolean;
    private static _windowsTablet:boolean;
    private static _windowsDevice:boolean;
    private static _blackberry:boolean;
    private static _blackberry10:boolean;
    private static _opera:boolean;
    private static _firefox:boolean;
    private static _chrome:boolean;
    private static _otherDevice:boolean;
    private static _seven_inch:boolean;
    private static _anyDevice:boolean;
    private static _phone:boolean;
    private static _tablet:boolean;    



    public static getMobileData():void
    {
        if(MobileData._dataLoaded)
        {
            return;
        }
        MobileData._dataLoaded = true;
        MobileData._applePhone = false;
        MobileData._appleIPod = false;
        MobileData._appleTablet = false;
        MobileData._appleDevice = false;
        MobileData._amazonPhone = false;
        MobileData._amazonTablet = false;
        MobileData._amazonDevice = false;
        MobileData._androidPhone = false;
        MobileData._androidTablet = false;
        MobileData._androidDevice = false;
        MobileData._windowsPhone = false;
        MobileData._windowsTablet = false;
        MobileData._windowsDevice = false;
        MobileData._blackberry = false;
        MobileData._blackberry10 = false;
        MobileData._opera = false;
        MobileData._firefox = false;
        MobileData._chrome = false;
        MobileData._otherDevice = false;
        MobileData._seven_inch = false;
        MobileData._anyDevice = false;
        MobileData._phone = false;
        MobileData._tablet = false;
        var apple_phone     = /iPhone/i,
        apple_ipod          = /iPod/i,
        apple_tablet        = /iPad/i,
        android_phone       = /(?=.*\bAndroid\b)(?=.*\bMobile\b)/i, // Match 'Android' AND 'Mobile'
        android_tablet      = /Android/i,
        amazon_phone        = /(?=.*\bAndroid\b)(?=.*\bSD4930UR\b)/i,
        amazon_tablet       = /(?=.*\bAndroid\b)(?=.*\b(?:KFOT|KFTT|KFJWI|KFJWA|KFSOWI|KFTHWI|KFTHWA|KFAPWI|KFAPWA|KFARWI|KFASWI|KFSAWI|KFSAWA)\b)/i,
        windows_phone       = /Windows Phone/i,
        windows_tablet      = /(?=.*\bWindows\b)(?=.*\bARM\b)/i, // Match 'Windows' AND 'ARM'
        other_blackberry    = /BlackBerry/i,
        other_blackberry_10 = /BB10/i,
        other_opera         = /Opera Mini/i,
        other_chrome        = /(CriOS|Chrome)(?=.*\bMobile\b)/i,
        other_firefox       = /(?=.*\bFirefox\b)(?=.*\bMobile\b)/i, // Match 'Firefox' AND 'Mobile'
        seven_inch = new RegExp(
            '(?:' +         // Non-capturing group

            'Nexus 7' +     // Nexus 7

            '|' +           // OR

            'BNTV250' +     // B&N Nook Tablet 7 inch

            '|' +           // OR

            'Kindle Fire' + // Kindle Fire

            '|' +           // OR

            'Silk' +        // Kindle Fire, Silk Accelerated

            '|' +           // OR

            'GT-P1000' +    // Galaxy Tab 7 inch

            ')',            // End non-capturing group

            'i');           // Case-insensitive matching

        var match = function(regex, userAgent) 
        {
            return regex.test(userAgent);
        };
        var IsMobileClass = function(userAgent) 
        {
            var ua = userAgent || navigator.userAgent;
            var tmp = ua.split('[FBAN');
            if (typeof tmp[1] !== 'undefined') 
            {
                ua = tmp[0];
            }
            tmp = ua.split('Twitter');
            if (typeof tmp[1] !== 'undefined') {
                ua = tmp[0];
            }
            MobileData._applePhone = match(apple_phone, ua);
            MobileData._appleIPod = match(apple_ipod, ua);
            MobileData._appleTablet = !match(apple_phone, ua) && match(apple_tablet, ua);
            MobileData._appleDevice = match(apple_phone, ua) || match(apple_ipod, ua) || match(apple_tablet, ua);
            MobileData._amazonPhone = match(amazon_phone, ua);
            MobileData._amazonTablet = !match(amazon_phone, ua) && match(amazon_tablet, ua);
            MobileData._amazonDevice = match(amazon_phone, ua) || match(amazon_tablet, ua);
            MobileData._androidPhone = match(amazon_phone, ua) || match(android_phone, ua);
            MobileData._androidTablet = !match(amazon_phone, ua) && !match(android_phone, ua) && (match(amazon_tablet, ua) || match(android_tablet, ua));
            MobileData._androidDevice = match(amazon_phone, ua) || match(amazon_tablet, ua) || match(android_phone, ua) || match(android_tablet, ua);
            MobileData._windowsPhone = match(windows_phone, ua);
            MobileData._windowsTablet = match(windows_tablet, ua);
            MobileData._windowsDevice = match(windows_phone, ua) || match(windows_tablet, ua);
            MobileData._blackberry = match(other_blackberry, ua);
            MobileData._blackberry10 = match(other_blackberry_10, ua);
            MobileData._opera = match(other_opera, ua);
            MobileData._firefox = match(other_firefox, ua);
            MobileData._chrome = match(other_chrome, ua);
            MobileData._otherDevice = match(other_blackberry, ua) || match(other_blackberry_10, ua) || match(other_opera, ua) || match(other_firefox, ua) || match(other_chrome, ua);
            MobileData._seven_inch = match(seven_inch, ua);
            MobileData._anyDevice = MobileData._appleDevice || MobileData._androidDevice || MobileData._windowsDevice || MobileData._otherDevice || MobileData._seven_inch;
            MobileData._phone = MobileData._applePhone || MobileData._androidPhone || MobileData._windowsPhone;
            MobileData._tablet = MobileData._appleTablet || MobileData._androidTablet || MobileData._windowsTablet;         
        };
        IsMobileClass(navigator.userAgent);
    }

    public static get tablet():boolean
    {
        MobileData.getMobileData();
        return MobileData._tablet;
    }

    public static get phone():boolean
    {
        MobileData.getMobileData();
        return MobileData._phone;
    }
}
