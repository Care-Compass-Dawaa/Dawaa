package com.dawaa.domain.route;

import java.util.List;

public record RouteDirections(
    double distanceMeters,
    double durationSeconds,
    List<List<Double>> coordinates) {}
