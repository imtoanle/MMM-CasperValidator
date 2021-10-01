# MMM-CasperValidator

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

Todo: Insert description here!

## Using the module

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        {
			module: "MMM-CasperValidator",
			header: "Casper Validator",
			position: "top_right",
			config: {
				api_url: 'http://10.0.100.124:9090',
				prometheus_job: 'casper',
				updateInterval: 60000,
				retryDelay: 5000
			}
		},
    ]
}
```

## Configuration options

| Option           | Description
|----------------- |-----------
| `option1`        | *Required* DESCRIPTION HERE
| `option2`        | *Optional* DESCRIPTION HERE TOO <br><br>**Type:** `int`(milliseconds) <br>Default 60000 milliseconds (1 minute)
