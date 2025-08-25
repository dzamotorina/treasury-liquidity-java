package com.example.treasury.service;

import com.example.treasury.domain.YieldPoint;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.*;
import java.util.*;
import java.util.concurrent.TimeoutException;
import java.util.regex.*;
import java.util.stream.Collectors;

/**
 * Fetches the Daily Treasury Par Yield Curve via the official Treasury XML feed
 * and maps to a simple list of (term, rate).
 *
 * Source Docs: https://home.treasury.gov/treasury-daily-interest-rate-xml-feed
 */
@Service
public class YieldService {

  private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(YieldService.class);

  private final WebClient http;
  private volatile List<YieldPoint> cache = null;
  private volatile Instant lastFetch = Instant.EPOCH;

  public YieldService() {
    // Configure timeouts and basic headers (no custom resolver here)
    reactor.netty.http.client.HttpClient netty = reactor.netty.http.client.HttpClient.create()
        .compress(true)
        .responseTimeout(java.time.Duration.ofSeconds(10))
        .option(io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000);

    this.http = org.springframework.web.reactive.function.client.WebClient.builder()
        .clientConnector(new org.springframework.http.client.reactive.ReactorClientHttpConnector(netty))
        .defaultHeader(org.springframework.http.HttpHeaders.USER_AGENT, "TreasuryLiquidity/1.0 (+http://localhost)")
        .defaultHeader(org.springframework.http.HttpHeaders.ACCEPT, org.springframework.http.MediaType.APPLICATION_XML_VALUE)
        .build();
  }

  private static final Map<String,String> FIELD_TO_LABEL = Map.ofEntries(
      Map.entry("BC_1MONTH", "1M"),
      Map.entry("BC_1_5MONTH", "1.5M"),
      Map.entry("BC_2MONTH", "2M"),
      Map.entry("BC_3MONTH", "3M"),
      Map.entry("BC_4MONTH", "4M"),
      Map.entry("BC_6MONTH", "6M"),
      Map.entry("BC_1YEAR", "1Y"),
      Map.entry("BC_2YEAR", "2Y"),
      Map.entry("BC_3YEAR", "3Y"),
      Map.entry("BC_5YEAR", "5Y"),
      Map.entry("BC_7YEAR", "7Y"),
      Map.entry("BC_10YEAR", "10Y"),
      Map.entry("BC_20YEAR", "20Y"),
      Map.entry("BC_30YEAR", "30Y")
  );

  private static final List<String> CANONICAL_ORDER = List.of(
      "1M","1.5M","2M","3M","4M","6M","1Y","2Y","3Y","5Y","7Y","10Y","20Y","30Y"
  );

  public Mono<List<YieldPoint>> getYieldCurve() {
    // 30-minute cache to avoid hammering the feed
    if (cache != null && Duration.between(lastFetch, Instant.now()).toMinutes() < 30) {
      log.debug("Serving yield curve from cache ({} points)", cache.size());
      return Mono.just(cache);
    }

    LocalDate today = LocalDate.now();
    return fetchMonth(today)
        .flatMap(xml -> {
          log.debug("Fetched XML for {}, size={} bytes", today, xml != null ? xml.length() : 0);
          List<YieldPoint> curve = extractLatestCurve(xml, today);
          log.debug("Parsed {} points for {}", curve.size(), today);
          return curve.isEmpty() ? Mono.empty() : Mono.just(curve);
        })
        // try previous month if current month yields nothing
        .switchIfEmpty(fetchMonth(today.minusMonths(1))
            .flatMap(xml -> {
              log.debug("Fetched XML for previous month {}, size={} bytes", today.minusMonths(1), xml != null ? xml.length() : 0);
              List<YieldPoint> curve = extractLatestCurve(xml, today.minusMonths(1));
              log.debug("Parsed {} points for previous month {}", curve.size(), today.minusMonths(1));
              return curve.isEmpty() ? Mono.empty() : Mono.just(curve);
            })
        )
        .map(this::orderCanonically)
        .doOnNext(list -> log.debug("Ordered canonically: {} points", list.size()))
        .filter(list -> list != null && !list.isEmpty())
        .doOnNext(list -> { cache = list; lastFetch = Instant.now(); })
        .switchIfEmpty(Mono.fromSupplier(() -> {
          log.warn("No yield curve data available from Treasury for {} or {}", today, today.minusMonths(1));
          return List.of(); // never return null / never complete empty
        }))
        .onErrorResume(e -> {
          log.error("Error retrieving yield curve: {}", e.toString(), e);
          return Mono.just(List.of()); // ensure a response
        });
  }

