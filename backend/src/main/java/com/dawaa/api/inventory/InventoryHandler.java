package com.dawaa.api.inventory;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.inventory.InventoryService;
import com.dawaa.business.user.UserService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.inventory.InventoryItem;
import com.dawaa.domain.user.User;
import com.dawaa.persistence.dynamodb.inventory.DynamoDbInventoryRepository;
import com.dawaa.persistence.dynamodb.medicine.DynamoDbMedicineRepository;
import com.dawaa.persistence.dynamodb.pharmacy.DynamoDbPharmacyRepository;
import com.dawaa.persistence.dynamodb.user.DynamoDBUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;

/** Handles pharmacist-owned inventory CRUD routes. */
public class InventoryHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private static final String REQUESTER_HEADER = "X-Dawaa-User-Id";

  private final InventoryService inventoryService;
  private final UserService userService;

  public InventoryHandler() {
    this(
        new InventoryService(
            new DynamoDbInventoryRepository(),
            new DynamoDbPharmacyRepository(),
            new DynamoDbMedicineRepository()),
        new UserService(new DynamoDBUserRepository()));
  }

  public InventoryHandler(InventoryService inventoryService, UserService userService) {
    this.inventoryService =
        Objects.requireNonNull(inventoryService, "inventoryService is required");
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

      if ("GET".equalsIgnoreCase(method) && path.matches("/inventory/.+")) {
        return listInventory(request, pathSegment(path, 2));
      }

      if ("POST".equalsIgnoreCase(method) && path.equals("/inventory")) {
        return upsertInventoryItem(request, parseBody(request.getBody()));
      }

      if ("DELETE".equalsIgnoreCase(method) && path.matches("/inventory/.+")) {
        return deleteInventoryItem(request, pathSegment(path, 2), parseBody(request.getBody()));
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
        context.getLogger().log("InventoryHandler error: " + error);
      }
      return error(500, "Inventory operation failed");
    }
  }

  private APIGatewayProxyResponseEvent listInventory(
      APIGatewayProxyRequestEvent request, String pathRequesterId) {
    User requester = requester(request);
    requireSameRequester(requester, pathRequesterId);

    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode items = wrapper.putArray("items");
    inventoryService.listMyInventory(requester).forEach(item -> items.add(toItemNode(item)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent upsertInventoryItem(
      APIGatewayProxyRequestEvent request, JsonNode body) {
    User requester = requester(request);
    requireSameRequester(requester, body.path("pharmacistId").asText(""));

    InventoryItem saved =
        inventoryService.upsertMyInventoryItem(
            requester,
            body.path("id").asText(""),
            require(body, "medicineName"),
            Math.max(0, body.path("quantity").asInt(0)),
            body.path("inStock").asBoolean(true));

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    wrapper.set("item", toItemNode(saved));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent deleteInventoryItem(
      APIGatewayProxyRequestEvent request, String medicineId, JsonNode body) {
    User requester = requester(request);
    requireSameRequester(requester, body.path("pharmacistId").asText(""));
    inventoryService.deleteMyInventoryItem(requester, medicineId);

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    return ok(wrapper);
  }

  private User requester(APIGatewayProxyRequestEvent request) {
    return userService.getRequester(header(request, REQUESTER_HEADER));
  }

  private void requireSameRequester(User requester, String claimedRequesterId) {
    if (claimedRequesterId == null || claimedRequesterId.isBlank()) {
      throw new IllegalArgumentException("pharmacistId is required");
    }
    if (!requester.userId().equals(claimedRequesterId.trim())) {
      throw new SecurityException("You can only manage your own inventory");
    }
  }

  private ObjectNode toItemNode(InventoryItem item) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id", item.medicineId());
    node.put("pharmacyId", item.pharmacyId());
    node.put("medicineId", item.medicineId());
    node.put("medicineName", item.medicineName());
    node.put("availableMedicineId", item.availableMedicineId());
    node.put("availableLocationKey", item.availableLocationKey());
    node.put("quantity", item.quantity());
    node.put("inStock", item.inStock());
    node.put("createdAt", item.createdAt());
    node.put("updatedAt", item.updatedAt());
    node.put("version", item.version());
    return node;
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
}
