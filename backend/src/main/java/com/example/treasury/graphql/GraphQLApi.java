package com.example.treasury.graphql;

import com.example.treasury.domain.Order;
import com.example.treasury.domain.YieldPoint;
import com.example.treasury.repo.OrderRepository;
import com.example.treasury.service.YieldService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;
import org.springframework.validation.annotation.Validated;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Controller
@RequiredArgsConstructor
@Validated
public class GraphQLApi {

  private final YieldService yieldService;
  private final OrderRepository orderRepo;

  @QueryMapping
  public Mono<List<YieldPoint>> yieldCurve() {
    return yieldService.getYieldCurve();
  }

  @QueryMapping
  public Flux<Order> orders() {
    return orderRepo.findAll()
        .sort(Comparator.comparing(Order::getCreatedAt).reversed());
  }

  @MutationMapping
  public Mono<Order> createOrder(@Argument("input") CreateOrderInput input) {
    if (input.amount <= 0) {
      return Mono.error(new IllegalArgumentException("Amount must be > 0"));
    }
    // capture yield at submission if available
    return yieldService.getYieldCurve().map(list -> {
      Double rate = list.stream()
          .filter(p -> p.getTerm().equalsIgnoreCase(input.term))
          .map(p -> (double) p.getRate())
          .findFirst().orElse(null);
      Order o = new Order(null, input.term.toUpperCase(),
          BigDecimal.valueOf(input.amount), Instant.now(),
          "SUBMITTED", rate);
      return o;
    }).flatMap(orderRepo::save);
  }

  @Data
  public static class CreateOrderInput {
    public String term;
    public double amount;
  }
}
