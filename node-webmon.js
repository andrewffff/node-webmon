#!/usr/bin/env node

var net = require('net'),
	fs = require('fs');

var pg = require('pg'),
	carrier = require('carrier'),
	commander = require('commander'),
	ioclient = require('socket.io-client');

var HttpResponseDecoder = require('./libs/HttpResponseDecoder'),
	configFromDb = require('./libs/ConfigFromDb').configFromDb;



//
// Stuff to log content and errors into the database
//

function DbWriter(db,errorLogObject,successLogObject) {
	this.db = db;
	this.errorLogObject = errorLogObject;
	this.successLogObject = successLogObject;
}

DbWriter.prototype.logHttp = function(data) {
	// convert resp_headers from a key-value object back to a string
	var headers = "";
	Object.getOwnPropertyNames(data.resp_headers).forEach(function(k) {
		headers += k + ": " + data.resp_headers[k] + "\r\n";
	});

	this.db.query({
		name: 'loghttp',
		text: "INSERT INTO log_http(src_id," +
	        "ts_request_made, ts_headers_start, ts_content_start, ts_content_end," +
			"resp_code, resp_headers, resp_content) " +
			"VALUES ($1," +
			"to_timestamp( $2 /1000.0), to_timestamp( $3 / 1000.0), to_timestamp( $4 /1000.0), to_timestamp( $5 / 1000.0), " +
			"$6, $7, $8)",
		values: [
			data.src_id,
			data.ts_request_made, data.ts_headers_start, data.ts_content_start, data.ts_content_end,
			data.resp_code, headers, data.resp_content]
	});

	if(this.successLogObject) this.successLogObject.log(data);
}


DbWriter.prototype.logStream = function(data) {
	this.db.query({
		name: 'logstream',
		text: "INSERT INTO log_stream(src_id,ts_connection,ts_received,line_received) " +
			"VALUES ($1, to_timestamp($2 / 1000.0), to_timestamp( $3 /1000.0), $4)",
		values: [data.src_id, data.ts_connection, data.ts_received, data.line_received]
	});

	if(this.successLogObject) this.successLogObject.log(data);
}


DbWriter.prototype.logError = function(data) {
	this.db.query({
		name: 'logerror',
		text: "INSERT INTO log_error(src_id,ts,error) " +
			"VALUES ($1, to_timestamp($2 /1000.0), $3)",
		values: [data.src_id, data.ts, data.error.toString()]
	});

	if(this.errorLogObject) this.errorLogObject.log(data);
}



