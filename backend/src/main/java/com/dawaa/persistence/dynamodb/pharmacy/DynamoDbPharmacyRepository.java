package com.dawaa.persistence.dynamodb.pharmacy;

import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.domain.pharmacy.PharmacyRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;

public class DynamoDbPharmacyRepository implements PharmacyRepository {
  private static final String DEFAULT_TABLE_NAME = "DawaaPharmacies";
  private static final String DEFAULT_PHARMACIST_INDEX_NAME = "pharmacistId-index";

  private final DynamoDbClient dynamoDb;
  private final String tableName;
  private final String pharmacistIndexName;

  public DynamoDbPharmacyRepository() {
    this(DynamoDbClient.builder().build());
  }

  public DynamoDbPharmacyRepository(DynamoDbClient dynamoDb) {
    this(dynamoDb, configuredTableName(), DEFAULT_PHARMACIST_INDEX_NAME);
  }

  public DynamoDbPharmacyRepository(
      DynamoDbClient dynamoDb, String tableName, String pharmacistIndexName) {
    this.dynamoDb = Objects.requireNonNull(dynamoDb, "dynamoDb is required");
    this.tableName = requireText(tableName, "tableName");
    this.pharmacistIndexName = requireText(pharmacistIndexName, "pharmacistIndexName");
  }

  @Override
  public Pharmacy save(Pharmacy pharmacy) {
    dynamoDb.putItem(
        PutItemRequest.builder().tableName(tableName).item(toItem(pharmacy)).build());
    return pharmacy;
  }

  @Override
  public java.util.Optional<Pharmacy> findByPharmacistId(String pharmacistId) {
    if (pharmacistId == null || pharmacistId.isBlank()) {
      return java.util.Optional.empty();
    }

    QueryResponse response =
        dynamoDb.query(
            QueryRequest.builder()
                .tableName(tableName)
                .indexName(pharmacistIndexName)
                .keyConditionExpression("pharmacistId = :pharmacistId")
                .expressionAttributeValues(
                    Map.of(":pharmacistId", AttributeValue.fromS(pharmacistId.trim())))
                .limit(1)
                .build());

    if (response.items().isEmpty()) {
      return java.util.Optional.empty();
    }
    return java.util.Optional.of(toPharmacy(response.items().get(0)));
  }

  @Override
  public List<Pharmacy> findAll() {
    List<Pharmacy> pharmacies = new ArrayList<>();
    Map<String, AttributeValue> startKey = null;

    do {
      ScanRequest.Builder request = ScanRequest.builder().tableName(tableName);
      if (startKey != null && !startKey.isEmpty()) {
        request.exclusiveStartKey(startKey);
      }

      ScanResponse response = dynamoDb.scan(request.build());
      response.items().forEach(item -> pharmacies.add(toPharmacy(item)));
      startKey = response.lastEvaluatedKey();
    } while (startKey != null && !startKey.isEmpty());

    return pharmacies;
  }

  @Override
  public void updateApproval(String pharmacyId, boolean approved) {
    dynamoDb.updateItem(
        UpdateItemRequest.builder()
            .tableName(tableName)
            .key(Map.of("pharmacyId", AttributeValue.fromS(pharmacyId)))
            .updateExpression("SET approved = :approved")
            .expressionAttributeValues(Map.of(":approved", AttributeValue.fromBool(approved)))
            .conditionExpression("attribute_exists(pharmacyId)")
            .build());
  }

  private static String configuredTableName() {
    String tableName = System.getenv("PHARMACIES_TABLE");
    if (tableName == null || tableName.isBlank()) {
      return DEFAULT_TABLE_NAME;
    }
    return tableName;
  }

  private static Map<String, AttributeValue> toItem(Pharmacy pharmacy) {
    Map<String, AttributeValue> item = new HashMap<>();
    putString(item, "pharmacyId", pharmacy.pharmacyId());
    putString(item, "pharmacistId", pharmacy.pharmacistId());
    putString(item, "name", pharmacy.name());
    putString(item, "address", pharmacy.address());
    putString(item, "area", pharmacy.area());
    putString(item, "district", pharmacy.district());
    putString(item, "phone", pharmacy.phone());
    putString(item, "email", pharmacy.email());
    item.put("latitude", AttributeValue.fromN(Double.toString(pharmacy.latitude())));
    item.put("longitude", AttributeValue.fromN(Double.toString(pharmacy.longitude())));
    item.put("approved", AttributeValue.fromBool(pharmacy.approved()));
    item.put("active", AttributeValue.fromBool(pharmacy.active()));
    putString(item, "createdAt", pharmacy.createdAt());
    putString(item, "updatedAt", pharmacy.updatedAt());
    return item;
  }

  private static Pharmacy toPharmacy(Map<String, AttributeValue> item) {
    String pharmacyId = firstStringValue(item, "pharmacyId", "id");
    return new Pharmacy(
        pharmacyId,
        stringValue(item, "pharmacistId"),
        stringValue(item, "name"),
        stringValue(item, "address"),
        stringValue(item, "area"),
        stringValue(item, "district"),
        stringValue(item, "phone"),
        stringValue(item, "email"),
        doubleValue(item, "latitude"),
        doubleValue(item, "longitude"),
        booleanValue(item, "approved", true),
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

  private static String firstStringValue(
      Map<String, AttributeValue> item, String firstAttribute, String secondAttribute) {
    String value = stringValue(item, firstAttribute);
    return value.isEmpty() ? stringValue(item, secondAttribute) : value;
  }

  private static String stringValue(Map<String, AttributeValue> item, String attributeName) {
    AttributeValue value = item.get(attributeName);
    return value == null || value.s() == null ? "" : value.s();
  }

  private static double doubleValue(Map<String, AttributeValue> item, String attributeName) {
    AttributeValue value = item.get(attributeName);
    if (value == null || value.n() == null || value.n().isBlank()) {
      return 0;
    }
    return Double.parseDouble(value.n());
  }

  private static boolean booleanValue(
      Map<String, AttributeValue> item, String attributeName, boolean defaultValue) {
    AttributeValue value = item.get(attributeName);
    return value == null || value.bool() == null ? defaultValue : Boolean.TRUE.equals(value.bool());
  }

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value;
  }
}
