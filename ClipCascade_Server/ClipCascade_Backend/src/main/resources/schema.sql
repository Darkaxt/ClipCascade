-- query to create the table users if it doesn't exist (Java: Users.class)
CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(255) PRIMARY KEY, -- Username is primary key(unique and not null)
    password VARCHAR(255) NOT NULL, -- Password cannot be null
    role VARCHAR(255) NOT NULL DEFAULT 'USER', -- Default value for role
    enabled BOOLEAN NOT NULL DEFAULT TRUE -- Default value for enabled
);

-- query to create the table user_info if it doesn't exist (Java: UserInfo.class)
CREATE TABLE IF NOT EXISTS user_info (
    username VARCHAR(255) PRIMARY KEY, -- Username is primary key (unique and not null)
    marked_for_deletion BOOLEAN DEFAULT FALSE, -- Flag indicating if the user is marked for deletion
    first_signup BIGINT, -- Timestamp of the user's first signup
    last_login BIGINT, -- Timestamp of the user's last login
    first_signup_ip VARCHAR(255), -- IP address of the user at the time of first signup
    last_login_ip VARCHAR(255), -- IP address of the user at the time of last login
    failed_login_attempts INT DEFAULT 0, -- Number of failed login attempts
    lockout_time VARCHAR(255), -- Lockout time in string format
    password_changed_at BIGINT, -- Timestamp of when the password was last changed
    email VARCHAR(255), -- User's email address
    otp VARCHAR(255), -- One-time password for authentication
    phone VARCHAR(20), -- User's phone number
    first_name VARCHAR(255), -- User's first name
    last_name VARCHAR(255), -- User's last name
    notes TEXT -- Additional notes about the user
);

-- API-key client/device registrations. The plaintext API key is shown once to
-- the client and only its SHA-256 hash is stored here.
CREATE TABLE IF NOT EXISTS api_clients (
    client_id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at BIGINT NOT NULL,
    last_used_at BIGINT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS api_clients_username_idx ON api_clients (username);

-- Spring Session JDBC tables. These keep JSESSIONID-backed logins valid across
-- container restarts when the database directory is mounted persistently.
CREATE TABLE IF NOT EXISTS SPRING_SESSION (
    PRIMARY_ID CHAR(36) NOT NULL,
    SESSION_ID CHAR(36) NOT NULL,
    CREATION_TIME BIGINT NOT NULL,
    LAST_ACCESS_TIME BIGINT NOT NULL,
    MAX_INACTIVE_INTERVAL INT NOT NULL,
    EXPIRY_TIME BIGINT NOT NULL,
    PRINCIPAL_NAME VARCHAR(100),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);

CREATE UNIQUE INDEX IF NOT EXISTS SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX IF NOT EXISTS SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX IF NOT EXISTS SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);

CREATE TABLE IF NOT EXISTS SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36) NOT NULL,
    ATTRIBUTE_NAME VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES BYTEA NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID)
        REFERENCES SPRING_SESSION(PRIMARY_ID) ON DELETE CASCADE
);
