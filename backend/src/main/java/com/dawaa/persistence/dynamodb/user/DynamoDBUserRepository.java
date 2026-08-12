package com.dawaa.persistence.dynamodb.user;

import com.dawaa.domain.user.User;
import com.dawaa.domain.user.UserRepository;
import com.dawaa.domain.user.UserRole;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;

public class DynamoDBUserRepository implements UserRepository{
    private static final String DEFAULT_TABLE_NAME = "DawaaUsers";
    private static final String DEFAULT_EMAIL_INDEX_NAME = "email-index";

    private final DynamoDbClient dynamoDb;
    private final String tableName;
    private final String emailIndexName;

    //gets table name from env
    private static String configuredTableName() {
        String tableName = System.getenv("USERS_TABLE");
        if (tableName == null || tableName.isBlank()) {
            return DEFAULT_TABLE_NAME;
        }
        return tableName;
    }

    //default constructor
    public DynamoDBUserRepository(){
        this(DynamoDbClient.builder().build());
    }

    public DynamoDBUserRepository(DynamoDbClient dynamoDb, String tableName, String emailIndexName){
        this.dynamoDb=Objects.requireNonNull(dynamoDb, "dynamoDb is required");
        this.tableName=requireText(tableName, "tableName");
        this.emailIndexName=requireText(emailIndexName, "emailIndexName");
    }

    public DynamoDBUserRepository(DynamoDbClient dynamoDb){
        this(dynamoDb, configuredTableName(), DEFAULT_EMAIL_INDEX_NAME);
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
        return value;
    }

    @Override
    public Optional<User> findById(String userId){
        if (userId == null || userId.isBlank()){
            return Optional.empty();//may potentially be empty
        }

        GetItemResponse response = dynamoDb.getItem(
            GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("userId", AttributeValue.fromS(userId.trim())))
                .build());

        if (!response.hasItem()) {
            return Optional.empty();
        }
        return Optional.of(toUser(response.item()));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail.isEmpty()) {
            return Optional.empty();
        }

        QueryResponse response = dynamoDb.query(
            QueryRequest.builder()
                .tableName(tableName)
                .indexName(emailIndexName)
                .keyConditionExpression("email = :email")
                .expressionAttributeValues(
                    Map.of(":email", AttributeValue.fromS(normalizedEmail)))
                .limit(1)
                .build());

        if (response.items().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(toUser(response.items().get(0)));
    }

    @Override
    public User save(User user) {
        dynamoDb.putItem(
            PutItemRequest.builder()
                .tableName(tableName)
                .item(toItem(user))
                .conditionExpression("attribute_not_exists(userId)")
                .build());
        return user;
    }

    @Override
    public List<User> findAll() {
        List<User> users = new ArrayList<>();
        Map<String, AttributeValue> startKey = null;

        do {
            ScanRequest.Builder request = ScanRequest.builder().tableName(tableName);
            if (startKey != null && !startKey.isEmpty()) {
                request.exclusiveStartKey(startKey);
            }

            ScanResponse response = dynamoDb.scan(request.build());
            response.items().forEach(item -> users.add(toUser(item)));
            startKey = response.lastEvaluatedKey();
        } while (startKey != null && !startKey.isEmpty());

        return users;
    }

    @Override
    public User update(User user) {
        dynamoDb.putItem(
            PutItemRequest.builder()
                .tableName(tableName)
                .item(toItem(user))
                .conditionExpression("attribute_exists(userId)")
                .build());
        return user;
    }

    @Override
    public void deactivate(String userId) {
        dynamoDb.updateItem(
            UpdateItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("userId", AttributeValue.fromS(requireText(userId, "userId").trim())))
                .updateExpression("SET active = :active, updatedAt = :updatedAt")
                .expressionAttributeValues(
                    Map.of(
                        ":active", AttributeValue.fromBool(false),
                        ":updatedAt", AttributeValue.fromS(Instant.now().toString())))
                .conditionExpression("attribute_exists(userId)")
                .build());
    }

    private static Map<String, AttributeValue> toItem(User user) {
        Map<String, AttributeValue> item = new HashMap<>();
        putString(item, "userId", user.userId());
        putString(item, "email", normalizeEmail(user.email()));
        putString(item, "name", user.name());
        putString(item, "role", roleString(user.role()));
        putString(item, "passwordHash", user.passwordHash());
        item.put("active", AttributeValue.fromBool(user.active()));
        putString(item, "createdAt", user.createdAt());
        putString(item, "updatedAt", user.updatedAt());
        return item;
    }

    private static User toUser(Map<String, AttributeValue> item) {
        return new User(
            stringValue(item, "userId"),
            stringValue(item, "email"),
            stringValue(item, "name"),
            roleValue(item, "role"),
            stringValue(item, "passwordHash"),
            booleanValue(item, "active", true),
            stringValue(item, "createdAt"),
            stringValue(item, "updatedAt"));
    }

    private static void putString(
        Map<String, AttributeValue> item, String attributeName, String value) {
        if (value != null && !value.isBlank()) {
            item.put(attributeName, AttributeValue.fromS(value));
        }
    }

    private static String stringValue(Map<String, AttributeValue> item, String attributeName) {
        AttributeValue value = item.get(attributeName);
        return value == null || value.s() == null ? "" : value.s();
    }

    private static boolean booleanValue(
        Map<String, AttributeValue> item, String attributeName, boolean defaultValue) {
        AttributeValue value = item.get(attributeName);
        return value == null || value.bool() == null ? defaultValue : Boolean.TRUE.equals(value.bool());
    }

    private static UserRole roleValue(Map<String, AttributeValue> item, String attributeName) {
        String role = stringValue(item, attributeName);
        if (role.isBlank()) {
            return UserRole.PATIENT;
        }
        try {
            return UserRole.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException error) {
            return UserRole.PATIENT;
        }
    }

    private static String roleString(UserRole role) {
        return role == null ? UserRole.PATIENT.name().toLowerCase() : role.name().toLowerCase();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
