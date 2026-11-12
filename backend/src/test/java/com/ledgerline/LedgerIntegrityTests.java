package com.ledgerline;

import com.ledgerline.ledger.MoneyService;
import com.ledgerline.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class LedgerIntegrityTests {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private MoneyService moneyService;

	@Test
	void transferConservesMoneyAndCreatesBalancedPostings() {
		Fixture fixture = fixture(new BigDecimal("100.00"), new BigDecimal("25.00"));
		BigDecimal before = balance(fixture.source()).add(balance(fixture.destination()));

		MoneyService.MoneyResult result = move(fixture, fixture.source(), fixture.destination(), "TRANSFER",
				new BigDecimal("20.00"), "transfer-conserve-" + UUID.randomUUID());

		assertThat(result.status()).isEqualTo("COMPLETED");
		assertThat(balance(fixture.source()).add(balance(fixture.destination()))).isEqualByComparingTo(before);
		assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ledger_entries WHERE request_id = ?",
				Integer.class, result.id())).isEqualTo(2);
	}

	@Test
	void replayReturnsOriginalRequestWithoutApplyingMoneyTwice() {
		Fixture fixture = fixture(BigDecimal.ZERO, BigDecimal.ZERO);
		String key = "deposit-replay-" + UUID.randomUUID();
		MoneyService.MoneyCommand command = new MoneyService.MoneyCommand("DEPOSIT", null, fixture.destination(),
				new BigDecimal("17.50"));

		MoneyService.MoneyResult first = moneyService.execute(fixture.actor(), key, command);
		MoneyService.MoneyResult replay = moneyService.execute(fixture.actor(), key, command);

		assertThat(replay.id()).isEqualTo(first.id());
		assertThat(replay.replayed()).isTrue();
		assertThat(balance(fixture.destination())).isEqualByComparingTo("17.50");
		assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM idempotency_attempts WHERE idempotency_key = ? AND outcome = 'DUPLICATE'",
				Integer.class, key)).isEqualTo(1);
	}

	@Test
	void concurrentWithdrawalsCannotOverdrawAccount() throws Exception {
		Fixture fixture = fixture(new BigDecimal("100.00"), BigDecimal.ZERO);
		CountDownLatch start = new CountDownLatch(1);
		try (var executor = Executors.newFixedThreadPool(2)) {
			Future<MoneyService.MoneyResult> first = executor.submit(() -> {
				start.await();
				return move(fixture, fixture.source(), null, "WITHDRAWAL", new BigDecimal("80.00"), "withdraw-a-" + UUID.randomUUID());
			});
			Future<MoneyService.MoneyResult> second = executor.submit(() -> {
				start.await();
				return move(fixture, fixture.source(), null, "WITHDRAWAL", new BigDecimal("80.00"), "withdraw-b-" + UUID.randomUUID());
			});
			start.countDown();
			assertThat(java.util.List.of(first.get().status(), second.get().status()))
					.containsExactlyInAnyOrder("COMPLETED", "REFUSED");
		}
		assertThat(balance(fixture.source())).isEqualByComparingTo("20.00");
		assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM ledger_entries WHERE account_id = ? AND entry_type = 'REFUSED'",
				Integer.class, fixture.source())).isEqualTo(1);
	}

	@Test
	void holderCannotTransferAnotherHoldersFunds() {
		Fixture fixture = fixture(new BigDecimal("60.00"), BigDecimal.ZERO);
		UUID foreignOwner = createUser();
		UUID foreignSource = createAccount(foreignOwner, new BigDecimal("40.00"));
		MoneyService.MoneyResult result = move(fixture, foreignSource, fixture.destination(), "TRANSFER",
				new BigDecimal("15.00"), "ownership-check-" + UUID.randomUUID());

		assertThat(result.status()).isEqualTo("REFUSED");
		assertThat(result.reason()).isEqualTo("NOT_AUTHORIZED");
		assertThat(balance(foreignSource)).isEqualByComparingTo("40.00");
		assertThat(balance(fixture.destination())).isEqualByComparingTo("0.00");
	}

	@Test
	void holderCanTransferToAnotherHoldersAccount() {
		Fixture fixtureA = fixture(new BigDecimal("100.00"), BigDecimal.ZERO);
		Fixture fixtureB = fixture(BigDecimal.ZERO, new BigDecimal("50.00"));
		BigDecimal totalBefore = balance(fixtureA.source()).add(balance(fixtureB.destination()));

		MoneyService.MoneyResult result = move(fixtureA, fixtureA.source(), fixtureB.destination(), "TRANSFER",
				new BigDecimal("35.00"), "p2p-transfer-" + UUID.randomUUID());

		assertThat(result.status()).isEqualTo("COMPLETED");
		assertThat(balance(fixtureA.source())).isEqualByComparingTo("65.00");
		assertThat(balance(fixtureB.destination())).isEqualByComparingTo("85.00");
		BigDecimal totalAfter = balance(fixtureA.source()).add(balance(fixtureB.destination()));
		assertThat(totalAfter).isEqualByComparingTo(totalBefore);
	}

	private MoneyService.MoneyResult move(Fixture fixture, UUID source, UUID destination, String operation,
			BigDecimal amount, String key) {
		return moneyService.execute(fixture.actor(), key,
				new MoneyService.MoneyCommand(operation, source, destination, amount));
	}

	private Fixture fixture(BigDecimal sourceBalance, BigDecimal destinationBalance) {
		UUID userId = createUser();
		String username = jdbcTemplate.queryForObject("SELECT username FROM app_users WHERE id = ?", String.class, userId);
		UUID sourceId = createAccount(userId, sourceBalance);
		UUID destinationId = createAccount(userId, destinationBalance);
		return new Fixture(userId, sourceId, destinationId,
				new CurrentUserService.Actor(userId, username, "ACCOUNT_HOLDER"));
	}

	private UUID createUser() {
		UUID userId = UUID.randomUUID();
		jdbcTemplate.update("INSERT INTO app_users (id, username, password_hash, role) VALUES (?, ?, 'unused', 'ACCOUNT_HOLDER')",
				userId, "test-" + userId);
		return userId;
	}

	private UUID createAccount(UUID ownerId, BigDecimal balance) {
		UUID id = UUID.randomUUID();
		jdbcTemplate.update("INSERT INTO accounts (id, owner_id, name, currency, balance) VALUES (?, ?, ?, 'USD', ?)",
				id, ownerId, "Test account", balance);
		return id;
	}

	private BigDecimal balance(UUID accountId) {
		return jdbcTemplate.queryForObject("SELECT balance FROM accounts WHERE id = ?", BigDecimal.class, accountId);
	}

	private record Fixture(UUID ownerId, UUID source, UUID destination, CurrentUserService.Actor actor) {
	}
}