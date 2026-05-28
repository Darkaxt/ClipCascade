package com.acme.ClipCascade;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;

import com.acme.clipcascade.service.ApiClientService;

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

}
