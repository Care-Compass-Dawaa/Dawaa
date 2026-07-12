package com.dawaa.pharmacies;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.common.BaseHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;

/**
 * Handles pharmacy registration and management:
 *   POST /pharmacies                            → register a new pharmacy
 *   GET  /pharmacies/mine?pharmacistId={id}     → get the pharmacist's own pharmacy
 *   GET  /admin/pharmacies                      → list all pharmacies (admin)
 *   POST /admin/pharmacies/{id}/approve         → approve or revoke a pharmacy (admin)
 */
public class PharmacyHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

  private static final String TABLE = System.getenv("PHARMACIES_TABLE");

  private final DynamoDbClient dynamo = DynamoDbClient.builder().build();

  @Override
  public APIGatewayProxyResponseEvent handleRequest(
      APIGatewayProxyRequestEvent req, Context ctx) {

    try {
      String method = req.getHttpMethod();
      String path   = req.getPath() != null ? req.getPath() : "";

      // POST /pharmacies → register
      if ("POST".equalsIgnoreCase(method) && path.equals("/pharmacies")) {
        return registerPharmacy(parseBody(req.getBody()));
      }

      // GET /pharmacies/mine → get own pharmacy
      if ("GET".equalsIgnoreCase(method) && path.equals("/pharmacies/mine")) {
        String pharmacistId = queryParam(req, "pharmacistId");
        return getMyPharmacy(pharmacistId);
      }

      // GET /admin/pharmacies → list all
      if ("GET".equalsIgnoreCase(method) && path.equals("/admin/pharmacies")) {
        return listAllPharmacies();
      }

      // POST /admin/pharmacies/{id}/approve → approve/revoke
      if ("POST".equalsIgnoreCase(method) && path.matches("/admin/pharmacies/.+/approve")) {
        String pharmacyId = path.split("/")[3];
        return approvePharmacy(pharmacyId, parseBody(req.getBody()));
      }

      return error(404, "Not found");

    } catch (IllegalArgumentException e) {
      return error(400, e.getMessage());
    } catch (Exception e) {
      if (ctx != null) ctx.getLogger().log("PharmacyHandler error: " + e);
      return error(500, "Pharmacy operation failed");
    }
  }

  // ─── Register ──────────────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent registerPharmacy(JsonNode body) {
    String pharmacistId = require(body, "pharmacistId");
    String name         = require(body, "name");
    String address      = require(body, "address");
    String area         = require(body, "area");
    String phone        = require(body, "phone");

    // Idempotent: if pharmacy already exists for this pharmacist, return it
    QueryResponse existing = queryByPharmacist(pharmacistId);
    if (!existing.items().isEmpty()) {
      ObjectNode wrapper = MAPPER.createObjectNode();
      wrapper.set("pharmacy", toPharmacyNode(existing.items().get(0)));
      return ok(wrapper);
    }

    String id  = UUID.randomUUID().toString();
    String now = Instant.now().toString();

    Map<String, AttributeValue> item = new HashMap<>();
    item.put("id",           AttributeValue.fromS(id));
    item.put("pharmacistId", AttributeValue.fromS(pharmacistId));
    item.put("name",         AttributeValue.fromS(name));
    item.put("address",      AttributeValue.fromS(address));
    item.put("area",         AttributeValue.fromS(area));
    item.put("phone",        AttributeValue.fromS(phone));
    item.put("approved",     AttributeValue.fromBool(false));
    item.put("createdAt",    AttributeValue.fromS(now));

    dynamo.putItem(PutItemRequest.builder().tableName(TABLE).item(item).build());

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set("pharmacy", toPharmacyNode(item));
    return ok(wrapper);
  }

  // ─── Get own pharmacy ──────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent getMyPharmacy(String pharmacistId) {
    if (pharmacistId == null || pharmacistId.isBlank()) {
      return error(400, "pharmacistId is required");
    }

    QueryResponse res = queryByPharmacist(pharmacistId);
    ObjectNode wrapper = MAPPER.createObjectNode();
    if (res.items().isEmpty()) {
      wrapper.putNull("pharmacy");
    } else {
      wrapper.set("pharmacy", toPharmacyNode(res.items().get(0)));
    }
    return ok(wrapper);
  }

  // ─── Admin: list all ───────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent listAllPharmacies() {
    ScanResponse res = dynamo.scan(ScanRequest.builder().tableName(TABLE).build());

    ObjectNode wrapper  = MAPPER.createObjectNode();
    ArrayNode pharmacies = wrapper.putArray("pharmacies");
    res.items().forEach(row -> pharmacies.add(toPharmacyNode(row)));
    return ok(wrapper);
  }

  // ─── Admin: approve / revoke ───────────────────────────────────────────────

  private APIGatewayProxyResponseEvent approvePharmacy(String pharmacyId, JsonNode body) {
    boolean approved = body.path("approved").asBoolean(true);

    dynamo.updateItem(UpdateItemRequest.builder()
        .tableName(TABLE)
        .key(Map.of("id", AttributeValue.fromS(pharmacyId)))
        .updateExpression("SET approved = :a")
        .expressionAttributeValues(Map.of(":a", AttributeValue.fromBool(approved)))
        .conditionExpression("attribute_exists(id)")
        .build());

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    return ok(wrapper);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private QueryResponse queryByPharmacist(String pharmacistId) {
    return dynamo.query(QueryRequest.builder()
        .tableName(TABLE)
        .indexName("pharmacistId-index")
        .keyConditionExpression("pharmacistId = :p")
        .expressionAttributeValues(Map.of(":p", AttributeValue.fromS(pharmacistId)))
        .limit(1)
        .build());
  }

  private ObjectNode toPharmacyNode(Map<String, AttributeValue> row) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id",           row.getOrDefault("id",           AttributeValue.fromS("")).s());
    node.put("pharmacistId", row.getOrDefault("pharmacistId", AttributeValue.fromS("")).s());
    node.put("name",         row.getOrDefault("name",         AttributeValue.fromS("")).s());
    node.put("address",      row.getOrDefault("address",      AttributeValue.fromS("")).s());
    node.put("area",         row.getOrDefault("area",         AttributeValue.fromS("")).s());
    node.put("phone",        row.getOrDefault("phone",        AttributeValue.fromS("")).s());
    node.put("approved",     row.getOrDefault("approved",     AttributeValue.fromBool(false)).bool());
    node.put("createdAt",    row.getOrDefault("createdAt",    AttributeValue.fromS("")).s());
    return node;
  }

  private String queryParam(APIGatewayProxyRequestEvent req, String name) {
    if (req.getQueryStringParameters() == null) return "";
    return req.getQueryStringParameters().getOrDefault(name, "");
  }
}
