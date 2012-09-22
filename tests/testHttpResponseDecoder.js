
var assert = require('assert'),
	Buffer = require('buffer').Buffer;


var checkAndDecode = require('../libs/HttpResponseDecoder.js').checkAndDecode;

function mustThrow(a,b,c) {
	assert.throws(function(){
		checkAndDecode(a,b,c);
	});
}

function mustNotThrow(a,b,c) {
	assert.doesNotThrow(function(){
		checkAndDecode(a,b,c);
	});
}


// Some sample encodings. Steal some Japanese text from node-iconv's test.
// Note the source file itself is UTF-8! Our UTF-7 example is longer than
// necessary (the ASCII version would read fine as UTF-7) but still valid
var HELLO_STRING = "Hello";
var HELLO_ASCII = new Buffer([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
var HELLO_EBCDIC = new Buffer([0xC8, 0x85, 0x93, 0x93, 0x96]);
var HELLO_UTF_7 = new Buffer("+AEgAZQBsAGwAbw-");

var ICONVEXAMPLE_ISO_2022_JP = new Buffer([0x1b, 0x24, 0x40, 0x24, 0x2c]);
var ICONVEXAMPLE_UTF_8 = new Buffer('が');

var CREPE_UTF_8   = new Buffer([0x63, 0x72, 0xC3, 0xAA, 0x70, 0x65]);
var INVALID_UTF_8 = new Buffer([0x63, 0x72, 0xC3,       0x70, 0x65]); // missing second byte in two-byte code
assert.equal(CREPE_UTF_8.toString(), 'crêpe');

var CREPE_UTF_8_SPLIT  = [
	new Buffer([]),
	new Buffer([0x63, 0x72, 0xC3, 0xAA]),
	new Buffer([                        0x70]),
	new Buffer([]),
	new Buffer([                              0x65])
	];

var INVALID_UTF_8_SPLIT  = [
	new Buffer([]),
	new Buffer([0x63, 0x72, 0xC3      ]),
	new Buffer([                        0x70]),
	new Buffer([                              0x65])
	];



// Need a 2xx code, headers, and an array of buffers
mustNotThrow(200, { 'content-type': 'text/plain' }, [new Buffer("hello world")]);

mustThrow(302, { 'content-type': 'text/plain' }, [new Buffer("hello world")]);
mustThrow(null, { 'content-type': 'text/plain' }, [new Buffer("hello world")]);
mustThrow(200, null, [new Buffer("hello world")]);
mustThrow(302, { 'content-type': 'text/plain' }, null);


// XXX - We choke on a null header block, but allow zero headers in an object. Correct?
mustNotThrow(200, {}, [new Buffer("hello world")]);
mustThrow(200, null, [new Buffer("hello world")]);


// Test basic decoding. Note "Hello" is ASCII is the same in UTF-7 and UTF-8! There
// is also a more complicated UTF-7 encoding which doesn't equal "Hello" in anything else
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-7' }, [HELLO_UTF_7]));
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-7' }, [HELLO_ASCII]));
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-8' }, [HELLO_ASCII]));
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=ascii' }, [HELLO_ASCII]));

assert.notEqual(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=ascii' }, [HELLO_UTF_7]));


// Make sure the charset can be anywhere
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain;          charset=utf-7' }, [HELLO_UTF_7]));
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; foo=bar; charset=utf-7' }, [HELLO_UTF_7]));
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-7; foo=bar' }, [HELLO_UTF_7]));
assert.equal(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-7         ' }, [HELLO_UTF_7]));
assert.notEqual(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain;          charset=utf-8' }, [HELLO_UTF_7]));
assert.notEqual(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; foo=bar; charset=utf-8' }, [HELLO_UTF_7]));
assert.notEqual(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-8; foo=bar' }, [HELLO_UTF_7]));
assert.notEqual(HELLO_STRING, checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-8         ' }, [HELLO_UTF_7]));


// utf-9 does not exist so we should not accept it
mustNotThrow(200, { 'content-type': 'text/plain; charset=utf-8' }, [HELLO_ASCII]);
mustThrow   (200, { 'content-type': 'text/plain; charset=utf-9' }, [HELLO_ASCII]);


// ISO-2022-JP. No character encoding implies UTF-8. Interpreting utf-8 as ISO-8859-1 should yield incorrectness
assert.equal(
	checkAndDecode(200, { 'content-type': 'text/plain; charset=utf-8' }, [ICONVEXAMPLE_UTF_8]),
	checkAndDecode(200, { 'content-type': 'text/plain; charset=iso-2022-jp' }, [ICONVEXAMPLE_ISO_2022_JP]));

assert.equal(
	checkAndDecode(200, { 'content-type': 'text/plain' }, [ICONVEXAMPLE_UTF_8]),
	checkAndDecode(200, { 'content-type': 'text/plain; charset=iso-2022-jp' }, [ICONVEXAMPLE_ISO_2022_JP]));

assert.notEqual(
	checkAndDecode(200, { 'content-type': 'text/plain; charset=iso-8859-1' }, [ICONVEXAMPLE_UTF_8]),
	checkAndDecode(200, { 'content-type': 'text/plain; charset=iso-2022-jp' }, [ICONVEXAMPLE_ISO_2022_JP]));


// the same content received all at once, versus in several little blocks
assert.equal(
	checkAndDecode(200, {}, [CREPE_UTF_8]),
	checkAndDecode(200, {}, CREPE_UTF_8_SPLIT));


// invalid utf-8
mustNotThrow(200, { 'content-type': 'text/html; charset=utf-8' }, [CREPE_UTF_8]);
mustThrow(200, { 'content-type': 'text/html; charset=utf-8' }, [INVALID_UTF_8]);

mustNotThrow(200, { 'content-type': 'text/html; charset=utf-8' }, CREPE_UTF_8_SPLIT);
mustThrow(200, { 'content-type': 'text/html; charset=utf-8' }, INVALID_UTF_8_SPLIT);


// make sure content-length header is respected. crêpe (accent over middle character)
// is 5 characters which are encoded as 6 bytes in utf-8. content-length can be a number
// or string
mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': '5' }, [CREPE_UTF_8]);
mustNotThrow(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': '6' }, [CREPE_UTF_8]);
mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': '7' }, [CREPE_UTF_8]);

mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': 5   }, [CREPE_UTF_8]);
mustNotThrow(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': 6   }, [CREPE_UTF_8]);
mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': 7   }, [CREPE_UTF_8]);

mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': '5' }, CREPE_UTF_8_SPLIT);
mustNotThrow(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': '6' }, CREPE_UTF_8_SPLIT);
mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': '7' }, CREPE_UTF_8_SPLIT);

mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': 5   }, CREPE_UTF_8_SPLIT);
mustNotThrow(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': 6   }, CREPE_UTF_8_SPLIT);
mustThrow   (200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': 7   }, CREPE_UTF_8_SPLIT);

