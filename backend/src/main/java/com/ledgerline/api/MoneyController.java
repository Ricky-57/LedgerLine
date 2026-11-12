package com.ledgerline.api;

import com.ledgerline.ledger.MoneyService;
import com.ledgerline.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/money")
public class MoneyController {

	private final MoneyService moneyService;
	private final CurrentUserService currentUserService;

	public MoneyController(MoneyService moneyService, CurrentUserService currentUserService) {
		this.moneyService = moneyService;
		this.currentUserService = currentUserService;
	}

	@PostMapping
	public ResponseEntity<MoneyService.MoneyResult> move(
			@RequestHeader("Idempotency-Key") @NotBlank @Pattern(regexp = "[A-Za-z0-9._:-]{8,120}") String idempotencyKey,
			@Valid @RequestBody MoneyRequest request,
			Authentication authentication) {
		if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9._:-]{8,120}")) {
			throw new IllegalArgumentException("Idempotency-Key must be 8 to 120 safe characters");
		}
		validateShape(request);
		MoneyService.MoneyCommand command = new MoneyService.MoneyCommand(request.operation(), request.sourceAccountId(),
				request.destinationAccountId(), request.amount().setScale(2));
		MoneyService.MoneyResult result = moneyService.execute(currentUserService.requireActor(authentication),
				idempotencyKey, command);
		if (result.keyConflict()) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body(result);
		}
		if ("REFUSED".equals(result.status())) {
			HttpStatus status = "NOT_AUTHORIZED".equals(result.reason()) ? HttpStatus.FORBIDDEN : HttpStatus.CONFLICT;
			return ResponseEntity.status(status).body(result);
		}
		return ResponseEntity.ok(result);
	}

	private void validateShape(MoneyRequest request) {
		boolean valid = switch (request.operation()) {
			case "DEPOSIT" -> request.sourceAccountId() == null && request.destinationAccountId() != null;
			case "WITHDRAWAL" -> request.sourceAccountId() != null && request.destinationAccountId() == null;
			case "TRANSFER" -> request.sourceAccountId() != null && request.destinationAccountId() != null;
			default -> false;
		};
		if (!valid) {
			throw new IllegalArgumentException("Operation and account fields do not match");
		}
	}

	public record MoneyRequest(
			@NotBlank @Pattern(regexp = "DEPOSIT|WITHDRAWAL|TRANSFER") String operation,
			UUID sourceAccountId,
			UUID destinationAccountId,
			@NotNull @DecimalMin(value = "0.01") @Digits(integer = 17, fraction = 2) BigDecimal amount) {
	}
}