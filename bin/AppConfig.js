
require.config({
    urlArgs: "bust=" + (new Date()).getTime()
});

define(['Test'], onAppLoded);

function onAppLoded(main)
{	
	var AppMain = main.Test;
	var test = new AppMain();
	/*var initializer = window['CanvasInitializer'];
	var AppMain = main.ProjectTestConstructor;
	if(initializer !== undefined)
	{
		initializer.addCanvas("StageCanvas", AppMain);
	}
	else
	{
		var appMain = new AppMain();
	}*/
	test.start();

	//console.log(AppMain)
}
