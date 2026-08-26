package com.dawaa.persistence.openrouteservice;

import com.dawaa.domain.route.RouteDirections;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

public class OpenRouteServiceClient {
  private static final String BASE_URL = "https://api.openrouteservice.org/v2/directions/";
  private static final String DEFAULT_PROFILE = "driving-car";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final HttpClient httpClient;
  private final String apiKey;
  private final String profile;

  public OpenRouteServiceClient() {
    this(HttpClient.newHttpClient(), configuredApiKey(), configuredProfile());
  }

  public OpenRouteServiceClient(HttpClient httpClient, String apiKey, String profile) {
    this.httpClient = httpClient;
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    this.profile = profile == null || profile.isBlank() ? DEFAULT_PROFILE : profile.trim();
  }

  public RouteDirections getDirections(
      double fromLat, double fromLng, double toLat, double toLng) {
    if (apiKey.isBlank()) {
      throw new IllegalStateException("OPENROUTESERVICE_API_KEY is not configured");
    }

    try {
      ObjectNode body = MAPPER.createObjectNode();
      ArrayNode coordinates = body.putArray("coordinates");
      coordinates.addArray().add(fromLng).add(fromLat);
      coordinates.addArray().add(toLng).add(toLat);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(BASE_URL + profile + "/geojson"))
              .timeout(Duration.ofSeconds(8))
              .header("Authorization", apiKey)
              .header("Content-Type", "application/json")
              .header("Accept", "application/json, application/geo+json, application/gpx+xml, */*")
              .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body)))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalStateException(
            "OpenRouteService directions failed with status "
                + response.statusCode()
                + ": "
                + safeBodySnippet(response.body()));
      }

      JsonNode route = MAPPER.readTree(response.body()).path("features").path(0);
      JsonNode summary = route.path("properties").path("summary");
      JsonNode geometry = route.path("geometry").path("coordinates");
      List<List<Double>> routeCoordinates = new ArrayList<>();
      for (JsonNode coordinate : geometry) {
        if (coordinate.size() >= 2) {
          routeCoordinates.add(List.of(coordinate.path(0).asDouble(), coordinate.path(1).asDouble()));
        }
      }

      return new RouteDirections(
          summary.path("distance").asDouble(0),
          summary.path("duration").asDouble(0),
          routeCoordinates);
    } catch (IllegalStateException error) {
      throw error;
    } catch (Exception error) {
      throw new IllegalStateException("OpenRouteService directions failed", error);
    }
  }

  private static String configuredApiKey() {
    String value = System.getenv("OPENROUTESERVICE_API_KEY");
    return value == null ? "" : value;
  }

  private static String configuredProfile() {
    String value = System.getenv("OPENROUTESERVICE_PROFILE");
    return value == null || value.isBlank() ? DEFAULT_PROFILE : value;
  }

  private static String safeBodySnippet(String body) {
    if (body == null || body.isBlank()) {
      return "empty response";
    }
    String compact = body.replaceAll("\\s+", " ").trim();
    return compact.length() <= 300 ? compact : compact.substring(0, 300);
  }
}
