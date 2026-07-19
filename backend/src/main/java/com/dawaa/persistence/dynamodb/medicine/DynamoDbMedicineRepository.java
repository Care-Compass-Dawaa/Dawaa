package com.dawaa.persistence.dynamodb.medicine;

import com.dawaa.domain.medicine.Medicine;
import com.dawaa.domain.medicine.MedicineRepository;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;

public class DynamoDbMedicineRepository implements MedicineRepository {
  private static final String DEFAULT_TABLE_NAME = "DawaaMedicines";
  private static final String DEFAULT_INDEX_NAME = "BrandNameIndex";

  private final DynamoDbClient dynamoDb;
  private final String tableName;
  private final String indexName;

  public DynamoDbMedicineRepository() {
    this(DynamoDbClient.builder().build());
  }

  public DynamoDbMedicineRepository(DynamoDbClient dynamoDb) {
    this(dynamoDb, configuredTableName(), DEFAULT_INDEX_NAME);
  }

  public DynamoDbMedicineRepository(DynamoDbClient dynamoDb, String tableName, String indexName) {
    this.dynamoDb = Objects.requireNonNull(dynamoDb, "dynamoDb is required");
    this.tableName = requireText(tableName, "tableName");
    this.indexName = requireText(indexName, "indexName");
  }

  @Override
  public Optional<Medicine> findByNormalizedBrandName(String normalizedBrandName) {
    String normalized = normalize(normalizedBrandName);
    if (normalized.isEmpty()) {
      return Optional.empty();
    }

    QueryResponse response =
        dynamoDb.query(
            QueryRequest.builder()
                .tableName(tableName)
                .indexName(indexName)
                .keyConditionExpression("normalizedBrandName = :brandName")
                .expressionAttributeValues(Map.of(":brandName", AttributeValue.fromS(normalized)))
                .limit(1)
                .build());

    if (response.items().isEmpty()) {
      return Optional.empty();
    }

    return Optional.of(toMedicine(response.items().get(0)));
  }

  private static String configuredTableName() {
    String tableName = System.getenv("MEDICINES_TABLE");
    if (tableName == null || tableName.isBlank()) {
      return DEFAULT_TABLE_NAME;
    }
    return tableName;
  }

  private static String normalize(String value) {
    if (value == null) {
      return "";
    }
    return value.trim().toLowerCase(Locale.ROOT);
  }

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value;
  }

  private static Medicine toMedicine(Map<String, AttributeValue> item) {
    return new Medicine(
        stringValue(item, "medicineId"),
        stringValue(item, "brandName"),
        stringValue(item, "genericName"),
        stringValue(item, "strength"),
        stringValue(item, "dosageForm"),
        stringValue(item, "manufacturer"),
        stringValue(item, "normalizedBrandName"),
        stringValue(item, "normalizedGenericName"),
        booleanValue(item, "active"),
        stringValue(item, "createdAt"),
        stringValue(item, "updatedAt"),
        longValue(item, "version"));
  }

  private static String stringValue(Map<String, AttributeValue> item, String attributeName) {
    AttributeValue value = item.get(attributeName);
    return value == null || value.s() == null ? "" : value.s();
  }

  private static boolean booleanValue(Map<String, AttributeValue> item, String attributeName) {
    AttributeValue value = item.get(attributeName);
    return value != null && Boolean.TRUE.equals(value.bool());
  }

  private static long longValue(Map<String, AttributeValue> item, String attributeName) {
    AttributeValue value = item.get(attributeName);
    if (value == null || value.n() == null || value.n().isBlank()) {
      return 0L;
    }
    return Long.parseLong(value.n());
  }
}
