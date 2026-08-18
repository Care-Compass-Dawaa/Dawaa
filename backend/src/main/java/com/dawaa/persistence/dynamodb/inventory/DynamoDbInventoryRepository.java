package com.dawaa.persistence.dynamodb.inventory;

import com.dawaa.domain.inventory.InventoryItem;
import com.dawaa.domain.inventory.InventoryRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.DeleteItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;

public class DynamoDbInventoryRepository implements InventoryRepository {
  private static final String DEFAULT_TABLE_NAME = "DawaaInventory";

  private final DynamoDbClient dynamoDb;
  private final String tableName;

  public DynamoDbInventoryRepository() {
    this(DynamoDbClient.builder().build());
  }

  public DynamoDbInventoryRepository(DynamoDbClient dynamoDb) {
    this(dynamoDb, configuredTableName());
  }

  public DynamoDbInventoryRepository(DynamoDbClient dynamoDb, String tableName) {
    this.dynamoDb = Objects.requireNonNull(dynamoDb, "dynamoDb is required");
    this.tableName = requireText(tableName, "tableName");
  }

  @Override
  public List<InventoryItem> findByPharmacyId(String pharmacyId) {
    if (pharmacyId == null || pharmacyId.isBlank()) {
      return List.of();
    }

    List<InventoryItem> items = new ArrayList<>();
    Map<String, AttributeValue> startKey = null;

    do {
      QueryRequest.Builder request =
          QueryRequest.builder()
              .tableName(tableName)
              .keyConditionExpression("pharmacyId = :pharmacyId")
              .expressionAttributeValues(
                  Map.of(":pharmacyId", AttributeValue.fromS(pharmacyId.trim())));

      if (startKey != null && !startKey.isEmpty()) {
        request.exclusiveStartKey(startKey);
      }

      QueryResponse response = dynamoDb.query(request.build());
      response.items().stream().map(DynamoDbInventoryRepository::toInventoryItem).forEach(items::add);
      startKey = response.lastEvaluatedKey();
    } while (startKey != null && !startKey.isEmpty());

    return items.stream()
        .sorted(Comparator.comparing(InventoryItem::medicineName, String.CASE_INSENSITIVE_ORDER))
        .toList();
  }

  @Override
  public Optional<InventoryItem> findByPharmacyIdAndMedicineId(
      String pharmacyId, String medicineId) {
    if (pharmacyId == null || pharmacyId.isBlank() || medicineId == null || medicineId.isBlank()) {
      return Optional.empty();
    }

    GetItemResponse response =
        dynamoDb.getItem(
            GetItemRequest.builder()
                .tableName(tableName)
                .key(key(pharmacyId.trim(), medicineId.trim()))
                .build());

    if (!response.hasItem()) {
      return Optional.empty();
    }
    return Optional.of(toInventoryItem(response.item()));
  }

  @Override
  public InventoryItem save(InventoryItem item) {
    dynamoDb.putItem(
        PutItemRequest.builder()
            .tableName(tableName)
            .item(toItem(item))
            .build());
    return item;
  }

  @Override
  public void delete(String pharmacyId, String medicineId) {
    dynamoDb.deleteItem(
        DeleteItemRequest.builder()
            .tableName(tableName)
            .key(key(requireText(pharmacyId, "pharmacyId"), requireText(medicineId, "medicineId")))
            .conditionExpression("attribute_exists(pharmacyId) AND attribute_exists(medicineId)")
            .build());
  }

  private static String configuredTableName() {
    String tableName = System.getenv("INVENTORY_TABLE");
    if (tableName == null || tableName.isBlank()) {
      return DEFAULT_TABLE_NAME;
    }
    return tableName;
  }

  private static Map<String, AttributeValue> key(String pharmacyId, String medicineId) {
    return Map.of(
        "pharmacyId", AttributeValue.fromS(pharmacyId),
        "medicineId", AttributeValue.fromS(medicineId));
  }

  private static Map<String, AttributeValue> toItem(InventoryItem item) {
    Map<String, AttributeValue> values = new HashMap<>();
    putString(values, "pharmacyId", item.pharmacyId());
    putString(values, "medicineId", item.medicineId());
    putString(values, "medicineName", item.medicineName());
    putString(values, "availableMedicineId", item.availableMedicineId());
    putString(values, "availableLocationKey", item.availableLocationKey());
    values.put("quantity", AttributeValue.fromN(Integer.toString(item.quantity())));
    values.put("inStock", AttributeValue.fromBool(item.inStock()));
    putString(values, "createdAt", item.createdAt());
    putString(values, "updatedAt", item.updatedAt());
    values.put("version", AttributeValue.fromN(Long.toString(item.version())));
    return values;
  }

  private static InventoryItem toInventoryItem(Map<String, AttributeValue> item) {
    String medicineId = stringValue(item, "medicineId");
    String availableMedicineId = stringValue(item, "availableMedicineId");
    return new InventoryItem(
        stringValue(item, "pharmacyId"),
        medicineId.isEmpty() ? availableMedicineId : medicineId,
        stringValue(item, "medicineName"),
        availableMedicineId.isEmpty() ? medicineId : availableMedicineId,
        stringValue(item, "availableLocationKey"),
        intValue(item, "quantity", 0),
        booleanValue(item, "inStock", true),
        stringValue(item, "createdAt"),
        stringValue(item, "updatedAt"),
        longValue(item, "version"));
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

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