  private Mono<String> fetchMonth(LocalDate date) {
    String yyyymm = String.format("%04d%02d", date.getYear(), date.getMonthValue());
    String url = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
        + "?data=daily_treasury_yield_curve&field_tdr_date_value_month=" + yyyymm;
    log.debug("Requesting Treasury XML: {}", url);
    return http.get()
        .uri(url)
        .retrieve()
        .onStatus(s -> s.is4xxClientError() || s.is5xxServerError(), resp -> {
          log.warn("Treasury HTTP error: status={}", resp.statusCode());
          return resp.createException();
        })
        .bodyToMono(String.class);
  }

  private List<YieldPoint> extractLatestCurve(String xml, LocalDate onOrBefore) {
    if (xml == null || xml.isBlank()) return List.of();

    try {
      javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
      dbf.setNamespaceAware(true);
      dbf.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
      // Harden against XXE/DTD; ignore if impl doesn't support the flag
      try {
        dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      } catch (javax.xml.parsers.ParserConfigurationException ignored) {}

      javax.xml.parsers.DocumentBuilder db = dbf.newDocumentBuilder();
      org.w3c.dom.Document doc = db.parse(new org.xml.sax.InputSource(new java.io.StringReader(xml)));

      javax.xml.xpath.XPathFactory xpf = javax.xml.xpath.XPathFactory.newInstance();
      javax.xml.xpath.XPath xp = xpf.newXPath();
      // Removed dependency on namespace context; use local-name() instead

      // Entries (namespace-agnostic)
      org.w3c.dom.NodeList entries = (org.w3c.dom.NodeList)
          xp.evaluate("//*[local-name()='entry']", doc, javax.xml.xpath.XPathConstants.NODESET);

      java.time.LocalDate bestDate = null;
      java.util.Map<String, Double> best = null;

      for (int i = 0; i < entries.getLength(); i++) {
        org.w3c.dom.Node entry = entries.item(i);

        // Try multiple possible date fields seen in the feed (namespace-agnostic)
        String dateStr = (String) xp.evaluate(
            "string(.//*[local-name()='NEW_DATE' or local-name()='CMTDATE' or local-name()='DATE'])",
            entry, javax.xml.xpath.XPathConstants.STRING);

        if (dateStr == null || dateStr.isBlank()) continue;
        String justDate = dateStr.split("T")[0].trim();

        java.time.LocalDate d;
        try {
          d = java.time.LocalDate.parse(justDate);
        } catch (Exception ex) {
          continue;
        }
        if (d.isAfter(onOrBefore)) continue;

        // Collect all yield fields BC_* (namespace-agnostic)
        org.w3c.dom.NodeList bcNodes = (org.w3c.dom.NodeList)
            xp.evaluate(".//*[starts-with(local-name(),'BC_')]",
                entry, javax.xml.xpath.XPathConstants.NODESET);

        java.util.Map<String, Double> map = new java.util.HashMap<>();
        for (int j = 0; j < bcNodes.getLength(); j++) {
          org.w3c.dom.Element el = (org.w3c.dom.Element) bcNodes.item(j);
          String key = el.getLocalName(); // e.g., BC_2YEAR
          String text = el.getTextContent() != null ? el.getTextContent().trim() : "";
          if (text.isEmpty() || "N/A".equalsIgnoreCase(text)) continue;
          try {
            map.put(key, Double.parseDouble(text));
          } catch (NumberFormatException ignored) {}
        }

        if (!map.isEmpty() && (bestDate == null || d.isAfter(bestDate))) {
          bestDate = d;
          best = map;
        }
      }

      if (best == null) return List.of();

      java.util.List<YieldPoint> pts = new java.util.ArrayList<>();
      for (var e : FIELD_TO_LABEL.entrySet()) {
        Double v = best.get(e.getKey());
        if (v != null) pts.add(new YieldPoint(e.getValue(), v.floatValue()));
      }
      return pts;
    } catch (Exception e) {
      log.warn("XML parse error (DOM/XPath): {}", e.toString());
      return List.of();
    }
  }

  private List<YieldPoint> orderCanonically(List<YieldPoint> pts) {
    if (pts == null || pts.isEmpty()) return List.of();
    java.util.Map<String, YieldPoint> by =
        pts.stream().collect(java.util.stream.Collectors.toMap(YieldPoint::getTerm, p -> p, (a, b) -> a));
    java.util.List<YieldPoint> ordered = new java.util.ArrayList<>();
    for (String t : CANONICAL_ORDER) {
      YieldPoint p = by.get(t);
      if (p != null) ordered.add(p);
    }
    return ordered;
  }

  // Minimal namespace context for Atom + OData used by the Treasury feed
  // Removed SimpleNsContext to avoid ClassNotFound issues and make XPath namespace-agnostic
}
