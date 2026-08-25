package com.dawaa.business.route;

import com.dawaa.domain.route.RouteDirections;
import com.dawaa.persistence.openrouteservice.OpenRouteServiceClient;
import java.util.Objects;

public class RouteService {
  private final OpenRouteServiceClient openRouteServiceClient;

  public RouteService(OpenRouteServiceClient openRouteServiceClient) {
    this.openRouteServiceClient =
        Objects.requireNonNull(openRouteServiceClient, "openRouteServiceClient is required");
  }

  public RouteDirections getDirections(
      double fromLat, double fromLng, double toLat, double toLng) {
    validateCoordinate(fromLat, "from.lat", -90, 90);
    validateCoordinate(toLat, "to.lat", -90, 90);
    validateCoordinate(fromLng, "from.lng", -180, 180);
    validateCoordinate(toLng, "to.lng", -180, 180);

    return openRouteServiceClient.getDirections(fromLat, fromLng, toLat, toLng);
  }

  private static void validateCoordinate(double value, String name, double min, double max) {
    if (!Double.isFinite(value) || value < min || value > max) {
      throw new IllegalArgumentException(name + " is invalid");
    }
  }
}
