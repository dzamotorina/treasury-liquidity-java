package com.example.treasury.repo;

import com.example.treasury.domain.Order;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;

public interface OrderRepository extends ReactiveCrudRepository<Order, Long> {}
