# LedgerLine security and integrity model

## Roles

| Role | Read | Create accounts | Move money |
| --- | --- | --- | --- |
| `ACCOUNT_HOLDER` | Own accounts, statements, and activity involving their accounts | Own accounts | Deposit into, withdraw from, or transfer from accounts they own to any valid account |
| `ADMIN` | All accounts, statements, and activity | Any account | Any account; administrator-initiated external movements are recorded like other requests |
| `AUDITOR` | All accounts, statements, and activity | No | No |

Public registration always creates `ACCOUNT_HOLDER`. An administrator can create account-holder or auditor identities, but cannot create another administrator through the API. Bootstrap the first administrator only with `BOOTSTRAP_ADMIN_USERNAME` and a strong `BOOTSTRAP_ADMIN_PASSWORD`; do not commit those values.

## Money invariants

Balances use fixed-precision `NUMERIC(19,2)` values, are constrained to be nonnegative by PostgreSQL, and have no overdraft. For every successful internal transfer, the debit equals the credit, so the sum of all balances is unchanged. For all operations together:

`sum(current balances) = sum(opening balances) + successful external deposits - successful external withdrawals`

Refused attempts and idempotent replays do not change balances. Every successful account-side posting records the resulting balance. A refusal against a known account gets a `REFUSED` statement entry with the unchanged balance. Each request also has a permanent `money_requests` outcome, including refusals that cannot be attached to a valid account. Replay and key-reuse calls are captured in `idempotency_attempts`.

## Atomicity and concurrency

The service performs idempotency-key reservation, account authorization, account row locks, request outcome creation, balance updates, and ledger inserts inside one database transaction. Any persistence error rolls the entire transaction back. A unique `(actor_id, idempotency_key)` row is locked before checking the request; an identical retry returns the saved result, while reuse with a different payload returns `409` and is recorded. Source and destination accounts are locked in UUID order to reduce deadlocks. The balance update also includes a conditional nonnegative predicate, backed by the database check constraint.

PostgreSQL triggers reject updates and deletes to the audit, money-request, idempotency-attempt, and idempotency-key tables. The runtime database role should not own these tables or have DDL/trigger privileges; use a separate migration owner in deployments. A database owner or superuser can always alter the schema, so production audit-grade tamper evidence also requires restricted credentials and external backups or an independently controlled audit sink.

## Authentication and transport

The API uses HTTP Basic authentication and BCrypt password hashes. The SPA keeps credentials only in memory and requests a CSRF token for writes. Use HTTPS in any non-local deployment; Basic authentication over plain HTTP is not safe. Configure `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` from deployment secrets. CORS is intentionally limited to the local Vite origins and must be explicitly configured for a production origin.

## Local setup and verification

Create a PostgreSQL database and login matching the configured environment variables, then start the backend. Set bootstrap-admin variables only for the initial local administrator. The backend tests exercise transfer conservation, concurrent competing withdrawals, idempotent replay, and denial of a transfer from another holder's account. They require a reachable PostgreSQL database because the production migration uses PostgreSQL-specific append-only triggers.

Start the SPA with `npm run dev`. The default API origin is `http://localhost:8080/api`; override it with `VITE_API_URL` when needed. The frontend is a convenience client only: all permissions, funds checks, locking, and idempotency decisions are server-side.