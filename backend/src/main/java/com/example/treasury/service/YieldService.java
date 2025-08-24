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
    List<String> entries = new ArrayList<>();
    Matcher m = Pattern.compile("<entry>(.*?)</entry>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE).matcher(xml == null ? "" : xml);
    while (m.find()) entries.add(m.group(1));

    LocalDate bestDate = null;
    Map<String, Double> best = null;

    for (String entry : entries) {
      String dateStr = matchFirst(entry, "<d:(NEW_DATE|CMTDATE|DATE)[^>]*>(.*?)</d:\\1>");
      if (dateStr == null) continue;
      String justDate = dateStr.split("T")[0];
      LocalDate d;
      try {
        d = LocalDate.parse(justDate);
      } catch (Exception e) {
        continue;
      }
      if (d.isAfter(onOrBefore)) continue;

      Map<String, Double> map = new HashMap<>();
      Matcher kv = Pattern.compile("<d:(BC_[A-Z0-9_]+)[^>]*>(.*?)</d:\\1>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE).matcher(entry);
      while (kv.find()) {
        String key = kv.group(1).toUpperCase(Locale.ROOT);
        String val = kv.group(2).trim();
        if (val.equalsIgnoreCase("N/A") || val.isEmpty()) continue;
        try {
          map.put(key, Double.parseDouble(val));
        } catch (NumberFormatException ignored) {}
      }

      if (!map.isEmpty() && (bestDate == null || d.isAfter(bestDate))) {
        bestDate = d;
        best = map;
      }
    }

    if (best == null) return List.of();

    List<YieldPoint> pts = new ArrayList<>();
    for (var e : FIELD_TO_LABEL.entrySet()) {
      Double v = best.get(e.getKey());
      if (v != null) pts.add(new YieldPoint(e.getValue(), v.floatValue()));
    }
    return pts;
  }

  private List<YieldPoint> orderCanonically(List<YieldPoint> pts) {
    if (pts == null || pts.isEmpty()) return List.of();
    Map<String, YieldPoint> by = pts.stream().collect(Collectors.toMap(YieldPoint::getTerm, p -> p, (a,b)->a));
    List<YieldPoint> ordered = new ArrayList<>();
    for (String t : CANONICAL_ORDER) if (by.containsKey(t)) ordered.add(by.get(t));
    return ordered;
  }

  private static String matchFirst(String text, String regex) {
    Matcher m = Pattern.compile(regex, Pattern.DOTALL | Pattern.CASE_INSENSITIVE).matcher(text);
    return m.find() ? m.group(2).trim() : null;
  }
}
