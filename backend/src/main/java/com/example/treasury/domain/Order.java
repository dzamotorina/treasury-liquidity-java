package com.example.treasury.domain;

import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Table("orders")
public class Order {
  @Id
  private Long id;
  private String term;
  private BigDecimal amount;
  private Instant createdAt;
  private String status;
  private Double rateAtSubmission;
}
