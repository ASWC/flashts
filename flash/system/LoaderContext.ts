import { BaseObject } from "flash/rendering/core/BaseObject";
import { ApplicationDomain } from "flash/system/ApplicationDomain";
import { SecurityDomain } from "flash/system/SecurityDomain";

export class LoaderContext extends BaseObject
{
    protected _checkPolicyFile:boolean;
    protected _applicationDomain:ApplicationDomain;
    protected _securityDomain:SecurityDomain;

    constructor(checkPolicyFile:boolean = false, applicationDomain:ApplicationDomain = null, securityDomain:SecurityDomain = null)
    {
        super();
    }
}