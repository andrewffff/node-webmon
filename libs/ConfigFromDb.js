
var http = require('http'),
	https = require('https'),
	url = require('url');

// given a database row from the config table, do some basic checking and
// return a stream config structure, or raise an exception
exports.configFromDb = function(row) {
	var streamConfig = {
		src_id: row.id,
		protocol: row.protocol,
		name: '[' + row.id + '] ' + row.address,
		normal_wait_secs: row.normal_wait_secs,
		error_wait_secs: row.error_wait_secs !== null ? row.error_wait_secs : row.normal_wait_secs
	};

	switch(row.protocol) {
		case "web":
			// parse url, augment with unparsed URL and reference to http or https module
			streamConfig.httpOptions = url.parse(row.address)

			switch(streamConfig.httpOptions.protocol) {
				case 'http:':
					streamConfig.httpImpl = http;
					break;
				case 'https:':
					streamConfig.httpImpl = https;
					break;
				default:
					throw "Not a valid HTTP or HTTPS url: " + row.address;
			}

			streamConfig.httpOptions.headers = { 'Connection': 'keep-alive' };

			break;

		case "raw":
			var splitAddress = row.address.split(':');
			if(splitAddress.length == 2) {
				var port = parseInt(splitAddress[1], 10);
				if(port && splitAddress[1] === ''+port && port < 65536) {
					streamConfig.netOptions = { host: splitAddress[0], port: port };
				}
			}

			if(!streamConfig.netOptions)
				throw "Not a valid hostname:port address: " + row.address;

			streamConfig.timeout = null;

			break;

		case "socket.io":
			// broadly check that we have a http/https url to pass to socket.io
			switch(url.parse(row.address).protocol) {
				case "http:":
				case "https:":
					break;
				default:
					throw "Not a valid HTTP or HTTPS socket.io url: " + row.address;
			}

			streamConfig.ioAddress = row.address;
			streamConfig.ioOptions = {
				'reconnection delay': 1000 * row.normal_wait_secs,
				'max reconnection attempts': 2,
				'force new connection': true
			};

			break;

		default:
			throw "Not a recognised protocol: " + row.protocol;
			break;
	}

	return streamConfig;
}


