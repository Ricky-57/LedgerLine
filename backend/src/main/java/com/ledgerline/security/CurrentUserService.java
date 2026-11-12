package com.ledgerline.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CurrentUserService {

	private final JdbcTemplate jdbcTemplate;

	public CurrentUserService(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	public Actor requireActor(Authentication authentication) {
		if (authentication == null || !authentication.isAuthenticated()) {
			throw new org.springframework.security.access.AccessDeniedException("Authentication required");
		}
		return jdbcTemplate.queryForObject(
				"SELECT id, username, role FROM app_users WHERE username = ?",
				(result, row) -> new Actor(result.getObject("id", UUID.class), result.getString("username"),
						result.getString("role")), authentication.getName());
	}

	public record Actor(UUID id, String username, String role) {
		public boolean isAdmin() {
			return "ADMIN".equals(role);
		}

		public boolean isAuditor() {
			return "AUDITOR".equals(role);
		}
	}
}