package com.ledgerline.api;

import com.ledgerline.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final JdbcTemplate jdbcTemplate;
	private final PasswordEncoder passwordEncoder;
	private final CurrentUserService currentUserService;

	public AuthController(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder,
			CurrentUserService currentUserService) {
		this.jdbcTemplate = jdbcTemplate;
		this.passwordEncoder = passwordEncoder;
		this.currentUserService = currentUserService;
	}

	@GetMapping("/csrf")
	public Map<String, String> csrf(CsrfToken csrfToken) {
		return Map.of("token", csrfToken.getToken());
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public Map<String, Object> register(@Valid @RequestBody RegistrationRequest request) {
		UUID id = UUID.randomUUID();
		try {
			jdbcTemplate.update("INSERT INTO app_users (id, username, password_hash, role) VALUES (?, ?, ?, 'ACCOUNT_HOLDER')",
					id, request.username(), passwordEncoder.encode(request.password()));
		} catch (org.springframework.dao.DuplicateKeyException exception) {
			throw new IllegalArgumentException("Username is unavailable");
		}
		return Map.of("id", id, "username", request.username(), "role", "ACCOUNT_HOLDER");
	}

	@GetMapping("/me")
	public CurrentUserService.Actor me(Authentication authentication) {
		return currentUserService.requireActor(authentication);
	}

	public record RegistrationRequest(
			@NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,80}") String username,
			@NotBlank @Size(min = 12, max = 72) String password) {
	}
}