package com.ledgerline.ledger;

import com.ledgerline.security.CurrentUserService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MoneyService {

	private final JdbcTemplate jdbcTemplate;

	public MoneyService(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Transactional
	public MoneyResult execute(CurrentUserService.Actor actor, String idempotencyKey, MoneyCommand command) {
		String payloadHash = payloadHash(command);
		jdbcTemplate.update("""
				INSERT INTO idempotency_keys (actor_id, idempotency_key, payload_hash)
				VALUES (?, ?, ?) ON CONFLICT (actor_id, idempotency_key) DO NOTHING
				""", actor.id(), idempotencyKey, payloadHash);

		List<String> savedHashes = jdbcTemplate.query("""
				SELECT payload_hash FROM idempotency_keys
				WHERE actor_id = ? AND idempotency_key = ? FOR UPDATE
				""", (rs, rowNum) -> rs.getString("payload_hash"), actor.id(), idempotencyKey);
		String savedHash = savedHashes.isEmpty() ? payloadHash : savedHashes.getFirst();
		if (!MessageDigest.isEqual(savedHash.getBytes(StandardCharsets.US_ASCII),
				payloadHash.getBytes(StandardCharsets.US_ASCII))) {
			UUID previousId = findRequestId(actor.id(), idempotencyKey);
			jdbcTemplate.update("""
					INSERT INTO idempotency_attempts (id, actor_id, idempotency_key, request_id, outcome)
					VALUES (?, ?, ?, ?, 'KEY_REUSE')
					""", UUID.randomUUID(), actor.id(), idempotencyKey, previousId);
			return MoneyResult.conflictResult();
		}

		MoneyResult previous = findExisting(actor.id(), idempotencyKey);
		if (previous != null) {
			jdbcTemplate.update("""
					INSERT INTO idempotency_attempts (id, actor_id, idempotency_key, request_id, outcome)
					VALUES (?, ?, ?, ?, 'DUPLICATE')
					""", UUID.randomUUID(), actor.id(), idempotencyKey, previous.id());
			return previous.asReplay();
		}

		Map<UUID, LockedAccount> accounts = lockAccounts(command);
		String refusal = validateAndAuthorize(actor, command, accounts);
		UUID requestId = UUID.randomUUID();
		if (refusal != null) {
			insertRequest(requestId, actor, idempotencyKey, command, accounts, "REFUSED", refusal);
			for (LockedAccount account : affectedAccounts(command, accounts)) {
				insertEntry(requestId, account, actor, "REFUSED", command.amount(), account.balance());
			}
			return new MoneyResult(requestId, command.operation(), "REFUSED", command.amount(),
					command.sourceAccountId(), command.destinationAccountId(), refusal, false);
		}

		insertRequest(requestId, actor, idempotencyKey, command, accounts, "COMPLETED", null);
		if (command.operation().equals("DEPOSIT")) {
			LockedAccount destination = accounts.get(command.destinationAccountId());
			BigDecimal newBalance = destination.balance().add(command.amount());
			updateBalance(destination, newBalance);
			insertEntry(requestId, destination, actor, "CREDIT", command.amount(), newBalance);
		} else if (command.operation().equals("WITHDRAWAL")) {
			LockedAccount source = accounts.get(command.sourceAccountId());
			BigDecimal newBalance = source.balance().subtract(command.amount());
			updateBalance(source, newBalance);
			insertEntry(requestId, source, actor, "DEBIT", command.amount(), newBalance);
		} else {
			LockedAccount source = accounts.get(command.sourceAccountId());
			LockedAccount destination = accounts.get(command.destinationAccountId());
			BigDecimal sourceBalance = source.balance().subtract(command.amount());
			BigDecimal destinationBalance = destination.balance().add(command.amount());
			updateBalance(source, sourceBalance);
			updateBalance(destination, destinationBalance);
			insertEntry(requestId, source, actor, "DEBIT", command.amount(), sourceBalance);
			insertEntry(requestId, destination, actor, "CREDIT", command.amount(), destinationBalance);
		}
		return new MoneyResult(requestId, command.operation(), "COMPLETED", command.amount(),
				command.sourceAccountId(), command.destinationAccountId(), null, false);
	}

	private Map<UUID, LockedAccount> lockAccounts(MoneyCommand command) {
		List<UUID> ids = accountIds(command);
		if (ids.isEmpty()) {
			return Map.of();
		}
		String placeholders = ids.stream().map(ignored -> "?").collect(Collectors.joining(","));
		String sql = "SELECT id, owner_id, currency, balance FROM accounts WHERE id IN (" + placeholders + ") ORDER BY id FOR UPDATE";
		Map<UUID, LockedAccount> locked = new HashMap<>();
		jdbcTemplate.query(sql, result -> {
			LockedAccount account = new LockedAccount(result.getObject("id", UUID.class),
					result.getObject("owner_id", UUID.class), result.getString("currency"), result.getBigDecimal("balance"));
			locked.put(account.id(), account);
		}, ids.toArray());
		return locked;
	}

	private String validateAndAuthorize(CurrentUserService.Actor actor, MoneyCommand command,
			Map<UUID, LockedAccount> accounts) {
		List<UUID> ids = accountIds(command);
		if (accounts.size() != ids.size()) {
			return "ACCOUNT_NOT_FOUND";
		}
		if (command.operation().equals("TRANSFER") && command.sourceAccountId().equals(command.destinationAccountId())) {
			return "SAME_ACCOUNT";
		}
		if (actor.isAuditor()) {
			return "NOT_AUTHORIZED";
		}
		if (command.sourceAccountId() != null) {
			LockedAccount source = accounts.get(command.sourceAccountId());
			if (source != null && !actor.isAdmin() && !actor.id().equals(source.ownerId())) {
				return "NOT_AUTHORIZED";
			}
		}
		if (command.operation().equals("DEPOSIT")) {
			LockedAccount destination = accounts.get(command.destinationAccountId());
			if (destination != null && !actor.isAdmin() && !actor.id().equals(destination.ownerId())) {
				return "NOT_AUTHORIZED";
			}
		}
		if (command.operation().equals("TRANSFER") &&
				!accounts.get(command.sourceAccountId()).currency().equals(accounts.get(command.destinationAccountId()).currency())) {
			return "CURRENCY_MISMATCH";
		}
		if (command.sourceAccountId() != null && accounts.containsKey(command.sourceAccountId()) &&
				accounts.get(command.sourceAccountId()).balance().compareTo(command.amount()) < 0) {
			return "INSUFFICIENT_FUNDS";
		}
		return null;
	}

	private void insertRequest(UUID requestId, CurrentUserService.Actor actor, String idempotencyKey,
			MoneyCommand command, Map<UUID, LockedAccount> accounts, String status, String reason) {
		UUID sourceId = accounts.containsKey(command.sourceAccountId()) ? command.sourceAccountId() : null;
		UUID destinationId = accounts.containsKey(command.destinationAccountId()) ? command.destinationAccountId() : null;
		jdbcTemplate.update("""
				INSERT INTO money_requests (id, actor_id, idempotency_key, operation, source_account_id,
				                           destination_account_id, amount, status, reason)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				""", requestId, actor.id(), idempotencyKey, command.operation(), sourceId, destinationId,
				command.amount(), status, reason);
	}

	private void updateBalance(LockedAccount account, BigDecimal balance) {
		int updated;
		if (balance.compareTo(account.balance()) < 0) {
			updated = jdbcTemplate.update("UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?",
					account.balance().subtract(balance), account.id(), account.balance().subtract(balance));
		} else {
			updated = jdbcTemplate.update("UPDATE accounts SET balance = balance + ? WHERE id = ?",
					balance.subtract(account.balance()), account.id());
		}
		if (updated != 1) {
			throw new IllegalStateException("Locked account balance changed unexpectedly");
		}
	}

	private void insertEntry(UUID requestId, LockedAccount account, CurrentUserService.Actor actor,
			String entryType, BigDecimal amount, BigDecimal balanceAfter) {
		jdbcTemplate.update("""
				INSERT INTO ledger_entries (id, request_id, account_id, actor_id, entry_type, amount, balance_after)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				""", UUID.randomUUID(), requestId, account.id(), actor.id(), entryType, amount, balanceAfter);
	}

	private List<LockedAccount> affectedAccounts(MoneyCommand command, Map<UUID, LockedAccount> accounts) {
		return accountIds(command).stream().map(accounts::get).filter(account -> account != null)
				.sorted(Comparator.comparing(account -> account.id().toString())).toList();
	}

	private List<UUID> accountIds(MoneyCommand command) {
		List<UUID> ids = new ArrayList<>();
		if (command.sourceAccountId() != null) ids.add(command.sourceAccountId());
		if (command.destinationAccountId() != null && !ids.contains(command.destinationAccountId())) ids.add(command.destinationAccountId());
		return ids.stream().sorted(Comparator.comparing(UUID::toString)).toList();
	}

	private MoneyResult findExisting(UUID actorId, String idempotencyKey) {
		List<MoneyResult> results = jdbcTemplate.query("""
				SELECT id, operation, status, amount, source_account_id, destination_account_id, reason
				FROM money_requests WHERE actor_id = ? AND idempotency_key = ?
				""", this::mapResult, actorId, idempotencyKey);
		return results.isEmpty() ? null : results.getFirst();
	}

	private UUID findRequestId(UUID actorId, String idempotencyKey) {
		return jdbcTemplate.query("SELECT id FROM money_requests WHERE actor_id = ? AND idempotency_key = ?",
				result -> result.next() ? result.getObject("id", UUID.class) : null, actorId, idempotencyKey);
	}

	private MoneyResult mapResult(ResultSet result, int row) throws SQLException {
		return new MoneyResult(result.getObject("id", UUID.class), result.getString("operation"),
				result.getString("status"), result.getBigDecimal("amount"),
				result.getObject("source_account_id", UUID.class), result.getObject("destination_account_id", UUID.class),
				result.getString("reason"), false);
	}

	private String payloadHash(MoneyCommand command) {
		String canonical = String.join("|", command.operation(), value(command.sourceAccountId()),
				value(command.destinationAccountId()), command.amount().setScale(2).toPlainString());
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
			return java.util.HexFormat.of().formatHex(digest);
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is unavailable", exception);
		}
	}

	private String value(UUID id) {
		return id == null ? "-" : id.toString();
	}

	private record LockedAccount(UUID id, UUID ownerId, String currency, BigDecimal balance) {
	}

	public record MoneyCommand(String operation, UUID sourceAccountId, UUID destinationAccountId, BigDecimal amount) {
	}

	public record MoneyResult(UUID id, String operation, String status, BigDecimal amount, UUID sourceAccountId,
			UUID destinationAccountId, String reason, boolean replayed, boolean keyConflict) {
		public MoneyResult(UUID id, String operation, String status, BigDecimal amount, UUID sourceAccountId,
				UUID destinationAccountId, String reason, boolean replayed) {
			this(id, operation, status, amount, sourceAccountId, destinationAccountId, reason, replayed, false);
		}

		static MoneyResult conflictResult() {
			return new MoneyResult(null, null, "REFUSED", null, null, null, "IDEMPOTENCY_KEY_REUSED", false, true);
		}

		MoneyResult asReplay() {
			return new MoneyResult(id, operation, status, amount, sourceAccountId, destinationAccountId, reason, true, false);
		}
	}
}