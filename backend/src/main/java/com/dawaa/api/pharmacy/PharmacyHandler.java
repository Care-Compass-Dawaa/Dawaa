package com.dawaa.api.pharmacy;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.pharmacy.PharmacyService;
import com.dawaa.business.user.UserService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.pharmacy.NearbyPharmacy;
import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.domain.user.User;
import com.dawaa.persistence.dynamodb.pharmacy.DynamoDbPharmacyRepository;
import com.dawaa.persistence.dynamodb.user.DynamoDBUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;

public class PharmacyHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private static final String REQUESTER_HEADER = "X-Dawaa-User-Id";

  private final PharmacyService pharmacyService;
  private final UserService userService;

  public PharmacyHandler() {
    this(
        new PharmacyService(new DynamoDbPharmacyRepository()),
        new UserService(new DynamoDBUserRepository()));
  }

  public PharmacyHandler(PharmacyService pharmacyService) {
    this(pharmacyService, new UserService(new DynamoDBUserRepository()));
  }

  public PharmacyHandler(PharmacyService pharmacyService, UserService userService) {
    this.pharmacyService = Objects.requireNonNull(pharmacyService, "pharmacyService is required");
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
    return nearbyResponse(
        pharmacyService.findNearbyPharmacies(
            body.path("lat").asDouble(), body.path("lng").asDouble(), radius, limit));
  }

  private APIGatewayProxyResponseEvent nearbyResponse(List<NearbyPharmacy> nearbyPharmacies) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode pharmacies = wrapper.putArray("pharmacies");
    nearbyPharmacies.forEach(result -> pharmacies.add(toNearbyPharmacyNode(result)));
    if (!nearbyPharmacies.isEmpty()) {
      wrapper.set("nearestPharmacy", toNearbyPharmacyNode(nearbyPharmacies.get(0)));
    } else {
      wrapper.putNull("nearestPharmacy");
    }
    return ok(wrapper);
  }

  private ObjectNode toNearbyPharmacyNode(NearbyPharmacy nearbyPharmacy) {
    ObjectNode node = toPublicPharmacyNode(nearbyPharmacy.pharmacy());
    node.put("distanceMeters", nearbyPharmacy.distanceMeters());
    return node;
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

  private int optionalInt(String value, int defaultValue) {
    if (value == null || value.isBlank()) {
      return defaultValue;
    }
    return Integer.parseInt(value);
  }
}
