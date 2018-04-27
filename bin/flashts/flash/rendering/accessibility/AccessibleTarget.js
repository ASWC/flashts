define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class AccessibleTarget {
    }
    /**
         *  Flag for if the object is accessible. If true AccessibilityManager will overlay a
         *   shadow div with attributes set
         *
         * @member {boolean}
         */
    AccessibleTarget.accessible = false;
    /**
         * Sets the title attribute of the shadow div
         * If accessibleTitle AND accessibleHint has not been this will default to 'displayObject [tabIndex]'
         *
         * @member {string}
         */
    AccessibleTarget.accessibleTitle = null;
    /**
         * Sets the aria-label attribute of the shadow div
         *
         * @member {string}
         */
    AccessibleTarget.accessibleHint = null;
    /**
         * @todo Needs docs.
         */
    AccessibleTarget.tabIndex = 0;
    /**
         * @todo Needs docs.
         */
    AccessibleTarget._accessibleActive = false;
    /**
     * @todo Needs docs.
     */
    AccessibleTarget._accessibleDiv = false;
    exports.AccessibleTarget = AccessibleTarget;
});
