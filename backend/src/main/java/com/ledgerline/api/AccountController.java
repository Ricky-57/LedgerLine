package com.ledgerline.api;

import com.ledgerline.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

	private final JdbcTemplate jdbcTemplate;
	private final CurrentUserService currentUserService;

	public AccountController(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
		this.jdbcTemplate = jdbcTemplate;
		this.currentUserService = currentUserService;
	}

	@GetMapping
	public List<AccountView> accounts(Authentication authentication) {
		CurrentUserService.Actor actor = currentUserService.requireActor(authentication);
		String sql = actor.isAdmin() || actor.isAuditor()
				? "SELECT id, owner_id, name, currency, balance, created_at FROM accounts ORDER BY created_at DESC"
				: "SELECT id, owner_id, name, currency, balance, created_at FROM accounts WHERE owner_id = ? ORDER BY created_at DESC";
		return actor.isAdmin() || actor.isAuditor()
				? jdbcTemplate.query(sql, this::mapAccount)
				: jdbcTemplate.query(sql, this::mapAccount, actor.id());
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public AccountView create(@Valid @RequestBody CreateAccountRequest request, Authentication authentication) {
		CurrentUserService.Actor actor = currentUserService.requireActor(authentication);
		if (actor.isAuditor()) {
			throw new AccessDeniedException("Auditors cannot create accounts");
		}
		UUID ownerId = request.ownerId() == null ? actor.id() : request.ownerId();
		if (!actor.isAdmin() && !actor.id().equals(ownerId)) {
			throw new AccessDeniedException("Cannot create an account for another user");
		}
		Integer ownerExists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM app_users WHERE id = ?", Integer.class, ownerId);
		if (ownerExists == null || ownerExists == 0) {
			throw new IllegalArgumentException("Account owner does not exist");
		}
		UUID accountId = UUID.randomUUID();
		jdbcTemplate.update("INSERT INTO accounts (id, owner_id, name, currency) VALUES (?, ?, ?, ?)",
				accountId, ownerId, request.name().trim(), request.currency().toUpperCase());
		return jdbcTemplate.queryForObject(
				"SELECT id, owner_id, name, currency, balance, created_at FROM accounts WHERE id = ?",
				this::mapAccount, accountId);
	}

	@GetMapping("/{accountId}")
	public AccountView account(@PathVariable UUID accountId, Authentication authentication) {
		CurrentUserService.Actor actor = currentUserService.requireActor(authentication);
		return jdbcTemplate.query("SELECT id, owner_id, name, currency, balance, created_at FROM accounts WHERE id = ?",
				result -> {
					if (!result.next()) {
						throw new IllegalArgumentException("Account not found");
					}
					AccountView account = mapAccount(result, 1);
					if (!actor.isAdmin() && !actor.isAuditor() && !actor.id().equals(account.ownerId())) {
						throw new AccessDeniedException("Access denied");
					}
					return account;
				}, accountId);
	}

	@GetMapping("/{accountId}/statement")
	public List<Map<String, Object>> statement(@PathVariable UUID accountId, Authentication authentication) {
		account(accountId, authentication);
		return jdbcTemplate.queryForList("""
				SELECT e.id, e.request_id AS "requestId", r.operation, r.status, e.entry_type AS "entryType",
				       e.amount, e.balance_after AS "balanceAfter", u.username AS "initiatedBy", e.created_at AS "createdAt",
				       r.reason
				FROM ledger_entries e JOIN money_requests r ON r.id = e.request_id
				JOIN app_users u ON u.id = e.actor_id
				WHERE e.account_id = ? ORDER BY e.created_at, e.id
				""", accountId);
	}

	private AccountView mapAccount(java.sql.ResultSet result, int row) throws java.sql.SQLException {
		return new AccountView(result.getObject("id", UUID.class), result.getObject("owner_id", UUID.class),
				result.getString("name"), result.getString("currency"), result.getBigDecimal("balance"),
				result.getObject("created_at", OffsetDateTime.class));
	}

	public record AccountView(UUID id, UUID ownerId, String name, String currency, BigDecimal balance,
			OffsetDateTime createdAt) {
	}

	public record CreateAccountRequest(@NotBlank @Size(max = 120) String name,
			@NotBlank @Pattern(regexp = "USD|INR|EUR|GBP|CAD|AUD", flags = Pattern.Flag.CASE_INSENSITIVE) String currency, UUID ownerId) {
	}
}