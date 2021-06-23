# homebridge-frigidaire
homebridge Platform plugin for Frigidaire connected appliances.  This is a platform plugin for Homebridge and will auto discover each of your AC appliances.

Note that right now only AC units are supported.

## Update 6-22-2021
Code has been updated to handle Frigidaire's new app, which uses a new backend API.

## Example config.json:
### Minimum / Auto Discovery
	"platforms": [
		{
			"platform": "Frigidaire",
			"username": "joe@gmail.com",
			"password": "Password1",
		}
	]

### Optional
	"platforms": [
		{
			"platform": "Frigidaire",
			"username": "joe@gmail.com",
			"password": "Password1",
			"applianceSerial": "94126327",
			"deviceId": "O2-w1yjkjewjQt2J_AjaAaeSZZlmTQ501ahP" 
		}
	]

* ```applianceSerial``` - Serial number of the device.  Will ignore all other devices on your account
* ```deviceId``` - Manually set the DeviceId. Can be anything you want. Otherwise is randomly generated every time homebridge is started


## How to install

 ```sudo npm install -g homebridge-frigidaire```

## Debug
If you're having problems, please enable debug and paste all output to the ticket.  To enable debug, run homebridge with the ```DEBUG``` set.
```export DEBUG=frigidaire:*; homebridge```
