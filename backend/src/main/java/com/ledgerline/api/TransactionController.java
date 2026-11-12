package com.ledgerline.api;

import com.ledgerline.security.CurrentUserService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

	private final JdbcTemplate jdbcTemplate;
	private final CurrentUserService currentUserService;

	public TransactionController(JdbcTemplate jdbcTemplate, CurrentUserService currentUserService) {
		this.jdbcTemplate = jdbcTemplate;
		this.currentUserService = currentUserService;
	}

	@GetMapping
	public List<Map<String, Object>> transactions(Authentication authentication) {
		CurrentUserService.Actor actor = currentUserService.requireActor(authentication);
		String sql = """
				SELECT DISTINCT r.id, r.operation, r.amount, r.status, r.reason,
				       r.source_account_id AS "sourceAccountId", r.destination_account_id AS "destinationAccountId",
				       COALESCE(source_account.currency, destination_account.currency) AS "currency",
				       u.username AS "initiatedBy", r.created_at AS "createdAt"
				FROM money_requests r
				JOIN app_users u ON u.id = r.actor_id
				LEFT JOIN accounts source_account ON source_account.id = r.source_account_id
				LEFT JOIN accounts destination_account ON destination_account.id = r.destination_account_id
				""" + (actor.isAdmin() || actor.isAuditor() ? "" : " WHERE r.actor_id = ? OR source_account.owner_id = ? OR destination_account.owner_id = ?") +
				" ORDER BY r.created_at DESC LIMIT 200";
		if (actor.isAdmin() || actor.isAuditor()) {
			return jdbcTemplate.queryForList(sql);
		}
		return jdbcTemplate.queryForList(sql, actor.id(), actor.id(), actor.id());
	}
}