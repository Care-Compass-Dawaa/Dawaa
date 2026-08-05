package com.dawaa.persistence.dynamodb.inventory;

import com.dawaa.domain.inventory.InventoryAvailability;
import com.dawaa.domain.inventory.InventoryAvailabilityRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;

public class DynamoDbInventoryAvailabilityRepository
    implements InventoryAvailabilityRepository {
  private static final String DEFAULT_TABLE_NAME = "DawaaInventory";
  private static final String DEFAULT_INDEX_NAME = "MedicineAvailabilityIndex";

  private final DynamoDbClient dynamoDb;
  private final String tableName;
  private final String indexName;

  public DynamoDbInventoryAvailabilityRepository() {
    this(DynamoDbClient.builder().build());
  }

  public DynamoDbInventoryAvailabilityRepository(DynamoDbClient dynamoDb) {
    this(dynamoDb, configuredTableName(), DEFAULT_INDEX_NAME);
  }

  public DynamoDbInventoryAvailabilityRepository(
      DynamoDbClient dynamoDb, String tableName, String indexName) {
    this.dynamoDb = Objects.requireNonNull(dynamoDb, "dynamoDb is required");
    this.tableName = requireText(tableName, "tableName");
    this.indexName = requireText(indexName, "indexName");
  }

  @Override
  public List<InventoryAvailability> findByMedicineId(String medicineId) {
    String normalizedMedicineId = normalizeMedicineId(medicineId);
    if (normalizedMedicineId.isEmpty()) {
      return List.of();
    }

    QueryResponse response =
        dynamoDb.query(
            QueryRequest.builder()
                .tableName(tableName)
                .indexName(indexName)
                .keyConditionExpression("availableMedicineId = :medicineId")
                .expressionAttributeValues(
                    Map.of(":medicineId", AttributeValue.fromS(normalizedMedicineId)))
                .build());

    return response.items().stream()
        .map(DynamoDbInventoryAvailabilityRepository::toInventoryAvailability)
        .sorted(Comparator.comparing(InventoryAvailability::availableLocationKey))
        .toList();
  }

  private static String configuredTableName() {
    String tableName = System.getenv("INVENTORY_TABLE");
    if (tableName == null || tableName.isBlank()) {
      return DEFAULT_TABLE_NAME;
    }
    return tableName;
  }

  private static String normalizeMedicineId(String value) {
    if (value == null) {
      return "";
    }
    return value.trim();
  }

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value;
  }

  private static InventoryAvailability toInventoryAvailability(
      Map<String, AttributeValue> item) {
    String medicineId = stringValue(item, "medicineId");
    String availableMedicineId = stringValue(item, "availableMedicineId");

    return new InventoryAvailability(
        stringValue(item, "pharmacyId"),
        medicineId.isEmpty() ? availableMedicineId : medicineId,
        availableMedicineId,
        stringValue(item, "availableLocationKey"),
        intValue(item, "quantity", 0),
        booleanValue(item, "inStock", true),
        stringValue(item, "updatedAt"),
        longValue(item, "version"));
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

  private static int intValue(
      Map<String, AttributeValue> item, String attributeName, int defaultValue) {
    AttributeValue value = item.get(attributeName);
    if (value == null || value.n() == null || value.n().isBlank()) {
      return defaultValue;
    }
    return Integer.parseInt(value.n());
  }

  private static long longValue(Map<String, AttributeValue> item, String attributeName) {
    AttributeValue value = item.get(attributeName);
    if (value == null || value.n() == null || value.n().isBlank()) {
      return 0L;
    }
    return Long.parseLong(value.n());
  }
}
