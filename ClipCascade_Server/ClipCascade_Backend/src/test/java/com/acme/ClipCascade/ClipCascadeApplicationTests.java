package com.acme.ClipCascade;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.acme.clipcascade.constants.ServerConstants;
import com.acme.clipcascade.service.ApiClientService;
import com.acme.clipcascade.utils.HashingUtility;

import static org.assertj.core.api.Assertions.assertThat;

// @SpringBootTest
@SpringBootTest(
		webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"spring.datasource.url=jdbc:h2:mem:clipcascade-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
				"spring.datasource.username=sa",
				"spring.datasource.password=",
				"spring.jpa.hibernate.ddl-auto=validate"
		})
class ClipCascadeApplicationTests {

	@Autowired(required = false)
	@SuppressWarnings("rawtypes")
	private SessionRepository sessionRepository;

	@Autowired
	private ApiClientService apiClientService;

	@Autowired
	private TestRestTemplate restTemplate;

	@Test
	void contextLoads() {
	}

	@Test
	void usesJdbcBackedHttpSessions() {
		assertThat(sessionRepository).isNotNull();
		assertThat(sessionRepository.getClass().getName()).contains("Jdbc");
	}

	@Test
	@SuppressWarnings("unchecked")
	void jdbcBackedHttpSessionsCanBeSavedAndLoaded() {
		Session session = sessionRepository.createSession();
		session.setAttribute("probe", "ok");

		sessionRepository.save(session);

		Session loaded = (Session) sessionRepository.findById(session.getId());
		assertThat(loaded).isNotNull();
		assertThat((String) loaded.getAttribute("probe")).isEqualTo("ok");
	}

	@Test
	void apiKeyAuthenticatesProtectedHttpEndpoints() {
		ApiClientService.CreatedApiClient created = apiClientService.createClientKey("admin", "JUnit client");
		HttpHeaders headers = new HttpHeaders();
		headers.set(ApiClientService.API_KEY_HEADER, created.apiKey());

		ResponseEntity<String> response = restTemplate.exchange(
				"/validate-session",
				HttpMethod.GET,
				new HttpEntity<>(headers),
				String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).contains("OK");
	}

	@Test
	void statelessPasswordHashMintsManagementApiKeyWithoutSession() throws Exception {
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		Map<String, String> payload = Map.of(
				"username", "admin",
				"passwordHash", sha3Hex("admin123"),
				"clientName", "Browser key manager");

		@SuppressWarnings("rawtypes")
		ResponseEntity<Map> response = restTemplate.exchange(
				"/api/key-auth/management-key",
				HttpMethod.POST,
				new HttpEntity<>(payload, headers),
				Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat((String) response.getBody().get("apiKey")).startsWith("cck_");
		assertThat(response.getBody().get("scopes")).isEqualTo(List.of(ApiClientService.SCOPE_MANAGE_KEYS));
	}

	@Test
	void syncOnlyApiKeyCannotManageClientKeys() {
		ApiClientService.CreatedApiClient created = apiClientService.createClientKey(
				"admin",
				"Sync only",
				Set.of(ApiClientService.SCOPE_SYNC));
		HttpHeaders headers = new HttpHeaders();
		headers.set(ApiClientService.API_KEY_HEADER, created.apiKey());

		ResponseEntity<String> response = restTemplate.exchange(
				"/api/client-keys",
				HttpMethod.GET,
				new HttpEntity<>(headers),
				String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
	}

	@Test
	void managementApiKeyCreatesSyncOnlyDeviceKeyByDefault() {
		ApiClientService.CreatedApiClient management = apiClientService.createClientKey(
				"admin",
				"Manager",
				Set.of(ApiClientService.SCOPE_MANAGE_KEYS));
		HttpHeaders headers = new HttpHeaders();
		headers.set(ApiClientService.API_KEY_HEADER, management.apiKey());
		headers.setContentType(MediaType.APPLICATION_JSON);

		@SuppressWarnings("rawtypes")
		ResponseEntity<Map> response = restTemplate.exchange(
				"/api/client-keys",
				HttpMethod.POST,
				new HttpEntity<>(Map.of("clientName", "Phone"), headers),
				Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat((String) response.getBody().get("apiKey")).startsWith("cck_");
		assertThat(response.getBody().get("scopes")).isEqualTo(List.of(ApiClientService.SCOPE_SYNC));
	}

	@Test
	void keysHtmlIsPublicAndSessionless() {
		ResponseEntity<String> response = restTemplate.exchange(
				"/keys.html",
				HttpMethod.GET,
				HttpEntity.EMPTY,
				String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).contains("ClipCascade Key Manager");
		assertThat(response.getBody()).contains("/api/key-auth/management-key");
	}

	@Test
	void serverUpdateMetadataUsesForkReleaseStream() {
		assertThat(ServerConstants.APP_VERSION).isEqualTo("3.2.0.5");
		assertThat(ServerConstants.VERSION_URL).contains("Darkaxt/ClipCascade");
		assertThat(ServerConstants.METADATA_URL).contains("Darkaxt/ClipCascade");
		assertThat(ServerConstants.HELP_URL).contains("Darkaxt/ClipCascade");
	}

	@Test
	void webUiOnlyShowsServerUpdateForNewerVersion() {
		ResponseEntity<String> response = restTemplate.exchange(
				"/assets/js/main.js",
				HttpMethod.GET,
				HttpEntity.EMPTY,
				String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).contains("isVersionGreater(latestServerVersion.server, serverVersion.version)");
		assertThat(response.getBody()).doesNotContain("serverVersion.version !== latestServerVersion.server");
	}

	private static String sha3Hex(String input) throws Exception {
		MessageDigest digest = MessageDigest.getInstance("SHA3-512");
		return HashingUtility.convertBytesToLowercaseHex(
				digest.digest(input.getBytes(StandardCharsets.UTF_8)));
	}
}
