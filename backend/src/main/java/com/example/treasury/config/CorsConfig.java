package com.example.treasury.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {
  @Bean
  public CorsWebFilter corsWebFilter() {
    CorsConfiguration cors = new CorsConfiguration();
    cors.addAllowedOriginPattern("*");
    cors.addAllowedHeader("*");
    cors.addAllowedMethod("*");
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cors);
    return new CorsWebFilter(source);
  }
}
