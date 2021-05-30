# homebridge-frigidaire
homebridge Platform plugin for Frigidaire connected appliances.  This is a platform plugin for Homebridge and will auto discover each of your AC appliances.

Note that right now only AC units are supported.

Device ID can be anything, just change some letters/numbers in it to make it uniquely yours.

## Example config.json:
	"platforms": [
		{
			"platform": "Frigidaire",
			"applianceSerial": "94126327",
			"username": "joe@gmail.com",
			"password": "Password1",
			"deviceId": "O2-w1yjkjewjQt2J_AjaAaeSZZlmTQ501ahP" 
    }		
	]

## How to install

 ```sudo npm install -g homebridge-frigidaire```

## Debug
If you're having problems, please enable debug and paste all output to the ticket.  To enable debug, run homebridge with the ```DEBUG``` set.
```export DEBUG=homebridge-frigidaire,frigidaire; homebridge```
