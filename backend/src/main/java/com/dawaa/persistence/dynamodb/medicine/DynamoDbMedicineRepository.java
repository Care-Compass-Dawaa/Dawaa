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

  @Override
  public List<Medicine> searchByNormalizedBrandName(String normalizedBrandName, int limit) {
    String normalized = normalize(normalizedBrandName);
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
              .filterExpression("active = :active AND contains(normalizedBrandName, :brandName)")
              .expressionAttributeValues(
                  Map.of(
                      ":active", AttributeValue.fromBool(true),
                      ":brandName", AttributeValue.fromS(normalized)));

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
                        medicine.normalizedBrandName().startsWith(normalized) ? 0 : 1)
                .thenComparing(Medicine::normalizedBrandName)
                .thenComparing(Medicine::medicineId))
        .limit(safeLimit)
        .toList();
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
