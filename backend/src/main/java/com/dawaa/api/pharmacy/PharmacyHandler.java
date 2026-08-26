package com.dawaa.api.pharmacy;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.pharmacy.PharmacyService;
import com.dawaa.business.inventory.InventoryAvailabilityService;
import com.dawaa.business.user.UserService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.inventory.InventoryAvailability;
import com.dawaa.domain.pharmacy.NearbyPharmacy;
import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.domain.user.User;
import com.dawaa.persistence.dynamodb.inventory.DynamoDbInventoryAvailabilityRepository;
import com.dawaa.persistence.dynamodb.pharmacy.DynamoDbPharmacyRepository;
import com.dawaa.persistence.dynamodb.user.DynamoDBUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

public class PharmacyHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private static final String REQUESTER_HEADER = "X-Dawaa-User-Id";
  private static final String ORS_BASE_URL = "https://api.openrouteservice.org/v2/matrix/";
  private static final String ORS_DEFAULT_PROFILE = "driving-car";
  private static final int ORS_MAX_DESTINATIONS = 24;

  private final PharmacyService pharmacyService;
  private final InventoryAvailabilityService inventoryAvailabilityService;
  private final UserService userService;
  private final HttpClient httpClient = HttpClient.newHttpClient();

  public PharmacyHandler() {
    this(
        new PharmacyService(new DynamoDbPharmacyRepository()),
        new InventoryAvailabilityService(new DynamoDbInventoryAvailabilityRepository()),
        new UserService(new DynamoDBUserRepository()));
  }

  public PharmacyHandler(PharmacyService pharmacyService) {
    this(
        pharmacyService,
        new InventoryAvailabilityService(new DynamoDbInventoryAvailabilityRepository()),
        new UserService(new DynamoDBUserRepository()));
  }

  public PharmacyHandler(
      PharmacyService pharmacyService,
      InventoryAvailabilityService inventoryAvailabilityService,
      UserService userService) {
    this.pharmacyService = Objects.requireNonNull(pharmacyService, "pharmacyService is required");
    this.inventoryAvailabilityService =
        Objects.requireNonNull(
            inventoryAvailabilityService, "inventoryAvailabilityService is required");
    this.userService = Objects.requireNonNull(userService, "userService is required");
  }

  @Override
  public APIGatewayProxyResponseEvent handleRequest(
      APIGatewayProxyRequestEvent request, Context context) {
    try {
      String method = request.getHttpMethod();
      String path = request.getPath() != null ? request.getPath() : "";

      if ("OPTIONS".equalsIgnoreCase(method)) {
        return ok(MAPPER.createObjectNode());
      }

      if ("POST".equalsIgnoreCase(method) && path.equals("/pharmacies")) {
        return registerPharmacy(request, parseBody(request.getBody()));
      }

      if ("GET".equalsIgnoreCase(method) && path.equals("/pharmacies/mine")) {
        return getMyPharmacy(request);
      }

      if ("POST".equalsIgnoreCase(method) && path.equals("/pharmacies/mine/update")) {
        return updateMyPharmacy(request, parseBody(request.getBody()));
      }

      if ("GET".equalsIgnoreCase(method) && path.equals("/admin/pharmacies")) {
        return listAllPharmacies(request);
      }

      if ("POST".equalsIgnoreCase(method) && path.matches("/admin/pharmacies/.+/approve")) {
        return approvePharmacy(request, pathSegment(path, 3), parseBody(request.getBody()));
      }

      if ("GET".equalsIgnoreCase(method) && path.matches("/admin/pharmacies/.+")) {
        return getAdminPharmacy(request, pathSegment(path, 3));
      }

      if ("GET".equalsIgnoreCase(method) && path.equals("/pharmacies/nearby")) {
        return nearbyFromQuery(request);
      }

      if ("POST".equalsIgnoreCase(method) && path.equals("/pharmacies/search")) {
        return nearbyFromBody(parseBody(request.getBody()));
      }

      if ("GET".equalsIgnoreCase(method) && path.matches("/pharmacies/.+")) {
        return getPublicPharmacy(pathSegment(path, 2));
      }

      return error(404, "Not found");
    } catch (SecurityException error) {
      return error(403, error.getMessage());
    } catch (NoSuchElementException error) {
      return error(404, error.getMessage());
    } catch (IllegalArgumentException error) {
      return error(400, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log("PharmacyHandler error: " + error);
      }
      return error(500, "Pharmacy operation failed");
    }
  }

  private APIGatewayProxyResponseEvent registerPharmacy(
      APIGatewayProxyRequestEvent request, JsonNode body) {
    User requester = requester(request);
    Pharmacy pharmacy =
        new Pharmacy(
            body.path("pharmacyId").asText(""),
            requester.userId(),
            require(body, "name"),
            require(body, "address"),
            require(body, "area"),
            body.path("district").asText(""),
            require(body, "phone"),
            body.path("email").asText(""),
            body.path("latitude").asDouble(0),
            body.path("longitude").asDouble(0),
            false,
            true,
            "",
            "");

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set("pharmacy", toPharmacyNode(pharmacyService.registerPharmacy(requester, pharmacy)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent getMyPharmacy(APIGatewayProxyRequestEvent request) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    pharmacyService
        .getMyPharmacy(requester(request))
        .ifPresentOrElse(
            pharmacy -> wrapper.set("pharmacy", toPharmacyNode(pharmacy)),
            () -> wrapper.putNull("pharmacy"));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent updateMyPharmacy(
      APIGatewayProxyRequestEvent request, JsonNode body) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set(
        "pharmacy",
        toPharmacyNode(
            pharmacyService.updateMyPharmacy(
                requester(request),
                body.path("email").asText(""),
                require(body, "phone"),
                requiredBodyDouble(body, "latitude"),
                requiredBodyDouble(body, "longitude"))));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent listAllPharmacies(APIGatewayProxyRequestEvent request) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode pharmacies = wrapper.putArray("pharmacies");
    pharmacyService
        .listAllPharmacies(requester(request))
        .forEach(pharmacy -> pharmacies.add(toPharmacyNode(pharmacy)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent getAdminPharmacy(
      APIGatewayProxyRequestEvent request, String pharmacyId) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set(
        "pharmacy", toPharmacyNode(pharmacyService.getAdminPharmacyById(requester(request), pharmacyId)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent getPublicPharmacy(String pharmacyId) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set("pharmacy", toPublicPharmacyNode(pharmacyService.getPublicPharmacyById(pharmacyId)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent approvePharmacy(
      APIGatewayProxyRequestEvent request, String pharmacyId, JsonNode body) {
    boolean approved = body.path("approved").asBoolean(true);
    pharmacyService.setApproval(requester(request), pharmacyId, approved);

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent nearbyFromQuery(APIGatewayProxyRequestEvent request) {
    double lat = requiredDouble(queryParam(request, "lat"), "lat");
    double lng = requiredDouble(queryParam(request, "lng"), "lng");
    int radius = optionalInt(queryParam(request, "radius"), 5_000);
    int limit = optionalInt(queryParam(request, "limit"), 10);
    return nearbyResponse(pharmacyService.findNearbyPharmacies(lat, lng, radius, limit));
  }

  private APIGatewayProxyResponseEvent nearbyFromBody(JsonNode body) {
    if (!body.path("lat").isNumber() || !body.path("lng").isNumber()) {
      throw new IllegalArgumentException("lat and lng are required");
    }

    int radius = body.path("radius").asInt(5_000);
    int limit = body.path("limit").asInt(10);
    String medicineId = body.path("medicineId").asText("");
    if (medicineId == null || medicineId.isBlank()) {
      return nearbyResponse(
          pharmacyService.findNearbyPharmacies(
              body.path("lat").asDouble(), body.path("lng").asDouble(), radius, limit));
    }

    List<InventoryAvailability> availability =
        inventoryAvailabilityService.findAvailableInventoryByMedicineId(medicineId);
    Map<String, InventoryAvailability> availabilityByPharmacy =
        availability.stream()
            .filter(item -> item.pharmacyId() != null && !item.pharmacyId().isBlank())
            .collect(
                Collectors.toMap(
                    InventoryAvailability::pharmacyId,
                    Function.identity(),
                    (first, second) -> first.quantity() >= second.quantity() ? first : second));
    Set<String> stockedPharmacyIds = availabilityByPharmacy.keySet();

    double lat = body.path("lat").asDouble();
    double lng = body.path("lng").asDouble();
    List<NearbyPharmacy> nearbyPharmacies =
        pharmacyService.findNearbyPharmacies(lat, lng, radius, limit, stockedPharmacyIds);

    return nearbyResponse(
        rankByRouteIfConfigured(lat, lng, nearbyPharmacies),
        availabilityByPharmacy);
  }

  private APIGatewayProxyResponseEvent nearbyResponse(List<NearbyPharmacy> nearbyPharmacies) {
    return nearbyResponse(nearbyPharmacies, Map.of());
  }

  private APIGatewayProxyResponseEvent nearbyResponse(
      List<NearbyPharmacy> nearbyPharmacies,
      Map<String, InventoryAvailability> availabilityByPharmacy) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode pharmacies = wrapper.putArray("pharmacies");
    nearbyPharmacies.forEach(
        result ->
            pharmacies.add(
                toNearbyPharmacyNode(
                    result,
                    availabilityByPharmacy.get(result.pharmacy().pharmacyId()))));
    if (!nearbyPharmacies.isEmpty()) {
      NearbyPharmacy nearest = nearbyPharmacies.get(0);
      wrapper.set(
          "nearestPharmacy",
          toNearbyPharmacyNode(
              nearest,
              availabilityByPharmacy.get(nearest.pharmacy().pharmacyId())));
    } else {
      wrapper.putNull("nearestPharmacy");
    }
    return ok(wrapper);
  }

  private ObjectNode toNearbyPharmacyNode(NearbyPharmacy nearbyPharmacy) {
    return toNearbyPharmacyNode(nearbyPharmacy, null);
  }

  private ObjectNode toNearbyPharmacyNode(
      NearbyPharmacy nearbyPharmacy, InventoryAvailability availability) {
    ObjectNode node = toPublicPharmacyNode(nearbyPharmacy.pharmacy());
    node.put("distanceMeters", nearbyPharmacy.distanceMeters());
    if (availability != null) {
      node.put("hasAvailabilityData", true);
      node.put("availableQuantity", availability.quantity());
      node.put("availabilityUpdatedAt", availability.updatedAt());
    }
    return node;
  }

  private List<NearbyPharmacy> rankByRouteIfConfigured(
      double sourceLat, double sourceLng, List<NearbyPharmacy> nearbyPharmacies) {
    String apiKey = System.getenv("OPENROUTESERVICE_API_KEY");
    if (apiKey == null || apiKey.isBlank() || nearbyPharmacies.isEmpty()) {
      return nearbyPharmacies;
    }

    try {
      List<NearbyPharmacy> candidates =
          nearbyPharmacies.stream().limit(ORS_MAX_DESTINATIONS).toList();
      ObjectNode requestBody = MAPPER.createObjectNode();
      ArrayNode locations = requestBody.putArray("locations");
      locations.addArray().add(sourceLng).add(sourceLat);
      for (NearbyPharmacy nearbyPharmacy : candidates) {
        locations
            .addArray()
            .add(nearbyPharmacy.pharmacy().longitude())
            .add(nearbyPharmacy.pharmacy().latitude());
      }

      requestBody.putArray("sources").add("0");
      ArrayNode destinations = requestBody.putArray("destinations");
      for (int index = 1; index <= candidates.size(); index++) {
        destinations.add(Integer.toString(index));
      }
      requestBody.putArray("metrics").add("distance").add("duration");
      requestBody.put("units", "m");

      String profile = configuredRouteProfile();
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(ORS_BASE_URL + profile))
              .timeout(Duration.ofSeconds(5))
              .header("Authorization", apiKey)
              .header("Content-Type", "application/json")
              .header("Accept", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(requestBody)))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        return nearbyPharmacies;
      }

      JsonNode routeResponse = MAPPER.readTree(response.body());
      JsonNode durations = routeResponse.path("durations").path(0);
      JsonNode distances = routeResponse.path("distances").path(0);
      List<NearbyPharmacy> ranked = new ArrayList<>();
      for (int index = 0; index < candidates.size(); index++) {
        NearbyPharmacy original = candidates.get(index);
        JsonNode duration = durations.path(index);
        JsonNode distance = distances.path(index);
        if (duration.isNumber()) {
          Pharmacy pharmacy = original.pharmacy();
          ranked.add(
              new NearbyPharmacy(
                  new Pharmacy(
                      pharmacy.pharmacyId(),
                      pharmacy.ownerUserId(),
                      pharmacy.name(),
                      pharmacy.address(),
                      pharmacy.area(),
                      pharmacy.district(),
                      pharmacy.phone(),
                      pharmacy.email(),
                      pharmacy.latitude(),
                      pharmacy.longitude(),
                      pharmacy.approved(),
                      pharmacy.active(),
                      pharmacy.createdAt(),
                      pharmacy.updatedAt()),
                  Math.round(distance.isNumber() ? distance.asDouble() : original.distanceMeters())));
        } else {
          ranked.add(original);
        }
      }
      return ranked.stream().sorted(Comparator.comparingLong(NearbyPharmacy::distanceMeters)).toList();
    } catch (Exception error) {
      return nearbyPharmacies;
    }
  }

  private String configuredRouteProfile() {
    String profile = System.getenv("OPENROUTESERVICE_PROFILE");
    return profile == null || profile.isBlank() ? ORS_DEFAULT_PROFILE : profile.trim();
  }

  private ObjectNode toPublicPharmacyNode(Pharmacy pharmacy) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id", pharmacy.pharmacyId());
    node.put("pharmacyId", pharmacy.pharmacyId());
    node.put("name", pharmacy.name());
    node.put("address", pharmacy.address());
    node.put("area", pharmacy.area());
    node.put("district", pharmacy.district());
    node.put("phone", pharmacy.phone());
    node.put("email", pharmacy.email());
    node.putObject("location").put("lat", pharmacy.latitude()).put("lng", pharmacy.longitude());
    node.put("latitude", pharmacy.latitude());
    node.put("longitude", pharmacy.longitude());
    return node;
  }

  private ObjectNode toPharmacyNode(Pharmacy pharmacy) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id", pharmacy.pharmacyId());
    node.put("pharmacyId", pharmacy.pharmacyId());
    node.put("ownerUserId", pharmacy.ownerUserId());
    node.put("name", pharmacy.name());
    node.put("address", pharmacy.address());
    node.put("area", pharmacy.area());
    node.put("district", pharmacy.district());
    node.put("phone", pharmacy.phone());
    node.put("email", pharmacy.email());
    node.putObject("location").put("lat", pharmacy.latitude()).put("lng", pharmacy.longitude());
    node.put("latitude", pharmacy.latitude());
    node.put("longitude", pharmacy.longitude());
    node.put("approved", pharmacy.approved());
    node.put("active", pharmacy.active());
    node.put("createdAt", pharmacy.createdAt());
    node.put("updatedAt", pharmacy.updatedAt());
    return node;
  }

  private User requester(APIGatewayProxyRequestEvent request) {
    return userService.getRequester(header(request, REQUESTER_HEADER));
  }

  private String header(APIGatewayProxyRequestEvent request, String name) {
    if (request == null || request.getHeaders() == null) {
      return "";
    }

    return request.getHeaders().entrySet().stream()
        .filter(entry -> entry.getKey() != null && entry.getKey().equalsIgnoreCase(name))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse("");
  }

  private String pathSegment(String path, int index) {
    String[] parts = path.split("/");
    if (parts.length <= index) {
      throw new IllegalArgumentException("path is missing required id");
    }
    return URLDecoder.decode(parts[index], StandardCharsets.UTF_8);
  }

  private String queryParam(APIGatewayProxyRequestEvent request, String name) {
    if (request == null) {
      return "";
    }
    Map<String, String> params = request.getQueryStringParameters();
    if (params == null) {
      return "";
    }
    return params.getOrDefault(name, "");
  }

  private double requiredDouble(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return Double.parseDouble(value);
  }

  private double requiredBodyDouble(JsonNode body, String name) {
    if (!body.path(name).isNumber()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return body.path(name).asDouble();
  }

  private int optionalInt(String value, int defaultValue) {
    if (value == null || value.isBlank()) {
      return defaultValue;
    }
    return Integer.parseInt(value);
  }
}
