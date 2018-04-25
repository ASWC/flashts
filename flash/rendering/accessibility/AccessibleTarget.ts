

export class AccessibleTarget
{
    /**
         *  Flag for if the object is accessible. If true AccessibilityManager will overlay a
         *   shadow div with attributes set
         *
         * @member {boolean}
         */
    public static accessible:boolean = false;
    /**
         * Sets the title attribute of the shadow div
         * If accessibleTitle AND accessibleHint has not been this will default to 'displayObject [tabIndex]'
         *
         * @member {string}
         */
    public static accessibleTitle:string = null;

    /**
         * Sets the aria-label attribute of the shadow div
         *
         * @member {string}
         */
    public static accessibleHint:string = null;

    /**
         * @todo Needs docs.
         */
        public static tabIndex:number = 0

    /**
         * @todo Needs docs.
         */
        public static     _accessibleActive:boolean = false
    
        /**
         * @todo Needs docs.
         */
        public static     _accessibleDiv:boolean = false
  
}