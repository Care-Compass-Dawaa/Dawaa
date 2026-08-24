package com.dawaa.api.user;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.user.UserService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.user.User;
import com.dawaa.persistence.dynamodb.user.DynamoDBUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;

public class UserHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
  private static final String REQUESTER_HEADER = "X-Dawaa-User-Id";

  private final UserService userService;

  public UserHandler() {
    this(new UserService(new DynamoDBUserRepository()));
  }

  public UserHandler(UserService userService) {
    this.userService = Objects.requireNonNull(userService, "userService is required");
  }

  private User requester(APIGatewayProxyRequestEvent request) {
    return userService.getRequester(header(request, REQUESTER_HEADER));
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

      if ("GET".equalsIgnoreCase(method) && path.equals("/users/me")) {
        return getMe(request);
      }

      if ("POST".equalsIgnoreCase(method) && path.equals("/users/me/update")) {
        return updateMe(request);
      }

      if ("DELETE".equalsIgnoreCase(method) && path.equals("/users/me")) {
        return deactivateMe(request);
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
        context.getLogger().log("UserHandler error: " + error);
      }
      return error(500, "User operation failed");
    }
  }

  private APIGatewayProxyResponseEvent getMe(APIGatewayProxyRequestEvent request) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set("user", toUserNode(userService.getMyProfile(requester(request))));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent updateMe(APIGatewayProxyRequestEvent request) {
    User requester = requester(request);
    JsonNode body = parseBody(request.getBody());

    User updatedUser =
        userService.updateUser(requester, require(body, "name"), require(body, "email"));

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set("user", toUserNode(updatedUser));
    return ok(wrapper);
  }

  private APIGatewayProxyResponseEvent deactivateMe(APIGatewayProxyRequestEvent request) {
    userService.deactivateMyAccount(requester(request));

    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.put("success", true);
    return ok(wrapper);
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
