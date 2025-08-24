package com.example.treasury.domain;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class YieldPoint {
  private String term; // e.g., 1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y, 20Y, 30Y
  private float rate;  // percent
}
