
var Buffer = require('buffer').Buffer,
	Iconv = require('iconv').Iconv;

/**
 * Turns the raw bytes from a good (2xx status, and headers received) HTTP
 * response into a string, after checking for certain errors. If Content-Type
 * indicates a particular character encoding, we honor it, otherwise we
 * assume the content is encoded in UTF-8.
 *
 * From your HTTP response: pass in the numeric response code, an object containing
 * the received headers (with keys lowercased), and an array of Buffer objects
 * containing the received data.
 *
 * In terms of the example at http://nodejs.org/api/http.html#http_http_request_options_callback
 * this is res.statusCode, res.headers, and an array of all the buffers emitted with
 * the "data" events. (You must _not_ call res.setEncoding!) 
 * 
 * This function will return the response body as a string, if the body seems correct
 * given the received headers. If not an exception will be raised.
 *
 * Errors currently checked for:
 *
 *  - Non 2xx status code.
 *
 *  - Status code or headers not received.
 *
 *  - The headers contain Content-Length, and we have received more or
 *    less bytes than we should have.
 *
 *  - The headers indicate a character encoding which we do not understand.
 *
 *  - The body content is not well-formed according to the appropriate
 *    character encoding.
 *
 */
exports.checkAndDecode = function(resp_code, resp_headers, resp_content) {
	// check response code and header
	if(!resp_code || !resp_headers) {
		throw new Error("No headers received in response to HTTP request");
	}

	if(resp_code < 200 || resp_code >= 300) {
		throw new Error("Received non-2xx HTTP response: " + resp_code);
	}

	// grab encoding from the content-type header. default to utf-8
	var encoding = 'utf-8';
	if(resp_headers.hasOwnProperty('content-type')) {
		var ct = resp_headers['content-type'];
		var startIdx = ct.lastIndexOf('charset=');

		if(startIdx >= 0) {
			startIdx += 8;
			var endIdx = ct.indexOf(';', startIdx);
			encoding = ct.substring(startIdx, endIdx >= 0 ? endIdx : undefined).trim();
		}
	}

	// combine buffers, and complain if we have contradictory content-length information
	resp_content = Buffer.concat(resp_content);
	if(resp_headers && resp_headers.hasOwnProperty('content-length')) {
		if(resp_content.length !== +resp_headers['content-length']) {
			throw new Error("content-length header does not match content received");
		}
	}

	// convert buffer to utf-8. if it is already ostensibly utf-8, this will validate it
	try {
		var codec = new Iconv(encoding, 'utf-8');
		return codec.convert(resp_content).toString();
	} catch(e) {
		throw new Error("Character encoding error in received content: " + e.toString());
	}
}


