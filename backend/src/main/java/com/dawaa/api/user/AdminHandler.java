package com.dawaa.api.user;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.user.UserService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.user.User;
import com.dawaa.persistence.dynamodb.user.DynamoDBUserRepository;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;

public class AdminHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private static final String REQUESTER_HEADER = "X-Dawaa-User-Id";

  private final UserService userService;

  public AdminHandler() {
    this(new UserService(new DynamoDBUserRepository()));
  }

  public AdminHandler(UserService userService) {
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

      if ("GET".equalsIgnoreCase(method) && path.equals("/admin/users")) {
        return listUsers(request);
      }

      if ("GET".equalsIgnoreCase(method) && path.matches("/admin/users/.+")) {
        return getUser(request, userIdFromPath(path));
      }

      if ("DELETE".equalsIgnoreCase(method) && path.matches("/admin/users/.+")) {
        return deactivateUser(request, userIdFromPath(path));
      }

      return error(404, "Not found");
    } catch (IllegalArgumentException error) {
      return error(400, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log("AdminHandler error: " + error);
      }
      return error(500, "Admin user operation failed");
    }
  }

  private APIGatewayProxyResponseEvent listUsers(APIGatewayProxyRequestEvent request) {
    User requester = requester(request);
    ObjectNode wrapper = MAPPER.createObjectNode();
    ArrayNode users = wrapper.putArray("users");
    userService.getAllUsers(requester).forEach(user -> users.add(toUserNode(user)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent getUser(
      APIGatewayProxyRequestEvent request, String targetUserId) {
    User requester = requester(request);
    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set("user", toUserNode(userService.getById(requester, targetUserId)));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent deactivateUser(
      APIGatewayProxyRequestEvent request, String targetUserId) {
    User requester = requester(request);
    userService.deactivateUser(requester, targetUserId);

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    return ok(wrapper);
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

  private String userIdFromPath(String path) {
    String[] parts = path.split("/");
    if (parts.length < 4) {
      throw new IllegalArgumentException("userId is required");
    }
    return URLDecoder.decode(parts[3], StandardCharsets.UTF_8);
  }

  private ObjectNode toUserNode(User user) {
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id", user.userId());
    node.put("userId", user.userId());
    node.put("email", user.email());
    node.put("name", user.name());
    node.put("role", user.role().name().toLowerCase());
    node.put("active", user.active());
    node.put("createdAt", user.createdAt());
    node.put("updatedAt", user.updatedAt());
    return node;
  }
}
