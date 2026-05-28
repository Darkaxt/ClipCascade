package com.acme.ClipCascade;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ClassPathResource;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.acme.clipcascade.constants.RoleConstants;
import com.acme.clipcascade.constants.ServerConstants;
import com.acme.clipcascade.model.UserPrincipal;
import com.acme.clipcascade.model.Users;
import com.acme.clipcascade.repo.SyncKeyEscrowRepo;
import com.acme.clipcascade.service.ApiClientService;
import com.acme.clipcascade.utils.HashingUtility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// @SpringBootTest
@SpringBootTest(
		webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"spring.datasource.url=jdbc:h2:mem:clipcascade-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
				"spring.datasource.username=sa",
				"spring.datasource.password=",
				"spring.jpa.hibernate.ddl-auto=validate"
		})
@AutoConfigureMockMvc
class ClipCascadeApplicationTests {

	@Autowired(required = false)
	@SuppressWarnings("rawtypes")
	private SessionRepository sessionRepository;

	@Autowired
	private ApiClientService apiClientService;

	@Autowired
	private SyncKeyEscrowRepo syncKeyEscrowRepo;

	@Autowired
	private TestRestTemplate restTemplate;

	@Autowired
	private MockMvc mockMvc;

	@BeforeEach
	void clearSyncKeyEscrows() {
		syncKeyEscrowRepo.deleteAll();
	}

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
		assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).isNull();
	}

	@Test
	@SuppressWarnings("rawtypes")
	void credentialEnrollmentCreatesSyncApiKeyAndStoresWrappedSyncKey() throws Exception {
		Map<String, String> keyWrap = sampleWrappedSyncKey("first-ciphertext");
		Map<String, Object> payload = Map.of(
				"username", "admin",
				"passwordHash", sha3Hex("admin123"),
				"clientName", "Android phone",
				"keyWrap", keyWrap);

		ResponseEntity<Map> response = restTemplate.exchange(
				"/api/client-enrollment",
				HttpMethod.POST,
				new HttpEntity<>(payload, jsonHeaders()),
				Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat((String) response.getBody().get("apiKey")).startsWith("cck_");
		assertThat(response.getBody().get("scopes")).isEqualTo(List.of(ApiClientService.SCOPE_SYNC));
		assertThat(response.getBody().get("syncKeyStatus")).isEqualTo("created");
		assertThat(response.getBody().get("keyWrap")).isEqualTo(keyWrap);
		assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).isNull();
	}

	@Test
	@SuppressWarnings("rawtypes")
	void credentialEnrollmentReturnsExistingWrappedSyncKeyForLaterDevices() throws Exception {
		Map<String, String> originalWrap = sampleWrappedSyncKey("original-ciphertext");
		Map<String, String> ignoredWrap = sampleWrappedSyncKey("ignored-ciphertext");

		restTemplate.exchange(
				"/api/client-enrollment",
				HttpMethod.POST,
				new HttpEntity<>(Map.of(
						"username", "admin",
						"passwordHash", sha3Hex("admin123"),
						"clientName", "Android phone",
						"keyWrap", originalWrap), jsonHeaders()),
				Map.class);

		ResponseEntity<Map> second = restTemplate.exchange(
				"/api/client-enrollment",
				HttpMethod.POST,
				new HttpEntity<>(Map.of(
						"username", "admin",
						"passwordHash", sha3Hex("admin123"),
						"clientName", "Windows laptop",
						"keyWrap", ignoredWrap), jsonHeaders()),
				Map.class);

		assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat((String) second.getBody().get("apiKey")).startsWith("cck_");
		assertThat(second.getBody().get("clientName")).isEqualTo("Windows laptop");
		assertThat(second.getBody().get("syncKeyStatus")).isEqualTo("existing");
		assertThat(second.getBody().get("keyWrap")).isEqualTo(originalWrap);
	}

	@Test
	void credentialEnrollmentRejectsInvalidPasswordHash() throws Exception {
		ResponseEntity<String> response = restTemplate.exchange(
				"/api/client-enrollment",
				HttpMethod.POST,
				new HttpEntity<>(Map.of(
						"username", "admin",
						"passwordHash", sha3Hex("wrong"),
						"clientName", "Android phone",
						"keyWrap", sampleWrappedSyncKey("ciphertext")), jsonHeaders()),
				String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		assertThat(response.getBody()).contains("Invalid username or password");
	}

	@Test
	void browserSessionMintsManagementApiKeyWithoutRepeatingPassword() throws Exception {
		UserPrincipal principal = new UserPrincipal(
				new Users("admin", "unused", RoleConstants.ADMIN, true),
				null);

		String response = mockMvc.perform(post("/api/key-auth/session-management-key")
				.with(user(principal))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"clientName\":\"Browser key manager\"}"))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString();

		assertThat(response).contains("\"apiKey\":\"cck_");
		assertThat(response).contains(ApiClientService.SCOPE_MANAGE_KEYS);
		assertThat(response).doesNotContain(ApiClientService.SCOPE_SYNC);
	}

	@Test
	void syncApiKeyCannotMintBrowserManagementKey() {
		ApiClientService.CreatedApiClient created = apiClientService.createClientKey(
				"admin",
				"Sync only",
				Set.of(ApiClientService.SCOPE_SYNC));
		HttpHeaders headers = new HttpHeaders();
		headers.set(ApiClientService.API_KEY_HEADER, created.apiKey());
		headers.setContentType(MediaType.APPLICATION_JSON);

		ResponseEntity<String> response = restTemplate.exchange(
				"/api/key-auth/session-management-key",
				HttpMethod.POST,
				new HttpEntity<>(Map.of("clientName", "Browser key manager"), headers),
				String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
	}

	@Test
	void anonymousRequestCannotMintBrowserManagementKey() {
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);

		ResponseEntity<String> response = restTemplate.exchange(
				"/api/key-auth/session-management-key",
				HttpMethod.POST,
				new HttpEntity<>(Map.of("clientName", "Browser key manager"), headers),
				String.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
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
		assertThat(response.getBody()).contains("/api/key-auth/session-management-key");
		assertThat(response.getBody()).contains("Registered API Keys");
		assertThat(response.getBody()).contains("Advanced manual setup");
		assertThat(response.getBody()).contains("Manual API Key");
		assertThat(response.getBody()).contains("mintSessionManagementKey().catch");
		assertThat(response.getBody()).doesNotContain("<h2>Create Device Key</h2>");
		assertThat(response.getBody()).doesNotContain("Setup Bundle");
		assertThat(response.getBody()).doesNotContain("setup bundle");
		assertThat(response.getBody()).doesNotContain("Management key name");
		assertThat(response.getBody()).doesNotContain("autocomplete=\"current-password\"");
	}

	@Test
	void webUiExposesApiKeyManagerEntryPoints() throws Exception {
		String indexHtml = new ClassPathResource("static/index.html")
				.getContentAsString(StandardCharsets.UTF_8);

		assertThat(indexHtml).contains("id=\"api-keys-link\"");
		assertThat(indexHtml).contains("id=\"open-api-keys-link\"");
		assertThat(indexHtml).contains("href=\"/keys.html\"");

		ResponseEntity<String> loginResponse = restTemplate.exchange(
				"/login",
				HttpMethod.GET,
				HttpEntity.EMPTY,
				String.class);

		assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(loginResponse.getBody()).contains("href=\"/keys.html\"");
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

	private static HttpHeaders jsonHeaders() {
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		return headers;
	}

	private static Map<String, String> sampleWrappedSyncKey(String ciphertext) {
		return Map.of(
				"version", "pbkdf2-sha256-aes-gcm-v1",
				"rounds", "210000",
				"salt", "AAAAAAAAAAAAAAAAAAAAAA",
				"nonce", "00112233445566778899aabb",
				"ciphertext", ciphertext,
				"tag", "ffeeddccbbaa99887766554433221100");
	}
}
