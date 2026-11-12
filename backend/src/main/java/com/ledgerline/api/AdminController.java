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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
public class AdminController {

	private final JdbcTemplate jdbcTemplate;
	private final PasswordEncoder passwordEncoder;
	private final CurrentUserService currentUserService;

	public AdminController(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder,
			CurrentUserService currentUserService) {
		this.jdbcTemplate = jdbcTemplate;
		this.passwordEncoder = passwordEncoder;
		this.currentUserService = currentUserService;
	}

	@GetMapping
	public List<Map<String, Object>> users(Authentication authentication) {
		requireAdmin(authentication);
		return jdbcTemplate.queryForList("SELECT id, username, role, created_at AS \"createdAt\" FROM app_users ORDER BY username");
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Map<String, Object> create(@Valid @RequestBody CreateUserRequest request, Authentication authentication) {
		requireAdmin(authentication);
		UUID id = UUID.randomUUID();
		try {
			jdbcTemplate.update("INSERT INTO app_users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
					id, request.username(), passwordEncoder.encode(request.password()), request.role());
		} catch (org.springframework.dao.DuplicateKeyException exception) {
			throw new IllegalArgumentException("Username is unavailable");
		}
		return Map.of("id", id, "username", request.username(), "role", request.role());
	}

	private void requireAdmin(Authentication authentication) {
		if (!currentUserService.requireActor(authentication).isAdmin()) {
			throw new AccessDeniedException("Administrator role required");
		}
	}

	public record CreateUserRequest(@NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,80}") String username,
			@NotBlank @Size(min = 12, max = 72) String password,
			@NotBlank @Pattern(regexp = "ACCOUNT_HOLDER|AUDITOR") String role) {
	}
}