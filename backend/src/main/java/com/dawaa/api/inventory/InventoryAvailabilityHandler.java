package com.dawaa.api.inventory;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.inventory.InventoryAvailabilityService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.inventory.InventoryAvailability;
import com.dawaa.persistence.dynamodb.inventory.DynamoDbInventoryAvailabilityRepository;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public class InventoryAvailabilityHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private final InventoryAvailabilityService inventoryAvailabilityService;

  public InventoryAvailabilityHandler() {
    this(new InventoryAvailabilityService(new DynamoDbInventoryAvailabilityRepository()));
  }

  public InventoryAvailabilityHandler(
      InventoryAvailabilityService inventoryAvailabilityService) {
    this.inventoryAvailabilityService =
        Objects.requireNonNull(
            inventoryAvailabilityService, "inventoryAvailabilityService is required");
  }

  @Override
  public APIGatewayProxyResponseEvent handleRequest(
      APIGatewayProxyRequestEvent request, Context context) {
    try {
      String medicineId = queryParam(request, "medicineId");
      if (medicineId == null || medicineId.isBlank()) {
        return error(400, "medicineId is required");
      }

      List<InventoryAvailability> availability =
          inventoryAvailabilityService.findAvailableInventoryByMedicineId(medicineId);

      ObjectNode wrapper = MAPPER.createObjectNode();
      ArrayNode items = wrapper.putArray("availability");
      availability.forEach(item -> items.add(toAvailabilityNode(item)));
      return ok(wrapper);
    } catch (IllegalArgumentException error) {
      return error(400, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log("InventoryAvailabilityHandler error: " + error);
      }
      return error(500, "Inventory availability lookup failed");
    }
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

  private ObjectNode toAvailabilityNode(InventoryAvailability availability) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("pharmacyId", availability.pharmacyId());
    node.put("medicineId", availability.medicineId());
    node.put("availableMedicineId", availability.availableMedicineId());
    node.put("availableLocationKey", availability.availableLocationKey());
    node.put("quantity", availability.quantity());
    node.put("inStock", availability.inStock());
    node.put("updatedAt", availability.updatedAt());
    node.put("version", availability.version());
    return node;
  }
}
