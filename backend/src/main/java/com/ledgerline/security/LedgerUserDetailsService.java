package com.ledgerline.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class LedgerUserDetailsService implements UserDetailsService {

	private final JdbcTemplate jdbcTemplate;

	public LedgerUserDetailsService(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
		return jdbcTemplate.query("SELECT username, password_hash, role FROM app_users WHERE username = ?",
				result -> {
					if (!result.next()) {
						throw new UsernameNotFoundException("Invalid credentials");
					}
					return User.withUsername(result.getString("username"))
							.password(result.getString("password_hash"))
							.roles(result.getString("role"))
							.build();
				}, username);
	}
}