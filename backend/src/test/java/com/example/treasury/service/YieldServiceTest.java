package com.example.treasury.service;

import com.example.treasury.domain.YieldPoint;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class YieldServiceTest {

    private MockWebServer mockWebServer;
    private YieldService yieldService;

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();
        
        yieldService = new YieldService();
        
        // Replace the WebClient with one pointing to our mock server
        WebClient testWebClient = WebClient.builder()
            .baseUrl(mockWebServer.url("/").toString())
            .build();
        ReflectionTestUtils.setField(yieldService, "http", testWebClient);
        // Ensure service targets the mock server (so requests are counted)
        ReflectionTestUtils.setField(yieldService, "treasuryEndpointBase", mockWebServer.url("/").toString());
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    @Test
    void testGetYieldCurve_Cache() {
        // Given
        String mockXml = createMockTreasuryXml();
        mockWebServer.enqueue(new MockResponse()
            .setBody(mockXml)
            .setResponseCode(200));

        // When - first call
        Mono<List<YieldPoint>> firstCall = yieldService.getYieldCurve();
        
        // Then - verify first call
        StepVerifier.create(firstCall)
            .assertNext(yieldPoints -> {
                assertNotNull(yieldPoints);
                assertFalse(yieldPoints.isEmpty());
            })
            .verifyComplete();

        // When - second call (should use cache, no new HTTP request)
        Mono<List<YieldPoint>> secondCall = yieldService.getYieldCurve();
        
        // Then - verify second call returns cached data
        StepVerifier.create(secondCall)
            .assertNext(yieldPoints -> {
                assertNotNull(yieldPoints);
                assertFalse(yieldPoints.isEmpty());
            })
            .verifyComplete();

        // Verify only one HTTP request was made
        assertEquals(1, mockWebServer.getRequestCount());
    }

    @Test
    void testGetYieldCurve_Success() {
        // Given
        String mockXml = createMockTreasuryXml();
        mockWebServer.enqueue(new MockResponse()
            .setBody(mockXml)
            .setHeader("Content-Type", "application/xml")
            .setResponseCode(200));

        // When & Then
        StepVerifier.create(yieldService.getYieldCurve())
            .assertNext(yieldPoints -> {
                assertNotNull(yieldPoints);
                assertFalse(yieldPoints.isEmpty());
                
                // Verify some basic properties
                YieldPoint firstPoint = yieldPoints.get(0);
                assertNotNull(firstPoint.getTerm());
                assertTrue(firstPoint.getRate() > 0);
            })
            .verifyComplete();
    }

    @Test
    void testGetYieldCurve_ServerError() {
        // Given
        mockWebServer.enqueue(new MockResponse().setResponseCode(500));
        mockWebServer.enqueue(new MockResponse().setResponseCode(500)); // For fallback month

        // When & Then
        StepVerifier.create(yieldService.getYieldCurve())
            .assertNext(yieldPoints -> {
                assertNotNull(yieldPoints);
                assertTrue(yieldPoints.isEmpty());
            })
            .verifyComplete();
    }

    @Test
    void testGetYieldCurve_EmptyResponse() {
        // Given
        mockWebServer.enqueue(new MockResponse()
            .setBody("")
            .setResponseCode(200));
        mockWebServer.enqueue(new MockResponse()
            .setBody("")
            .setResponseCode(200)); // For fallback month

        // When & Then
        StepVerifier.create(yieldService.getYieldCurve())
            .assertNext(yieldPoints -> {
                assertNotNull(yieldPoints);
                assertTrue(yieldPoints.isEmpty());
            })
            .verifyComplete();
    }

    @Test
    void testGetYieldCurve_CacheExpiry() {
        // Given
        String mockXml = createMockTreasuryXml();
        mockWebServer.enqueue(new MockResponse()
            .setBody(mockXml)
            .setResponseCode(200));

        // Set cache time to past to simulate expiry
        ReflectionTestUtils.setField(yieldService, "lastFetch", Instant.now().minus(Duration.ofHours(1)));

        // When - call should bypass cache
        StepVerifier.create(yieldService.getYieldCurve())
            .assertNext(yieldPoints -> {
                assertNotNull(yieldPoints);
                assertFalse(yieldPoints.isEmpty());
            })
            .verifyComplete();
    }

    private String createMockTreasuryXml() {
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
                <entry>
                    <NEW_DATE>2024-01-15T00:00:00</NEW_DATE>
                    <BC_1MONTH>4.25</BC_1MONTH>
                    <BC_2MONTH>4.35</BC_2MONTH>
                    <BC_3MONTH>4.45</BC_3MONTH>
                    <BC_6MONTH>4.55</BC_6MONTH>
                    <BC_1YEAR>4.65</BC_1YEAR>
                    <BC_2YEAR>4.75</BC_2YEAR>
                    <BC_3YEAR>4.85</BC_3YEAR>
                    <BC_5YEAR>4.95</BC_5YEAR>
                    <BC_7YEAR>5.05</BC_7YEAR>
                    <BC_10YEAR>5.15</BC_10YEAR>
                    <BC_20YEAR>5.25</BC_20YEAR>
                    <BC_30YEAR>5.35</BC_30YEAR>
                </entry>
            </feed>
            """;
    }
}
