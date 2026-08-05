package com.dawaa.auth;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.common.BaseHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;

/**
 * Handles POST /auth/register and POST /auth/login.
 *
 * Routes are distinguished by the "action" path parameter set in template.yaml:
 *   /auth/register → action = "register"
 *   /auth/login    → action = "login"
 */
public class AuthHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

  private static final String TABLE = System.getenv("USERS_TABLE");
  private static final String SALT  = "dawaa_salt_2024";

  private final DynamoDbClient dynamo = DynamoDbClient.builder().build();

  @Override
  public APIGatewayProxyResponseEvent handleRequest(
      APIGatewayProxyRequestEvent req, Context ctx) {

    try {
      // Determine register vs login from the path
      String path = req.getPath() != null ? req.getPath() : "";
      if (path.endsWith("/register")) {
        return register(parseBody(req.getBody()));
      } else if (path.endsWith("/login")) {
        return login(parseBody(req.getBody()));
      } else if ("GET".equalsIgnoreCase(req.getHttpMethod()) && path.equals("/admin/users")) {
        return listUsers();
      } else {
        return error(404, "Not found");
      }
    } catch (IllegalArgumentException e) {
      return error(400, e.getMessage());
    } catch (Exception e) {
      if (ctx != null) ctx.getLogger().log("AuthHandler error: " + e);
      return error(500, "Authentication failed");
    }
  }

  // ─── Register ──────────────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent register(JsonNode body) {
    String email    = require(body, "email").toLowerCase();
    String password = require(body, "password");
    String name     = require(body, "name");
    String role     = body.path("role").asText("patient");
    if (!role.equals("patient") && !role.equals("pharmacist")) role = "patient";

    // Check duplicate email via GSI
    if (emailExists(email)) {
      return error(409, "An account with this email already exists");
    }

    String id  = UUID.randomUUID().toString();
    String now = Instant.now().toString();

    dynamo.putItem(PutItemRequest.builder()
        .tableName(TABLE)
        .item(Map.of(
            "id",           AttributeValue.fromS(id),
            "email",        AttributeValue.fromS(email),
            "name",         AttributeValue.fromS(name),
            "role",         AttributeValue.fromS(role),
            "passwordHash", AttributeValue.fromS(hash(password)),
            "createdAt",    AttributeValue.fromS(now)
        ))
        .conditionExpression("attribute_not_exists(id)") // safety guard
        .build());

    return ok(userNode(id, email, name, role, now));
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  private APIGatewayProxyResponseEvent login(JsonNode body) {
    String email    = require(body, "email").toLowerCase();
    String password = require(body, "password");

    // Look up by email GSI
    QueryResponse res = dynamo.query(QueryRequest.builder()
        .tableName(TABLE)
        .indexName("email-index")
        .keyConditionExpression("email = :e")
        .expressionAttributeValues(Map.of(":e", AttributeValue.fromS(email)))
        .limit(1)
        .build());

    if (res.items().isEmpty()) {
      return error(401, "Invalid email or password");
    }

    Map<String, AttributeValue> item = res.items().get(0);
    String storedHash = item.getOrDefault("passwordHash", AttributeValue.fromS("")).s();

    if (!storedHash.equals(hash(password))) {
      return error(401, "Invalid email or password");
    }

    return ok(userNode(
        item.get("id").s(),
        item.get("email").s(),
        item.getOrDefault("name", AttributeValue.fromS("")).s(),
        item.getOrDefault("role", AttributeValue.fromS("patient")).s(),
        item.getOrDefault("createdAt", AttributeValue.fromS("")).s()
    ));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private boolean emailExists(String email) {
    QueryResponse res = dynamo.query(QueryRequest.builder()
        .tableName(TABLE)
        .indexName("email-index")
        .keyConditionExpression("email = :e")
        .expressionAttributeValues(Map.of(":e", AttributeValue.fromS(email)))
        .limit(1)
        .build());
    return !res.items().isEmpty();
  }

  private APIGatewayProxyResponseEvent listUsers() {
    ScanResponse res = dynamo.scan(ScanRequest.builder().tableName(TABLE).build());

    ObjectNode wrapper = MAPPER.createObjectNode();
    var users = wrapper.putArray("users");
    res.items().stream()
        .filter(item -> !"admin".equals(item.getOrDefault("role", AttributeValue.fromS("")).s()))
        .forEach(item -> users.add(userOnlyNode(item)));

    return ok(wrapper);
  }

  private ObjectNode userNode(String id, String email, String name, String role, String createdAt) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    ObjectNode user    = wrapper.putObject("user");
    user.put("id",        id);
    user.put("email",     email);
    user.put("name",      name);
    user.put("role",      role);
    user.put("createdAt", createdAt);
    return wrapper;
  }

  private ObjectNode userOnlyNode(Map<String, AttributeValue> item) {
    ObjectNode user = MAPPER.createObjectNode();
    user.put("id", item.getOrDefault("id", AttributeValue.fromS("")).s());
    user.put("email", item.getOrDefault("email", AttributeValue.fromS("")).s());
    user.put("name", item.getOrDefault("name", AttributeValue.fromS("")).s());
    user.put("role", item.getOrDefault("role", AttributeValue.fromS("patient")).s());
    user.put("createdAt", item.getOrDefault("createdAt", AttributeValue.fromS("")).s());
    return user;
  }

  private String hash(String password) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest((password + SALT).getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(bytes);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }
}
