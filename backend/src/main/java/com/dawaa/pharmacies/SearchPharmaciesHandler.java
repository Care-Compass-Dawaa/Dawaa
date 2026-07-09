package com.dawaa.pharmacies;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

public class SearchPharmaciesHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby";
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

  @Override
  public APIGatewayProxyResponseEvent handleRequest(
      APIGatewayProxyRequestEvent request, Context context) {
    try {
      SearchInput input = parseInput(request.getBody());
      JsonNode placesResponse = searchGooglePlaces(input);
      ObjectNode body = MAPPER.createObjectNode();
      ArrayNode pharmacies = body.putArray("pharmacies");

      for (JsonNode place : placesResponse.path("places")) {
        pharmacies.add(toPharmacy(place, input));
      }

      return jsonResponse(200, body);
    } catch (IllegalArgumentException error) {
      return errorResponse(400, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log(error.toString());
      }
      return errorResponse(500, "Pharmacy search failed");
    }
  }

  private SearchInput parseInput(String body) throws IOException {
    if (body == null || body.isBlank()) {
      throw new IllegalArgumentException("Request body is required");
    }

    JsonNode json = MAPPER.readTree(body);
    if (!json.path("lat").isNumber() || !json.path("lng").isNumber()) {
      throw new IllegalArgumentException("lat and lng are required");
    }

    double lat = json.path("lat").asDouble();
    double lng = json.path("lng").asDouble();
    int radius = Math.min(Math.max(json.path("radius").asInt(5000), 500), 50000);
    String keyword = json.path("keyword").asText("");
    return new SearchInput(lat, lng, radius, keyword);
  }

  private JsonNode searchGooglePlaces(SearchInput input) throws IOException, InterruptedException {
    String apiKey = System.getenv("GOOGLE_MAPS_API_KEY");
    if (apiKey == null || apiKey.isBlank()) {
      throw new IllegalStateException("GOOGLE_MAPS_API_KEY is not configured");
    }

    ObjectNode body = MAPPER.createObjectNode();
    body.putArray("includedTypes").add("pharmacy");
    body.put("maxResultCount", 20);
    body.put("rankPreference", "DISTANCE");
    ObjectNode circle =
        body.putObject("locationRestriction")
            .putObject("circle");
    circle.putObject("center").put("latitude", input.lat()).put("longitude", input.lng());
    circle.put("radius", input.radius());

    HttpRequest request =
        HttpRequest.newBuilder(URI.create(PLACES_URL))
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/json")
            .header("X-Goog-Api-Key", apiKey)
            .header(
                "X-Goog-FieldMask",
                "places.id,places.displayName,places.formattedAddress,places.location,"
                    + "places.rating,places.userRatingCount,places.currentOpeningHours.openNow,"
                    + "places.nationalPhoneNumber,places.websiteUri")
            .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body)))
            .build();

    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException("Places API error " + response.statusCode());
    }
    return MAPPER.readTree(response.body());
  }

  private ObjectNode toPharmacy(JsonNode place, SearchInput input) {
    JsonNode location = place.path("location");
    double lat = location.path("latitude").asDouble();
    double lng = location.path("longitude").asDouble();

    ObjectNode pharmacy = MAPPER.createObjectNode();
    pharmacy.put("id", place.path("id").asText());
    pharmacy.put("name", place.path("displayName").path("text").asText("Pharmacy"));
    pharmacy.put("address", place.path("formattedAddress").asText(""));
    pharmacy.putObject("location").put("lat", lat).put("lng", lng);
    putIfPresent(pharmacy, "rating", place.path("rating"));
    putIfPresent(pharmacy, "userRatingCount", place.path("userRatingCount"));
    putIfPresent(pharmacy, "openNow", place.path("currentOpeningHours").path("openNow"));
    putIfPresent(pharmacy, "phone", place.path("nationalPhoneNumber"));
    putIfPresent(pharmacy, "websiteUri", place.path("websiteUri"));
    pharmacy.put("distanceMeters", Math.round(haversine(input.lat(), input.lng(), lat, lng)));
    return pharmacy;
  }

  private void putIfPresent(ObjectNode target, String field, JsonNode value) {
    if (value == null || value.isMissingNode() || value.isNull()) {
      return;
    }
    target.set(field, value);
  }

  private double haversine(double latA, double lngA, double latB, double lngB) {
    double radius = 6_371_000;
    double dLat = Math.toRadians(latB - latA);
    double dLng = Math.toRadians(lngB - lngA);
    double a =
        Math.pow(Math.sin(dLat / 2), 2)
            + Math.cos(Math.toRadians(latA))
                * Math.cos(Math.toRadians(latB))
                * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * radius * Math.asin(Math.sqrt(a));
  }

  private APIGatewayProxyResponseEvent jsonResponse(int statusCode, JsonNode body) {
    try {
      return baseResponse(statusCode).withBody(MAPPER.writeValueAsString(body));
    } catch (IOException error) {
      return errorResponse(500, "Could not serialize response");
    }
  }

  private APIGatewayProxyResponseEvent errorResponse(int statusCode, String message) {
    ObjectNode body = MAPPER.createObjectNode();
    body.put("message", message);
    return jsonResponse(statusCode, body);
  }

  private APIGatewayProxyResponseEvent baseResponse(int statusCode) {
    return new APIGatewayProxyResponseEvent()
        .withStatusCode(statusCode)
        .withHeaders(
            Map.of(
                "Content-Type", "application/json",
                "Access-Control-Allow-Origin", "*",
                "Access-Control-Allow-Headers", "Content-Type",
                "Access-Control-Allow-Methods", "POST,OPTIONS"));
  }

  private record SearchInput(double lat, double lng, int radius, String keyword) {}
}
