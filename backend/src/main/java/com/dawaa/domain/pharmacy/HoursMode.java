package com.dawaa.domain.pharmacy;

public enum HoursMode {
  UNKNOWN,
  REGULAR,
  TWENTY_FOUR_HOURS;

  public static HoursMode fromValue(String value) {
    if (value == null || value.isBlank()) {
      return UNKNOWN;
    }

    return switch (value.trim()) {
      case "regular", "REGULAR" -> REGULAR;
      case "twentyFourHours", "TWENTY_FOUR_HOURS", "24hours", "24_HOURS" -> TWENTY_FOUR_HOURS;
      default -> UNKNOWN;
    };
  }

  public String apiValue() {
    return switch (this) {
      case REGULAR -> "regular";
      case TWENTY_FOUR_HOURS -> "twentyFourHours";
      case UNKNOWN -> "unknown";
    };
  }
}
