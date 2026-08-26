package com.dawaa.api.route;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.route.RouteService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.route.RouteDirections;
import com.dawaa.persistence.openrouteservice.OpenRouteServiceClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Objects;

public class RouteHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private final RouteService routeService;

  public RouteHandler() {
    this(new RouteService(new OpenRouteServiceClient()));
  }

  public RouteHandler(RouteService routeService) {
    this.routeService = Objects.requireNonNull(routeService, "routeService is required");
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

      if ("POST".equalsIgnoreCase(method) && path.equals("/routes/directions")) {
        return directions(parseBody(request.getBody()));
      }

      return error(404, "Not found");
    } catch (IllegalArgumentException error) {
      return error(400, error.getMessage());
    } catch (IllegalStateException error) {
      if (context != null) {
        context.getLogger().log("RouteHandler route lookup failed: " + error.getMessage());
      }
      return error(502, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log("RouteHandler error: " + error);
      }
      return error(500, "Route lookup failed");
    }
  }

  private APIGatewayProxyResponseEvent directions(JsonNode body) {
    JsonNode from = body.path("from");
    JsonNode to = body.path("to");
    RouteDirections directions =
        routeService.getDirections(
            requiredDouble(from.path("lat"), "from.lat"),
            requiredDouble(from.path("lng"), "from.lng"),
            requiredDouble(to.path("lat"), "to.lat"),
            requiredDouble(to.path("lng"), "to.lng"));
    return ok(toDirectionsNode(directions));
  }

  private ObjectNode toDirectionsNode(RouteDirections directions) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("distanceMeters", directions.distanceMeters());
    node.put("durationSeconds", directions.durationSeconds());
    ArrayNode coordinates = node.putArray("coordinates");
    for (List<Double> coordinate : directions.coordinates()) {
      ArrayNode coordinateNode = coordinates.addArray();
      coordinateNode.add(coordinate.get(0));
      coordinateNode.add(coordinate.get(1));
    }
    return node;
  }

  private static double requiredDouble(JsonNode node, String name) {
    if (node == null || !node.isNumber()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return node.asDouble();
  }
}
