
var assert = require('assert'),
	http = require('http'),
	https = require('https');


var configFromDb = require('../libs/ConfigFromDb.js').configFromDb;


function shouldRaiseError(errorSubstring, configRow) {
	var err = null;
	try {
		configFromDb(configRow);
	} catch(e) {
		err = e.toString();
	}

	assert.notStrictEqual(err, null);
	assert(err.indexOf(errorSubstring) >= 0);
}


shouldRaiseError("Not a valid HTTP or HTTPS url", {
	id: 123,
	protocol: 'web',
	normal_wait_secs: 30,
	error_wait_secs: null,
	address: 'ftp://example.com/'
});


shouldRaiseError("Not a valid HTTP or HTTPS url", {
	id: 123,
	protocol: 'web',
	normal_wait_secs: 30,
	error_wait_secs: null,
	address: 'example.com/'
});


shouldRaiseError("Not a valid hostname:port address", {
	id: 123,
	protocol: 'raw',
	normal_wait_secs: 30,
	error_wait_secs: null,
	address: 'ftp://example.com/'
});


shouldRaiseError("Not a valid HTTP or HTTPS socket.io url", {
	id: 123,
	protocol: 'socket.io',
	normal_wait_secs: 30,
	error_wait_secs: null,
	address: 'ftp://example.com/'
});


shouldRaiseError("Not a recognised protocol", {
	id: 123,
	protocol: 'blahblah',
	normal_wait_secs: 30,
	error_wait_secs: null,
	address: 'ftp://example.com/'
});


shouldRaiseError("Not a recognised protocol", {
	id: 123,
	protocol: 'https',     // NOPE! should be web
	normal_wait_secs: 30,
	error_wait_secs: null,
	address: 'https://example.com/'
});


assert.deepEqual(
configFromDb({
	id: 123,
	protocol: 'web',
	normal_wait_secs: 650,
	error_wait_secs: null,
	address: 'http://example.com/'
}),
{ src_id: 123,
  protocol: 'web',
  name: '[123] http://example.com/',
  normal_wait_secs: 650,
  error_wait_secs: 650,
  httpOptions: 
   { protocol: 'http:',
     slashes: true,
     host: 'example.com',
     hostname: 'example.com',
     href: 'http://example.com/',
     pathname: '/',
     path: '/',
     headers: { Connection: 'keep-alive' } },
  httpImpl: http
});


assert.deepEqual(
configFromDb({
	id: 123,
	protocol: 'web',
	normal_wait_secs: 650,
	error_wait_secs: 222,
	address: 'https://example.com/'
}),
{ src_id: 123,
  protocol: 'web',
  name: '[123] https://example.com/',
  normal_wait_secs: 650,
  error_wait_secs: 222,
  httpOptions: 
   { protocol: 'https:',
     slashes: true,
     host: 'example.com',
     hostname: 'example.com',
     href: 'https://example.com/',
     pathname: '/',
     path: '/',
     headers: { Connection: 'keep-alive' } },
  httpImpl: https
});



assert.deepEqual(configFromDb({
	id: 123,
	protocol: 'raw',
	normal_wait_secs: 11,
	error_wait_secs: 60,
	address: 'example.com:8000'
}),
{ src_id: 123,
  protocol: 'raw',
  name: '[123] example.com:8000',
  normal_wait_secs: 11,
  error_wait_secs: 60,
  netOptions: { host: 'example.com', port: 8000 },
  timeout: null }
);



assert.deepEqual(configFromDb({
	id: 123,
	protocol: 'socket.io',
	normal_wait_secs: 30,
	error_wait_secs: null,
	address: 'http://example.com/socket.io/'
}),
{ src_id: 123,
  protocol: 'socket.io',
  name: '[123] http://example.com/socket.io/',
  normal_wait_secs: 30,
  error_wait_secs: 30,
  ioAddress: 'http://example.com/socket.io/',
  ioOptions: 
   { 'reconnection delay': 30000,
     'max reconnection attempts': 2,
     'force new connection': true } }
);



