PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS mdm_lookup (
    function_code      INTEGER NOT NULL,
    code               TEXT    NOT NULL,
    description        TEXT    NOT NULL,
    function_text      TEXT,
    create_user        TEXT    NOT NULL,
    create_timestamp   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user        TEXT    NOT NULL,
    modify_timestamp   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status      TEXT    NOT NULL DEFAULT 'inserted'
                              CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version            INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (function_code, code)
);

CREATE TABLE IF NOT EXISTS mdm_project (
    project_name           TEXT    NOT NULL,
    title                  TEXT    NOT NULL,
    short_description      TEXT,
    project_type_code      TEXT,
    street                 TEXT,
    house_no               TEXT,
    postal_code            TEXT,
    city                   TEXT,
    country                TEXT,
    primary_ip_address     TEXT,
    secondary_ip_address   TEXT,
    alarm_interval_sec     INTEGER,
    alarm_count_limit      INTEGER,
    technical_json         TEXT    CHECK (technical_json IS NULL OR json_valid(technical_json)),
    create_user            TEXT    NOT NULL,
    create_timestamp       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user            TEXT    NOT NULL,
    modify_timestamp       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status          TEXT    NOT NULL DEFAULT 'inserted'
                                  CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version                INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_name)
);

CREATE TABLE IF NOT EXISTS mdm_device (
    project_name             TEXT    NOT NULL,
    device_name              TEXT    NOT NULL,
    title                    TEXT    NOT NULL,
    device_type_code         TEXT    NOT NULL,
    status                   TEXT    NOT NULL CHECK (status IN ('active','inactive')),
    short_description_json   TEXT    CHECK (short_description_json IS NULL OR json_valid(short_description_json)),
    limit_min_value          REAL,
    limit_max_value          REAL,
    alarm_enabled            INTEGER NOT NULL DEFAULT 0 CHECK (alarm_enabled IN (0,1)),
    alarm_timestamp          TEXT,
    alarm_level_code         TEXT,
    detail_json              TEXT    CHECK (detail_json IS NULL OR json_valid(detail_json)),
    create_user              TEXT    NOT NULL,
    create_timestamp         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user              TEXT    NOT NULL,
    modify_timestamp         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status            TEXT    NOT NULL DEFAULT 'inserted'
                                     CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version                  INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_name, device_name),
    FOREIGN KEY (project_name)
        REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mdm_project_alarm (
    project_name          TEXT    NOT NULL,
    alarm_level_code      TEXT    NOT NULL,
    alarm_text            TEXT    NOT NULL,
    severity_rank         INTEGER,
    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version               INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_name, alarm_level_code),
    FOREIGN KEY (project_name)
        REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mdm_project_email (
    project_name          TEXT    NOT NULL,
    email_address         TEXT    NOT NULL,
    email_purpose         TEXT,
    is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version               INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_name, email_address),
    FOREIGN KEY (project_name)
        REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mdm_import_log (
    import_id             TEXT    NOT NULL,
    import_type           TEXT    NOT NULL,
    source_filename       TEXT,
    started_at            TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at           TEXT,
    imported_by           TEXT    NOT NULL,
    status                TEXT    NOT NULL CHECK (status IN ('running','success','warning','error')),
    message               TEXT,
    result_json           TEXT    CHECK (result_json IS NULL OR json_valid(result_json)),
    PRIMARY KEY (import_id)
);

