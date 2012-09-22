
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

