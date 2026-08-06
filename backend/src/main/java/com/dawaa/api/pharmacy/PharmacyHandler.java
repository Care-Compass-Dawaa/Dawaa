package com.dawaa.api.pharmacy;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.pharmacy.PharmacyService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.pharmacy.NearbyPharmacy;
import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.persistence.dynamodb.pharmacy.DynamoDbPharmacyRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public class PharmacyHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private final PharmacyService pharmacyService;

  public PharmacyHandler() {
    this(new PharmacyService(new DynamoDbPharmacyRepository()));
  }

  public PharmacyHandler(PharmacyService pharmacyService) {
    this.pharmacyService = Objects.requireNonNull(pharmacyService, "pharmacyService is required");
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
        return registerPharmacy(parseBody(request.getBody()));
      }

      if ("GET".equalsIgnoreCase(method) && path.equals("/pharmacies/mine")) {
        return getMyPharmacy(queryParam(request, "pharmacistId"));
      }

      if ("GET".equalsIgnoreCase(method) && path.equals("/admin/pharmacies")) {
        return listAllPharmacies();
      }

      if ("POST".equalsIgnoreCase(method) && path.matches("/admin/pharmacies/.+/approve")) {
        String pharmacyId = URLDecoder.decode(path.split("/")[3], StandardCharsets.UTF_8);
        return approvePharmacy(pharmacyId, parseBody(request.getBody()));
      }

      if ("GET".equalsIgnoreCase(method) && path.equals("/pharmacies/nearby")) {
        return nearbyFromQuery(request);
      }

      if ("POST".equalsIgnoreCase(method) && path.equals("/pharmacies/search")) {
        return nearbyFromBody(parseBody(request.getBody()));
      }

      return error(404, "Not found");
    } catch (IllegalArgumentException error) {
      return error(400, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log("PharmacyHandler error: " + error);
      }
      return error(500, "Pharmacy operation failed");
    }
  }

  private APIGatewayProxyResponseEvent registerPharmacy(JsonNode body) {
    Pharmacy pharmacy =
        new Pharmacy(
            body.path("pharmacyId").asText(""),
            require(body, "pharmacistId"),
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
    wrapper.set("pharmacy", toPharmacyNode(pharmacyService.registerPharmacy(pharmacy)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent getMyPharmacy(String pharmacistId) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    pharmacyService
        .findByPharmacistId(pharmacistId)
        .ifPresentOrElse(
            pharmacy -> wrapper.set("pharmacy", toPharmacyNode(pharmacy)),
            () -> wrapper.putNull("pharmacy"));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent listAllPharmacies() {
    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode pharmacies = wrapper.putArray("pharmacies");
    pharmacyService.listAllPharmacies().forEach(pharmacy -> pharmacies.add(toPharmacyNode(pharmacy)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent approvePharmacy(String pharmacyId, JsonNode body) {
    boolean approved = body.path("approved").asBoolean(true);
    pharmacyService.setApproval(pharmacyId, approved);

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
    ObjectNode node = toPharmacyNode(nearbyPharmacy.pharmacy());
    node.put("distanceMeters", nearbyPharmacy.distanceMeters());
    return node;
  }

  private ObjectNode toPharmacyNode(Pharmacy pharmacy) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id", pharmacy.pharmacyId());
    node.put("pharmacyId", pharmacy.pharmacyId());
    node.put("pharmacistId", pharmacy.pharmacistId());
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
