define(["require", "exports", "flash/system/TouchscreenType"], function (require, exports, TouchscreenType_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Capabilities {
        static hasMultiChannelAudio(type) {
            return true;
        }
        static get isMobileDevice() {
            if (MobileData.tablet && MobileData.phone) {
                return true;
            }
            return false;
        }
        static get isWebGLSupported() {
            var contextOptions = { stencil: true, failIfMajorPerformanceCaveat: true };
            try {
                if (!window['WebGLRenderingContext']) {
                    return false;
                }
                var canvas = document.createElement('canvas');
                var gl = canvas.getContext('webgl', contextOptions) || canvas.getContext('experimental-webgl', contextOptions);
                if (gl instanceof WebGLRenderingContext) {
                    var success = !!(gl && gl.getContextAttributes().stencil);
                    if (gl) {
                        var loseContext = gl.getExtension('WEBGL_lose_context');
                        if (loseContext) {
                            loseContext.loseContext();
                        }
                    }
                    gl = null;
                    return success;
                }
            }
            catch (e) {
                return false;
            }
            return true;
        }
        static get version() {
            return "1.0.0";
        }
        static get touchscreenType() {
            return TouchscreenType_1.TouchscreenType.NOT_ACQUIRED;
        }
        static get supports64BitProcesses() {
            return true;
        }
        static get supports32BitProcesses() {
            return true;
        }
        static get serverString() {
            return 'color';
        }
        static get screenResolutionY() {
            // check
            return 0;
        }
        static get screenResolutionX() {
            // check
            return 0;
        }
        static get screenDPI() {
            return 320;
        }
        static get screenColor() {
            return 'color';
        }
        static get playerType() {
            return 'Desktop';
        }
        static get pixelAspectRatio() {
            // check
            return 320;
        }
        static get os() {
            return 'unknow';
        }
        static get maxLevelIDC() {
            return 'unknow';
        }
        static get manufacturer() {
            // check
            return 'unknow';
        }
        static get localFileReadDisable() {
            return true;
        }
        static get languages() {
            return null;
        }
        static get language() {
            return 'en';
        }
        static get isEmbeddedInAcrobat() {
            return false;
        }
        static get isDebugger() {
            return false;
        }
        static get hasVideoEncoder() {
            return false;
        }
        static get hasTLS() {
            return false;
        }
        static get hasStreamingVideo() {
            return true;
        }
        static get hasStreamingAudio() {
            // check
            return true;
        }
        static get hasScreenPlayback() {
            return false;
        }
        static get hasScreenBroadcast() {
            return false;
        }
        static get hasPrinting() {
            // check
            return true;
        }
        static get hasMP3() {
            // check
            return true;
        }
        static get hasIME() {
            return false;
        }
        static get hasEmbeddedVideo() {
            return false;
        }
        static get hasAudioEncoder() {
            // check
            return false;
        }
        static get hasAudio() {
            // check audio
            return true;
        }
        static get hasAccessibility() {
            return false;
        }
        static get cpuArchitecture() {
            return 'ARM';
        }
        static get avHardwareDisable() {
            return false;
        }
    }
    exports.Capabilities = Capabilities;
    class MobileData {
        static getMobileData() {
            if (MobileData._dataLoaded) {
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
            var apple_phone = /iPhone/i, apple_ipod = /iPod/i, apple_tablet = /iPad/i, android_phone = /(?=.*\bAndroid\b)(?=.*\bMobile\b)/i, // Match 'Android' AND 'Mobile'
            android_tablet = /Android/i, amazon_phone = /(?=.*\bAndroid\b)(?=.*\bSD4930UR\b)/i, amazon_tablet = /(?=.*\bAndroid\b)(?=.*\b(?:KFOT|KFTT|KFJWI|KFJWA|KFSOWI|KFTHWI|KFTHWA|KFAPWI|KFAPWA|KFARWI|KFASWI|KFSAWI|KFSAWA)\b)/i, windows_phone = /Windows Phone/i, windows_tablet = /(?=.*\bWindows\b)(?=.*\bARM\b)/i, // Match 'Windows' AND 'ARM'
            other_blackberry = /BlackBerry/i, other_blackberry_10 = /BB10/i, other_opera = /Opera Mini/i, other_chrome = /(CriOS|Chrome)(?=.*\bMobile\b)/i, other_firefox = /(?=.*\bFirefox\b)(?=.*\bMobile\b)/i, // Match 'Firefox' AND 'Mobile'
            seven_inch = new RegExp('(?:' + // Non-capturing group
                'Nexus 7' + // Nexus 7
                '|' + // OR
                'BNTV250' + // B&N Nook Tablet 7 inch
                '|' + // OR
                'Kindle Fire' + // Kindle Fire
                '|' + // OR
                'Silk' + // Kindle Fire, Silk Accelerated
                '|' + // OR
                'GT-P1000' + // Galaxy Tab 7 inch
                ')', // End non-capturing group
            'i'); // Case-insensitive matching
            var match = function (regex, userAgent) {
                return regex.test(userAgent);
            };
            var IsMobileClass = function (userAgent) {
                var ua = userAgent || navigator.userAgent;
                var tmp = ua.split('[FBAN');
                if (typeof tmp[1] !== 'undefined') {
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
        static get tablet() {
            MobileData.getMobileData();
            return MobileData._tablet;
        }
        static get phone() {
            MobileData.getMobileData();
            return MobileData._phone;
        }
    }
});
//# sourceMappingURL=Capabilities.js.map