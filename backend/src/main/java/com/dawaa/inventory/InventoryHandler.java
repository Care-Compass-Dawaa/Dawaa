package com.dawaa.inventory;

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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.DeleteItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;

/**
 * Handles inventory CRUD:
 *   GET    /inventory/{pharmacistId}  → list items for a pharmacist
 *   POST   /inventory                 → create or update an item
 *   DELETE /inventory/{id}            → delete an item (body must contain pharmacistId)
 */
public class InventoryHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

  private static final String TABLE = System.getenv("INVENTORY_TABLE");

  private final DynamoDbClient dynamo = DynamoDbClient.builder().build();

  @Override
  public APIGatewayProxyResponseEvent handleRequest(
      APIGatewayProxyRequestEvent req, Context ctx) {

    try {
      String method = req.getHttpMethod();
      String path   = req.getPath() != null ? req.getPath() : "";

      if ("GET".equalsIgnoreCase(method)) {
        // Path: /inventory/{pharmacistId}
        String pharmacistId = pathSegment(path, 2);
        return listItems(pharmacistId);

      } else if ("POST".equalsIgnoreCase(method)) {
        return upsertItem(parseBody(req.getBody()));

      } else if ("DELETE".equalsIgnoreCase(method)) {
        // Path: /inventory/{id}
        String id = pathSegment(path, 2);
        JsonNode body = parseBody(req.getBody());
        String pharmacistId = require(body, "pharmacistId");
        return deleteItem(id, pharmacistId);

      } else {
        return error(405, "Method not allowed");
      }

    } catch (IllegalArgumentException e) {
      return error(400, e.getMessage());
    } catch (Exception e) {
      if (ctx != null) ctx.getLogger().log("InventoryHandler error: " + e);
      return error(500, "Inventory operation failed");
    }
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent listItems(String pharmacistId) {
    if (pharmacistId == null || pharmacistId.isBlank()) {
      return error(400, "pharmacistId is required");
    }

    QueryResponse res = dynamo.query(QueryRequest.builder()
        .tableName(TABLE)
        .indexName("pharmacistId-index")
        .keyConditionExpression("pharmacistId = :p")
        .expressionAttributeValues(Map.of(":p", AttributeValue.fromS(pharmacistId)))
        .build());

    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode items    = wrapper.putArray("items");

    List<Map<String, AttributeValue>> rows = res.items();
    // Sort alphabetically by medicineName
    rows.stream()
        .sorted((a, b) -> a.getOrDefault("medicineName", AttributeValue.fromS("")).s()
            .compareToIgnoreCase(b.getOrDefault("medicineName", AttributeValue.fromS("")).s()))
        .forEach(row -> items.add(toItemNode(row)));

    return ok(wrapper);
  }

  // ─── Upsert ────────────────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent upsertItem(JsonNode body) {
    String pharmacistId  = require(body, "pharmacistId");
    String medicineName  = require(body, "medicineName");
    int    quantity      = Math.max(0, body.path("quantity").asInt(0));
    boolean inStock      = body.path("inStock").asBoolean(true);
    String now           = Instant.now().toString();

    // If an id is provided this is an update, otherwise create
    String id        = body.path("id").asText("").trim();
    String createdAt = now;

    if (!id.isEmpty()) {
      // Fetch existing createdAt to preserve it
      GetItemResponse existing = dynamo.getItem(GetItemRequest.builder()
          .tableName(TABLE)
          .key(Map.of("id", AttributeValue.fromS(id)))
          .projectionExpression("createdAt")
          .build());
      if (existing.hasItem()) {
        createdAt = existing.item()
            .getOrDefault("createdAt", AttributeValue.fromS(now)).s();
      }
    } else {
      id = UUID.randomUUID().toString();
    }

    Map<String, AttributeValue> item = new HashMap<>();
    item.put("id",           AttributeValue.fromS(id));
    item.put("pharmacistId", AttributeValue.fromS(pharmacistId));
    item.put("medicineName", AttributeValue.fromS(medicineName));
    item.put("quantity",     AttributeValue.fromN(String.valueOf(quantity)));
    item.put("inStock",      AttributeValue.fromBool(inStock));
    item.put("createdAt",    AttributeValue.fromS(createdAt));
    item.put("updatedAt",    AttributeValue.fromS(now));

    dynamo.putItem(PutItemRequest.builder().tableName(TABLE).item(item).build());

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    return ok(wrapper);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent deleteItem(String id, String pharmacistId) {
    // Only delete if the item belongs to this pharmacist (ownership check)
    dynamo.deleteItem(DeleteItemRequest.builder()
        .tableName(TABLE)
        .key(Map.of("id", AttributeValue.fromS(id)))
        .conditionExpression("pharmacistId = :p")
        .expressionAttributeValues(Map.of(":p", AttributeValue.fromS(pharmacistId)))
        .build());

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    return ok(wrapper);
  }

  // ─── Mapping helper ────────────────────────────────────────────────────────

  private ObjectNode toItemNode(Map<String, AttributeValue> row) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id",           row.getOrDefault("id",           AttributeValue.fromS("")).s());
    node.put("pharmacistId", row.getOrDefault("pharmacistId", AttributeValue.fromS("")).s());
    node.put("medicineName", row.getOrDefault("medicineName", AttributeValue.fromS("")).s());
    node.put("quantity",     Integer.parseInt(
        row.getOrDefault("quantity", AttributeValue.fromN("0")).n()));
    node.put("inStock",      row.getOrDefault("inStock", AttributeValue.fromBool(true)).bool());
    node.put("createdAt",    row.getOrDefault("createdAt",    AttributeValue.fromS("")).s());
    node.put("updatedAt",    row.getOrDefault("updatedAt",    AttributeValue.fromS("")).s());
    return node;
  }

  /** Extract a path segment by 0-based index from a slash-delimited path. */
  private String pathSegment(String path, int index) {
    String[] parts = path.split("/");
    if (parts.length <= index) return "";
    return parts[index];
  }
}
