package com.dawaa.api.medicine;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.medicine.MedicineService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.medicine.Medicine;
import com.dawaa.persistence.dynamodb.medicine.DynamoDbMedicineRepository;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public class MedicineLookupHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private final MedicineService medicineService;

  public MedicineLookupHandler() {
    this(new MedicineService(new DynamoDbMedicineRepository()));
  }

  public MedicineLookupHandler(MedicineService medicineService) {
    this.medicineService = Objects.requireNonNull(medicineService, "medicineService is required");
  }

  @Override
  public APIGatewayProxyResponseEvent handleRequest(
      APIGatewayProxyRequestEvent request, Context context) {
    try {
      if (isSuggestionsRequest(request)) {
        return suggestions(request);
      }

      String name = queryParam(request, "name");
      if (name == null || name.isBlank()) {
        return error(400, "name is required");
      }

      Optional<Medicine> medicine = medicineService.findActiveMedicineByName(name);
      List<Medicine> medicines = medicineService.suggestActiveMedicinesByName(name, limit(request, 50));
      if (medicine.isPresent()
          && medicines.stream().noneMatch((item) -> item.medicineId().equals(medicine.get().medicineId()))) {
        medicines = new java.util.ArrayList<>(medicines);
        medicines.add(0, medicine.get());
      }

      if (medicine.isEmpty() && medicines.isEmpty()) {
        return error(404, "Active medicine not found");
      }

      ObjectNode wrapper = MAPPER.createObjectNode();
      Medicine primaryMedicine = medicine.orElse(medicines.get(0));
      wrapper.set("medicine", toMedicineNode(primaryMedicine));
      ArrayNode matches = wrapper.putArray("medicines");
      for (Medicine match : medicines) {
        matches.add(toMedicineNode(match));
      }
      return ok(wrapper);
    } catch (IllegalArgumentException error) {
      return error(400, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log("MedicineLookupHandler error: " + error);
      }
      return error(500, "Medicine lookup failed");
    }
  }

  private APIGatewayProxyResponseEvent suggestions(APIGatewayProxyRequestEvent request) {
    String query = queryParam(request, "q");
    if (query == null || query.isBlank()) {
      query = queryParam(request, "name");
    }
    if (query == null || query.isBlank()) {
      return error(400, "q is required");
    }

    List<Medicine> medicines = medicineService.suggestActiveMedicinesByName(query, limit(request, 8));
    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode suggestions = wrapper.putArray("suggestions");
    for (Medicine medicine : medicines) {
      suggestions.add(toMedicineNode(medicine));
    }
    return ok(wrapper);
  }

  private boolean isSuggestionsRequest(APIGatewayProxyRequestEvent request) {
    if (request == null || request.getPath() == null) {
      return false;
    }
    return request.getPath().endsWith("/medicines/suggestions");
  }

  private int limit(APIGatewayProxyRequestEvent request, int defaultLimit) {
    try {
      return Math.min(Math.max(Integer.parseInt(queryParam(request, "limit")), 1), 100);
    } catch (NumberFormatException error) {
      return defaultLimit;
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

  private ObjectNode toMedicineNode(Medicine medicine) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("medicineId", medicine.medicineId());
    node.put("brandName", medicine.brandName());
    node.put("genericName", medicine.genericName());
    node.put("strength", medicine.strength());
    node.put("dosageForm", medicine.dosageForm());
    node.put("manufacturer", medicine.manufacturer());
    node.put("normalizedBrandName", medicine.normalizedBrandName());
    node.put("normalizedGenericName", medicine.normalizedGenericName());
    node.put("active", medicine.active());
    return node;
  }
}