//
// the actual program
//
function run(pgClient) {
	//debug//var writer = new DbWriter(pgClient, console, console);
	var writer = new DbWriter(pgClient, console);
	
	function doWeb(streamConfig) {
		// accumulate stuff to log
		var receivedData = { 
			src_id: streamConfig.src_id,
	
			ts_request_made: null,
			ts_headers_start: null,
			ts_content_start: null,
			ts_content_end: null,
	
			resp_code: null,
			resp_headers: null,
			resp_content: []
		};
	
		// request object
		var req = streamConfig.httpImpl.request(streamConfig.httpOptions);
	
		// make sure we don't act more than once as the result of errors
		var haveFinished = false;
		function finish(err) {
			if(!haveFinished) {
				haveFinished = true;
	
				if(err) {
					req.abort();
					writer.logError({
						src_id: receivedData.src_id,
						ts: Date.now(),
						error: err
					});
				} else {
					writer.logHttp(receivedData);
				}
	
				setTimeout(function() { doWeb(streamConfig); }, 1000*streamConfig.normal_wait_secs);
			}
		}
	
		req.on('response', function(res) {
			receivedData.resp_code = res.statusCode;
			receivedData.resp_headers = res.headers;
	
			res.on('data', function(chunk) {
				if(!receivedData.ts_content_start)
					receivedData.ts_content_start = Date.now();
				receivedData.resp_content.push(chunk);
			});
	
			res.on('end', function() {
				receivedData.ts_content_end = Date.now();
	
				try {
					// check and convert from raw bytes to a string
					receivedData.resp_content = HttpResponseDecoder.checkAndDecode(
						receivedData.resp_code, receivedData.resp_headers, receivedData.resp_content);
					finish();
				} catch(err) {
					finish(err);
				}
			});
		});
	
		req.once('socket', function() {
			// HTTP request should have just been sent
			receivedData.ts_request_made = Date.now();
	
			// next byte received = start of the server's HTTP response
			req.socket.once('data', function() {
				receivedData.ts_headers_start = Date.now();
			});
		});
	
		req.on('error', finish); // finish will be called with error object
	
		req.end();
	}
	
	
	function doRawStream(streamConfig) {
		var socket = net.connect(streamConfig.netOptions);
		var connectedAt = null;
					
		socket.on('connect', function() {
			connectedAt = Date.now();
		});
	
		socket.setTimeout(+streamConfig.timeout, function() {
			//console.log(streamConfig.name, ' closing due to timeout');
			socket.close();
		});
	
		carrier.carry(socket, function(line) {
			var d = Date.now();
	
			writer.logStream({
				src_id: streamConfig.src_id,
				ts_connection: connectedAt,
				ts_received: d,
				line_received: line
			});
		});
	
		socket.on('end', function(hadError) {
			var errText = streamConfig.name + ' socket closed ' +
				(hadError ? '(due to underlying error)' : '(healthily)') +
				', reconnecting in ' + streamConfig.reconnect_secs + 's';
	
			writer.logError({
				src_id: streamConfig.src_id,
				ts: Date.now(),
				error: errText
			});
	
			setTimeout(function() { doRawStream(streamConfig); }, streamConfig.reconnect_secs*1000);
		});
	}
	
	
	function doIoStream(streamConfig) {
		var conn = ioclient.connect(streamConfig.ioAddress, streamConfig.ioOptions);
		var connectedAt = null;
	
		// we regard disconnection as an "error" for logging purposes, and a reconnect
		// to be a "new connection". we use the "normal wait" time for the reconnection
		// attempts that socket.io itself performs. when socket.io gives up after a few
		// attempts, we use the "error wait" time before forcing a retry
	
		function handleError(note,needsReconnect) {
			writer.logError({
				src_id: streamConfig.src_id,
				ts: Date.now(),
				error: note
			});
	
			if(needsReconnect) {
				setTimeout(function() { doIoStream(streamConfig); }, 1000*streamConfig.error_wait_secs);
			}
		}
	
		// https://github.com/LearnBoost/socket.io/wiki/Exposed-events - would be
		// nice to capture the "anything" bit somehow!
	
		conn.on('connect',   function() { connectedAt = Date.now(); });
		conn.on('reconnect', function() { connectedAt = Date.now(); });
	
		conn.on('connect_failed'  , function() { handleError("connect_failed",    true); });
		conn.on('reconnect_failed', function() { handleError("reconnect_failed",  true); });
		conn.on('error',            function() { handleError("unspecified error", false); });
	
		conn.on('message', function(data) {
			var d = Date.now();
	
			writer.logStream({
				src_id: streamConfig.src_id,
				ts_connection: connectedAt,
				ts_received: d,
				line_received: JSON.stringify(data)
			});
		});
	}

	pgClient.query("SELECT id, normal_wait_secs, error_wait_secs, protocol, address FROM source WHERE active IS TRUE", function(err,result) {
		if(err)
			throw "Could not fetch configuration from database: " + err.toString();

		if(!result.rows.length)
			throw "No active sources in source table";

		result.rows.map(configFromDb).forEach(function(streamConfig) {
			switch(streamConfig.protocol) {
				case "web":       doWeb(streamConfig);       break;
				case "raw":       doRawStream(streamConfig);  break;
				case "socket.io": doIoStream(streamConfig);   break;
			}
		});
	});
}


//
// parse and act on command line
//
commander
	.version('0.1.0')
	.usage('--print-schema | <database connection string>')
	.option('--print-schema', 'Print SQL that will (destructively!) set up the database with a blank config')
	.parse(process.argv);

if(commander.args.length + (commander.printSchema?1:0) != 1) {
	console.log("You must provide --print-schema or a connection string. Never both!");
	process.exit(1);
} else if(commander.printSchema) {
	console.log("%s", fs.readFileSync(require.resolve('./schema.sql'), 'utf-8'));
	process.exit(0);
} else {
	var pgClient = new pg.Client(commander.args[0]);
	pgClient.connect(function(err) {
		if(err)
			throw "Could not connect to database: " + err.toString();
		run(pgClient);
	});
}


