# homebridge-frigidaire
homebridge Platform plugin for Frigidaire connected appliances.  This is a platform plugin for Homebridge and will auto discover each of your AC appliances.

Note that right now only AC units are supported.


## Example config.json:
	"platforms": [
		{
			"platform": "Frigidaire",
			"name": "Frigidaire AC Units",
			"username": "joe@gmail.com",
			"password": "Password1"
    }		
	]

## How to install

 ```sudo npm install -g homebridge-frigidaire```
