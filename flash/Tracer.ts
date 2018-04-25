


export class Tracer
{
	public static WATCHER:Watcher;
	public static DUMP:string[] = [];

	public static revealMethods(value:Object):void
	{
		try
		{
			if(!value)
			{
				var result:string = "reveal methods: null";
			}
			else
			{
				var result:string = "reveal methods: ";
			}
			for(var key in value)
			{
				var instanceItem:any = value[key];
				if(instanceItem instanceof Function)
				{
					result += 'method: ' + key + ' : ' + value[key] + "\n";
					
				}       	
			}
			if(Tracer.WATCHER)
			{
				Tracer.WATCHER.watch(result);
			}
			Tracer.DUMP.push(result);
			console.log(result);
		}
		catch(e)
		{

		}		
	}

	public static reveal(value:Object):void
	{
		if(!value)
		{
			var result:string = "reveal: null";
			console.log(result);
			return;
		}
		if(value === undefined)
		{
			var result:string = "reveal: undefined";
			console.log(result);
			return;
		}
		var result:string = "reveal: ";			
		for(var key in value)
		{
			//console.log(key)
			var instanceItem:any = Tracer.getValue(key, value);
			if(instanceItem)
			{
				if(instanceItem instanceof Function)
				{
					result += 'method: ' + key + "\n";				
				}
				else
				{
					try
					{
						result += key + ' : ' + instanceItem + "\n";
					}
					catch(e)
					{

					}
														
				} 
			}	
		}
		if(Tracer.WATCHER)
		{
			Tracer.WATCHER.watch(result);
		}
		Tracer.DUMP.push(result);
		console.log(result);				
	}

	private static getValue(key:string, value:any):any
	{
		var valueResult:any = null;
		try
		{
			valueResult = value[key];
		}
		catch(e)
		{

		}
		return valueResult;
	}

	public static show(value:any):void
	{
		try
		{
			if(!value)
			{
				var result:string = "show: null";
			}
			else
			{
				var result:string = "show: " + value.toString();
			}		
			if(Tracer.WATCHER)
			{
				Tracer.WATCHER.watch(result);
			}
			Tracer.DUMP.push(result);
			console.log(result);
		}
		catch(e)
		{

		}		
	}

	public static clear():void
	{
		Tracer.DUMP = [];
	}

}

class Watcher
{
	public watch(value:string):void
	{

	}
}
