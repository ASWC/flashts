define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ValidateContext {
        static ValidateContext(gl) {
            const attributes = gl.getContextAttributes();
            // this is going to be fairly simple for now.. but at least we have room to grow!
            if (!attributes.stencil) {
                /* eslint-disable no-console */
                console.warn('Provided WebGL context does not have a stencil buffer, masks may not render correctly');
                /* eslint-enable no-console */
            }
        }
    }
    exports.ValidateContext = ValidateContext;
});
//# sourceMappingURL=ValidateContext.js.map