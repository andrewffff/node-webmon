
# node-webmon

node-webmon logs data from the Internet into a Postgres database. It can log data from raw sockets, socket.io connections, or a HTTP/HTTPS url which is polled on a regular basis.


## WARNING

node-webmon can be configured (on purpose, or by accident) to connect to an information source far more
often than the source's owner is comfortable with. It doesn't even respect robots.txt! Be careful, and
pay attention when you run it.


## Installation

You need Postgres! Setting up and connecting to Postgres is beyond the scope of this README. node-webmon has
been tested with Postgres 9.1.

Install node-webmon for all users using npm:

  sudo npm install node-webmon -g

node-webmon needs to be supplied with a connection string such as *tcp://andrew@127.0.0.1/webmon* (meaning to connect
to the "webmon" database on the local machine as the "andrew" user). Once you have the database ready, you should
run the SQL to reset the schema, as found below (or run node-webmon --print-schema).

The data sources to poll are configured in the database itself.


### Web source

Add a web source like this:

	INSERT INTO sources(normal_wait_secs, error_wait_secs, protocol, address)
	VALUES (60, 600, 'web', 'http://example.com/webaddr/');

This will cause node-webmon to fetch and log the contents of http://example.com/webaddr/ every 60 seconds. It will
wait for 600 seconds if an error (including any non-2xx response code) occurs. URLs which redirect are not supported.

If you omit error_wait_secs, the value for normal_wait_secs will be used instead.

### Raw socket source

Add a raw socket like this:

	INSERT INTO sources(normal_wait_secs, protocol, address)
	VALUES (60, 'raw', '127.0.0.1:9000');

node-webmon will connect to 127.0.0.1:9000 and each line (separated by a newline character) which is sent to it
over the socket will be logged.

If the socket connection fails, or the socket is closed from the other end, node-webmon will reconnect after the
specified period.


### socket.io source

A socket.io source is a lot like a raw socket source, but instead of connecting with a raw TCP socket, the
<a href="http://socket.io/">socket.io</a> v.9 protocol is used. node-webmon only listens for "message" type
notifications from the server at this time. Example:

	INSERT INTO sources(normal_wait_secs, error_wait_secs, protocol, address)
	VALUES (10, 60, 'socket.io', 'https://127.0.0.1/socket.io/');


### Removing a source

Logged data references entries in the sources table. To deactivate a source without deleting previously
collected log data, set the active column for its row to FALSE.


## Running

node-webmon should be started with a URI-style postgresql connection string as its only parameter. For
example:

	node-webmon tcp://user@127.0.0.1/webmondb

The configuration is read from the database's sources table at startup. node-webmon will immediately 
start connecting to sources and logging.

node-webmon should tolerate network and server errors. Local errors, including problems with the
database, will result in an exception being thrown - meaning you're dumped out to the command line
with a stack trace and error message. If you want to keep node-webmon running persistently, you may
want to run it under a monitor program such as Forever.

If you change the configuration in the database, you will have to restart node-webmon for changes
to take effect.


## Logging

Web sources' data is logged into the log_http table. Socket.io and raw socket sources' data
goes into log_stream. When network/source errors occur, they will be logged into log_error.


## Caveats

- Node.js processes network traffic before our code gets it. It's also single threaded and
  prone to garbage collection pauses etc. So don't assume logged timestamps are too accurate.

- Has not been extensively tested under error conditions.

- No compression of logged data.

- node-webmon is young and hasn't seen a lot of testing in the wild.

- No real effort is made to write log data into Postgres in an efficient manner.


## Database schema

You can see the database schema by running "node-webmon --print-schema".

	BEGIN;
	
	DROP TABLE IF EXISTS log_http;
	DROP TABLE IF EXISTS log_stream;
	DROP TABLE IF EXISTS log_error;
	DROP TABLE IF EXISTS source;
	DROP TYPE IF EXISTS source_type;
	
	
	
	CREATE TYPE source_type AS ENUM ('web', 'raw', 'socket.io');
	
	CREATE TABLE source(
		id SERIAL PRIMARY KEY,
		active BOOLEAN NOT NULL DEFAULT true,
		normal_wait_secs INTEGER NOT NULL,
		error_wait_secs INTEGER DEFAULT NULL,
		protocol source_type NOT NULL,
		address TEXT NOT NULL
	);
	
	
	
	CREATE TABLE log_error(
		id SERIAL PRIMARY KEY,
		
		src_id INTEGER NOT NULL REFERENCES source(id),
	
		ts TIMESTAMP WITHOUT TIME ZONE NOT NULL,
		
		error TEXT NOT NULL
	);
	
	
	CREATE TABLE log_stream(
		id SERIAL PRIMARY KEY,
	
		src_id INTEGER NOT NULL REFERENCES source(id),
	
		ts_connection TIMESTAMP WITHOUT TIME ZONE,
		
		ts_received TIMESTAMP WITHOUT TIME ZONE,
		
		line_received TEXT NOT NULL
	);
	
	
	CREATE TABLE log_http(
		id SERIAL PRIMARY KEY,
	
		src_id INTEGER NOT NULL REFERENCES source(id),
	
		ts_request_made TIMESTAMP WITHOUT TIME ZONE NOT NULL,
		ts_headers_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
		ts_content_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
		ts_content_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	
		resp_code INTEGER,
		resp_headers TEXT,
		resp_content TEXT
	);
	
	
	
	COMMIT;

## License

(The MIT License)

Copyright (c) 2012 Andrew Francis <andrew@sullust.net>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

