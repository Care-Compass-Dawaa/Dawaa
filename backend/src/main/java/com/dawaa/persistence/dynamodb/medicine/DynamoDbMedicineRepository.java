package com.dawaa.persistence.dynamodb.medicine;

import com.dawaa.domain.medicine.Medicine;
import com.dawaa.domain.medicine.MedicineRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;

public class DynamoDbMedicineRepository implements MedicineRepository {
  private static final String DEFAULT_TABLE_NAME = "DawaaMedicines";
  private static final String DEFAULT_BRAND_INDEX_NAME = "BrandNameIndex";
  private static final String DEFAULT_GENERIC_INDEX_NAME = "GenericNameIndex";

  private final DynamoDbClient dynamoDb;
  private final String tableName;
  private final String brandIndexName;
  private final String genericIndexName;

  public DynamoDbMedicineRepository() {
    this(DynamoDbClient.builder().build());
  }

  public DynamoDbMedicineRepository(DynamoDbClient dynamoDb) {
    this(dynamoDb, configuredTableName(), DEFAULT_BRAND_INDEX_NAME, DEFAULT_GENERIC_INDEX_NAME);
  }

  public DynamoDbMedicineRepository(
      DynamoDbClient dynamoDb, String tableName, String brandIndexName) {
    this(dynamoDb, tableName, brandIndexName, DEFAULT_GENERIC_INDEX_NAME);
  }

  public DynamoDbMedicineRepository(
      DynamoDbClient dynamoDb, String tableName, String brandIndexName, String genericIndexName) {
    this.dynamoDb = Objects.requireNonNull(dynamoDb, "dynamoDb is required");
    this.tableName = requireText(tableName, "tableName");
    this.brandIndexName = requireText(brandIndexName, "brandIndexName");
    this.genericIndexName = requireText(genericIndexName, "genericIndexName");
  }

  @Override
  public Optional<Medicine> findByNormalizedBrandName(String normalizedBrandName) {
    return findByNormalizedAttribute(
        brandIndexName, "normalizedBrandName", ":brandName", normalizedBrandName);
  }

  @Override
  public Optional<Medicine> findByNormalizedGenericName(String normalizedGenericName) {
    return findByNormalizedAttribute(
        genericIndexName, "normalizedGenericName", ":genericName", normalizedGenericName);
  }

  @Override
  public List<Medicine> searchByNormalizedBrandName(String normalizedBrandName, int limit) {
    return searchByNormalizedAttribute(
        "normalizedBrandName", ":brandName", normalizedBrandName, limit);
  }

  @Override
  public List<Medicine> searchByNormalizedGenericName(String normalizedGenericName, int limit) {
    return searchByNormalizedAttribute(
        "normalizedGenericName", ":genericName", normalizedGenericName, limit);
  }

  private Optional<Medicine> findByNormalizedAttribute(
      String indexName, String attributeName, String valueToken, String value) {
    String normalized = normalize(value);
    if (normalized.isEmpty()) {
      return Optional.empty();
    }

    QueryResponse response =
        dynamoDb.query(
            QueryRequest.builder()
                .tableName(tableName)
                .indexName(indexName)
                .keyConditionExpression(attributeName + " = " + valueToken)
                .expressionAttributeValues(Map.of(valueToken, AttributeValue.fromS(normalized)))
                .limit(1)
                .build());

    if (response.items().isEmpty()) {
      return Optional.empty();
    }

    return Optional.of(toMedicine(response.items().get(0)));
  }

  private List<Medicine> searchByNormalizedAttribute(
      String attributeName, String valueToken, String value, int limit) {
    String normalized = normalize(value);
    if (normalized.isEmpty()) {
      return List.of();
    }

    int safeLimit = Math.min(Math.max(limit, 1), 100);
    List<Medicine> matches = new ArrayList<>();
    Map<String, AttributeValue> lastEvaluatedKey = null;

    do {
      ScanRequest.Builder request =
          ScanRequest.builder()
              .tableName(tableName)
              .filterExpression(
                  "active = :active AND contains(" + attributeName + ", " + valueToken + ")")
              .expressionAttributeValues(
                  Map.of(
                      ":active", AttributeValue.fromBool(true),
                      valueToken, AttributeValue.fromS(normalized)));

      if (lastEvaluatedKey != null && !lastEvaluatedKey.isEmpty()) {
        request.exclusiveStartKey(lastEvaluatedKey);
      }

      ScanResponse response = dynamoDb.scan(request.build());
      response.items().stream().map(DynamoDbMedicineRepository::toMedicine).forEach(matches::add);
      lastEvaluatedKey = response.lastEvaluatedKey();
    } while (matches.size() < safeLimit
        && lastEvaluatedKey != null
        && !lastEvaluatedKey.isEmpty());

    return matches.stream()
        .sorted(
            Comparator.comparing(
                    (Medicine medicine) ->
                        normalizedAttribute(medicine, attributeName).startsWith(normalized) ? 0 : 1)
                .thenComparing(medicine -> normalizedAttribute(medicine, attributeName))
                .thenComparing(Medicine::medicineId))
        .limit(safeLimit)
        .toList();
  }

  private static String normalizedAttribute(Medicine medicine, String attributeName) {
    return switch (attributeName) {
      case "normalizedGenericName" -> medicine.normalizedGenericName();
      case "normalizedBrandName" -> medicine.normalizedBrandName();
      default -> "";
    };
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
