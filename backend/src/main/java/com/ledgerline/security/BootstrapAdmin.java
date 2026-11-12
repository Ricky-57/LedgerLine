package com.ledgerline.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class BootstrapAdmin implements ApplicationRunner {

	private final JdbcTemplate jdbcTemplate;
	private final PasswordEncoder passwordEncoder;
	private final String username;
	private final String password;

	public BootstrapAdmin(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder,
			@Value("${ledgerline.bootstrap-admin.username:}") String username,
			@Value("${ledgerline.bootstrap-admin.password:}") String password) {
		this.jdbcTemplate = jdbcTemplate;
		this.passwordEncoder = passwordEncoder;
		this.username = username;
		this.password = password;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (username.isBlank() || password.isBlank()) {
			return;
		}
		jdbcTemplate.update("INSERT INTO app_users (id, username, password_hash, role) VALUES (?, ?, ?, 'ADMIN') " +
				"ON CONFLICT (username) DO NOTHING", UUID.randomUUID(), username,
				passwordEncoder.encode(password));
	}
}