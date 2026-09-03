# homebridge-frigidaire
homebridge Platform plugin for Frigidaire connected appliances.  This is a platform plugin for Homebridge and will auto discover each of your AC appliances.

Note that right now only AC units are supported.

## Update 2023-06-26 (V3 API)
Code has been once again been updated to handle Frigidaire's new app, now on the V3 API. This new app was released in June 2023.

All that is needed to get started is a username, password, and a serial number. Ensure your devices show up in the new app before attempting to use this updated plugin.

## Example config.json:
	"platforms": [
		{
			"platform": "Frigidaire",
			"applianceSerial": "94126327",
			"username": "joe@gmail.com",
			"password": "Password1"
    }		
	]
## New feature: refresh token caching
There is a new optional feature available in the backend <i>frigidaire</i> module that caches the refresh token, resulting in a slightly faster startup. It also helps reduce network traffic (by an albeit tiny amount).

To enable this option, add `"cacheRefreshToken": true` to the config.json, ie
```
{
	"platform": "Frigidaire",
	"applianceSerial": "94126327",
	"username": "joe@gmail.com",
	"password": "Password1",
	"cacheRefreshToken": true
}
```
The <b>homebridge config directory</b> will be used as the cache path, so ensure it is writable by the process that's running homebridge.

## How to install

 ```sudo npm install -g homebridge-frigidaire```

## Debug
If you're having problems, please enable debug and paste all output to the ticket.  To enable debug, run homebridge with the ```DEBUG``` set.
```export DEBUG=frigidaire:*; homebridge```