CREATE TABLE IF NOT EXISTS mdm_sync_log (
    sync_id               TEXT    NOT NULL,
    sync_direction        TEXT    NOT NULL CHECK (sync_direction IN ('inbound','outbound')),
    entity_name           TEXT    NOT NULL,
    entity_key            TEXT    NOT NULL,
    sync_timestamp        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                TEXT    NOT NULL CHECK (status IN ('success','error','conflict')),
    message               TEXT,
    payload_json          TEXT    CHECK (payload_json IS NULL OR json_valid(payload_json)),
    PRIMARY KEY (sync_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_title       ON mdm_project(title);
CREATE INDEX IF NOT EXISTS idx_project_type_code   ON mdm_project(project_type_code);
CREATE INDEX IF NOT EXISTS idx_project_status      ON mdm_project(modify_status);

CREATE INDEX IF NOT EXISTS idx_device_title        ON mdm_device(title);
CREATE INDEX IF NOT EXISTS idx_device_type_code    ON mdm_device(device_type_code);
CREATE INDEX IF NOT EXISTS idx_device_status       ON mdm_device(status);
CREATE INDEX IF NOT EXISTS idx_device_project      ON mdm_device(project_name);
CREATE INDEX IF NOT EXISTS idx_device_modify_status ON mdm_device(modify_status);

CREATE TABLE IF NOT EXISTS mdm_device_variable (
    project_name          TEXT    NOT NULL,
    device_name           TEXT    NOT NULL,
    name                  TEXT    NOT NULL,
    title                 TEXT    NOT NULL,
    datablock             TEXT,
    data_type             TEXT    NOT NULL,
    offset                TEXT,
    range                 TEXT,
    unit                  TEXT,
    detail_json           TEXT    CHECK (detail_json IS NULL OR json_valid(detail_json)),
    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version               INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_name, device_name, name),
    FOREIGN KEY (project_name, device_name)
        REFERENCES mdm_device(project_name, device_name)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alarm_project       ON mdm_project_alarm(project_name);
CREATE INDEX IF NOT EXISTS idx_email_project       ON mdm_project_email(project_name);
CREATE INDEX IF NOT EXISTS idx_variable_device     ON mdm_device_variable(project_name, device_name);

CREATE TABLE IF NOT EXISTS mdm_monitor (
    project_name          TEXT    NOT NULL,
    monitor_name          TEXT    NOT NULL,
    title                 TEXT    NOT NULL,
    status                TEXT    NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active','inactive')),
    type                  TEXT,
    datablock             TEXT,
    short_description     TEXT,
    detail_json           TEXT    CHECK (detail_json IS NULL OR json_valid(detail_json)),
    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version               INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_name, monitor_name),
    FOREIGN KEY (project_name)
        REFERENCES mdm_project(project_name)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mdm_monitor_variable (
    project_name          TEXT    NOT NULL,
    monitor_name          TEXT    NOT NULL,
    name                  TEXT    NOT NULL,
    title                 TEXT,
    datablock             TEXT,
    data_type             TEXT    NOT NULL,
    offset                TEXT,
    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version               INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_name, monitor_name, name),
    FOREIGN KEY (project_name, monitor_name)
        REFERENCES mdm_monitor(project_name, monitor_name)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitor_project      ON mdm_monitor(project_name);
CREATE INDEX IF NOT EXISTS idx_monitor_status       ON mdm_monitor(status);
CREATE INDEX IF NOT EXISTS idx_monitor_modify_status ON mdm_monitor(modify_status);
CREATE INDEX IF NOT EXISTS idx_monitor_variable     ON mdm_monitor_variable(project_name, monitor_name);

-- Sequence table for mdm_monitor_variable surrogate keys (never delete rows)
CREATE TABLE IF NOT EXISTS seq_monitor_variable (
    value_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

-- Time-series table: alle 5 Sekunden abgefragte SPS-Werte
CREATE TABLE IF NOT EXISTS ts_monitor_value (
    id         INTEGER NOT NULL PRIMARY KEY,
    ts         TEXT    NOT NULL,
    value_id   INTEGER NOT NULL REFERENCES seq_monitor_variable(value_id),
    value      REAL
);

CREATE INDEX IF NOT EXISTS idx_ts_monitor_value_ts       ON ts_monitor_value(ts);
CREATE INDEX IF NOT EXISTS idx_ts_monitor_value_value_id ON ts_monitor_value(value_id, ts);

-- Meldungstexte mit Bit-Mapping (Siemens SPS HMI-Bitmeldungen)
CREATE TABLE IF NOT EXISTS mdm_message_text (
    id                    INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name                  TEXT    NOT NULL,
    alarm_text            TEXT    NOT NULL,
    alarm_class           TEXT,
    trigger_tag               TEXT,
    trigger_bit               INTEGER CHECK (trigger_bit IS NULL OR (trigger_bit >= 0 AND trigger_bit <= 15)),
    trigger_address           TEXT,
    hmi_acknowledgment_tag    TEXT,
    hmi_acknowledgment_bit    INTEGER CHECK (hmi_acknowledgment_bit IS NULL OR (hmi_acknowledgment_bit >= 0 AND hmi_acknowledgment_bit <= 15)),
    hmi_acknowledgment_address TEXT,
    report                    INTEGER NOT NULL DEFAULT 0 CHECK (report IN (0, 1)),
    create_user           TEXT    NOT NULL,
    create_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_user           TEXT    NOT NULL,
    modify_timestamp      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modify_status         TEXT    NOT NULL DEFAULT 'inserted'
                                 CHECK (modify_status IN ('inserted','updated','locked','deleted')),
    version               INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_message_text_name         ON mdm_message_text(name);
CREATE INDEX IF NOT EXISTS idx_message_text_alarm_class  ON mdm_message_text(alarm_class);
CREATE INDEX IF NOT EXISTS idx_message_text_trigger_tag  ON mdm_message_text(trigger_tag);
CREATE INDEX IF NOT EXISTS idx_message_text_status       ON mdm_message_text(modify_status);

-- better-auth Tabellen (user, session, account, verification)
CREATE TABLE IF NOT EXISTS "user" (
    "id"            TEXT    NOT NULL PRIMARY KEY,
    "name"          TEXT    NOT NULL,
    "email"         TEXT    NOT NULL UNIQUE,
    "emailVerified" INTEGER NOT NULL,
    "image"         TEXT,
    "createdAt"     DATE    NOT NULL,
    "updatedAt"     DATE    NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "expiresAt"   DATE NOT NULL,
    "token"       TEXT NOT NULL UNIQUE,
    "createdAt"   DATE NOT NULL,
    "updatedAt"   DATE NOT NULL,
    "ipAddress"   TEXT,
    "userAgent"   TEXT,
    "userId"      TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id"                     TEXT NOT NULL PRIMARY KEY,
    "accountId"              TEXT NOT NULL,
    "providerId"             TEXT NOT NULL,
    "userId"                 TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "accessToken"            TEXT,
    "refreshToken"           TEXT,
    "idToken"                TEXT,
    "accessTokenExpiresAt"   DATE,
    "refreshTokenExpiresAt"  DATE,
    "scope"                  TEXT,
    "password"               TEXT,
    "createdAt"              DATE NOT NULL,
    "updatedAt"              DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "expiresAt"  DATE NOT NULL,
    "createdAt"  DATE NOT NULL,
    "updatedAt"  DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS session_userId_idx        ON "session" ("userId");
CREATE INDEX IF NOT EXISTS account_userId_idx        ON "account" ("userId");
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification" ("identifier");
