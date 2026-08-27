package com.dawaa.domain.pharmacy;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;

public record PharmacyHours(
    String timezone, HoursMode hoursMode, Map<DayOfWeek, List<OpeningInterval>> weeklyHours) {
  public static final String DEFAULT_TIMEZONE = "Asia/Beirut";

  public static PharmacyHours unknown() {
    return new PharmacyHours(DEFAULT_TIMEZONE, HoursMode.UNKNOWN, Map.of());
  }
}
