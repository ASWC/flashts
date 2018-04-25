


export class GLAttributeData
{
    public type:string;
    public size:number;
    public location:number;
    public pointer:Function;

    constructor(type:string, size:number, location:number, pointer:Function)
    {
        this.size = size;
        this.type = type;
        this.location = location;
        this.pointer = pointer;
    }
}