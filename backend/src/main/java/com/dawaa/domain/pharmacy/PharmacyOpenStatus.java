package com.dawaa.domain.pharmacy;

import java.util.List;

public record PharmacyOpenStatus(
    String openStatus, Boolean openNow, List<OpeningInterval> todayIntervals) {}
