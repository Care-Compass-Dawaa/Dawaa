package com.dawaa.common;

import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.Map;

/**
 * Shared helpers used by every Lambda handler: JSON serialisation,
 * standard HTTP responses, and CORS headers.
 */
public abstract class BaseHandler {

  protected static final ObjectMapper MAPPER = new ObjectMapper();

  // ─── Response helpers ──────────────────────────────────────────────────────

  protected APIGatewayProxyResponseEvent ok(Object body) {
    try {
      return base(200).withBody(MAPPER.writeValueAsString(body));
    } catch (IOException e) {
      return error(500, "Could not serialize response");
    }
  }

  protected APIGatewayProxyResponseEvent error(int status, String message) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("message", message);
    try {
      return base(status).withBody(MAPPER.writeValueAsString(node));
    } catch (IOException e) {
      return base(status).withBody("{\"message\":\"Internal error\"}");
    }
  }

  private APIGatewayProxyResponseEvent base(int status) {
    return new APIGatewayProxyResponseEvent()
        .withStatusCode(status)
        .withHeaders(Map.of(
            "Content-Type",                "application/json",
            "Access-Control-Allow-Origin", "*",
            "Access-Control-Allow-Headers","Content-Type,Authorization,X-Dawaa-User-Id",
            "Access-Control-Allow-Methods","GET,POST,DELETE,OPTIONS"));
  }

  // ─── Body parsing ──────────────────────────────────────────────────────────

  protected JsonNode parseBody(String raw) {
    if (raw == null || raw.isBlank()) return MAPPER.createObjectNode();
    try {
      return MAPPER.readTree(raw);
    } catch (IOException e) {
      throw new IllegalArgumentException("Invalid JSON body");
    }
  }

  protected String require(JsonNode node, String field) {
    String val = node.path(field).asText("").trim();
    if (val.isEmpty()) throw new IllegalArgumentException(field + " is required");
    return val;
  }
}
