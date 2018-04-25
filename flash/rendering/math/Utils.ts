


export class Utils
{
    
    
    public static numberIsInteger(value)
    {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
    };
}