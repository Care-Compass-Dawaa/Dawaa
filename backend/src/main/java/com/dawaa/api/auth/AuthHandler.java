package com.dawaa.api.auth;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.dawaa.business.user.UserService;
import com.dawaa.common.BaseHandler;
import com.dawaa.domain.user.User;
import com.dawaa.domain.user.UserRole;
import com.dawaa.persistence.dynamodb.user.DynamoDBUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Objects;

/** Handles POST /auth/register and POST /auth/login. */
public class AuthHandler extends BaseHandler
    implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

  private final UserService userService;

  public AuthHandler() {
    this(new UserService(new DynamoDBUserRepository()));
  }

  public AuthHandler(UserService userService) {
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

      if ("POST".equalsIgnoreCase(method) && path.endsWith("/register")) {
        return register(parseBody(request.getBody()));
      }

      if ("POST".equalsIgnoreCase(method) && path.endsWith("/login")) {
        return login(parseBody(request.getBody()));
      }

      return error(404, "Not found");
    } catch (SecurityException error) {
      return error(401, error.getMessage());
    } catch (IllegalArgumentException error) {
      return error(400, error.getMessage());
    } catch (Exception error) {
      if (context != null) {
        context.getLogger().log("AuthHandler error: " + error);
      }
      return error(500, "Authentication failed");
    }
  }

  private APIGatewayProxyResponseEvent register(JsonNode body) {
    String email = require(body, "email").toLowerCase();
    String password = require(body, "password");
    String name = require(body, "name");
    UserRole role = publicSignupRole(body.path("role").asText("patient"));

    User created =
        userService.registerUser(
            new User("", email, name, role, password, true, "", ""));

    return ok(userWrapper(created));
  }

  private APIGatewayProxyResponseEvent login(JsonNode body) {
    String email = require(body, "email").toLowerCase();
    String password = require(body, "password");
    return ok(userWrapper(userService.loginUser(email, password)));
  }

  private UserRole publicSignupRole(String rawRole) {
    String role = rawRole == null ? "" : rawRole.trim().toUpperCase();
    if ("PHARMACIST".equals(role)) {
      return UserRole.PHARMACIST;
    }
    if ("ADMIN".equals(role)) {
      throw new IllegalArgumentException("Admin accounts cannot be created through signup");
    }
    return UserRole.PATIENT;
  }

  private ObjectNode userWrapper(User user) {
    ObjectNode wrapper = MAPPER.createObjectNode();
    wrapper.set("user", toUserNode(user));
    return wrapper;
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
