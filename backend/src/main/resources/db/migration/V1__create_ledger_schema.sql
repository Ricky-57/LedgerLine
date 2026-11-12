CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id),
    name VARCHAR(120) NOT NULL,
    currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD')),
    balance NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE idempotency_keys (
    actor_id UUID NOT NULL REFERENCES app_users(id),
    idempotency_key VARCHAR(120) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_id, idempotency_key)
);

CREATE TABLE money_requests (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES app_users(id),
    idempotency_key VARCHAR(120) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')),
    source_account_id UUID REFERENCES accounts(id),
    destination_account_id UUID REFERENCES accounts(id),
    amount NUMERIC(19, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('COMPLETED', 'REFUSED')),
    reason VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (actor_id, idempotency_key)
);

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES money_requests(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    actor_id UUID NOT NULL REFERENCES app_users(id),
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT', 'REFUSED')),
    amount NUMERIC(19, 2) NOT NULL CHECK (amount > 0),
    balance_after NUMERIC(19, 2) NOT NULL CHECK (balance_after >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE idempotency_attempts (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES app_users(id),
    idempotency_key VARCHAR(120) NOT NULL,
    request_id UUID REFERENCES money_requests(id),
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('DUPLICATE', 'KEY_REUSE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ledger_entries_account_created_idx ON ledger_entries(account_id, created_at, id);
CREATE INDEX money_requests_actor_created_idx ON money_requests(actor_id, created_at DESC);

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'ledger records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_append_only
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TRIGGER money_requests_append_only
    BEFORE UPDATE OR DELETE ON money_requests
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TRIGGER idempotency_attempts_append_only
    BEFORE UPDATE OR DELETE ON idempotency_attempts
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TRIGGER idempotency_keys_append_only
    BEFORE UPDATE OR DELETE ON idempotency_keys
    FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();