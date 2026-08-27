package com.dawaa.persistence.dynamodb.pharmacy;

import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.domain.pharmacy.HoursMode;
import com.dawaa.domain.pharmacy.OpeningInterval;
import com.dawaa.domain.pharmacy.PharmacyHours;
import com.dawaa.domain.pharmacy.PharmacyRepository;
import java.time.DayOfWeek;
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

public class DynamoDbPharmacyRepository implements PharmacyRepository {
  private static final String DEFAULT_TABLE_NAME = "DawaaPharmacies";
  private static final String DEFAULT_OWNER_INDEX_NAME = "PharmacyOwnerIndex";

  private final DynamoDbClient dynamoDb;
  private final String tableName;
  private final String ownerIndexName;

  public DynamoDbPharmacyRepository() {
    this(DynamoDbClient.builder().build());
  }

  public DynamoDbPharmacyRepository(DynamoDbClient dynamoDb) {
    this(dynamoDb, configuredTableName(), DEFAULT_OWNER_INDEX_NAME);
  }

  public DynamoDbPharmacyRepository(
      DynamoDbClient dynamoDb, String tableName, String ownerIndexName) {
    this.dynamoDb = Objects.requireNonNull(dynamoDb, "dynamoDb is required");
    this.tableName = requireText(tableName, "tableName");
    this.ownerIndexName = requireText(ownerIndexName, "ownerIndexName");
  }

  @Override
  public Pharmacy save(Pharmacy pharmacy) {
    dynamoDb.putItem(
        PutItemRequest.builder().tableName(tableName).item(toItem(pharmacy)).build());
    return pharmacy;
  }

  @Override
  public Pharmacy update(Pharmacy pharmacy) {
    dynamoDb.putItem(
        PutItemRequest.builder()
            .tableName(tableName)
            .item(toItem(pharmacy))
            .conditionExpression("attribute_exists(pharmacyId)")
            .build());
    return pharmacy;
  }

  @Override
  public Optional<Pharmacy> findById(String pharmacyId) {
    if (pharmacyId == null || pharmacyId.isBlank()) {
      return Optional.empty();
    }

    GetItemResponse response =
        dynamoDb.getItem(
            GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("pharmacyId", AttributeValue.fromS(pharmacyId.trim())))
                .build());

    if (!response.hasItem()) {
      return Optional.empty();
    }
    return Optional.of(toPharmacy(response.item()));
  }

  @Override
  public Optional<Pharmacy> findByOwnerUserId(String ownerUserId) {
    if (ownerUserId == null || ownerUserId.isBlank()) {
      return Optional.empty();
    }

    QueryResponse response =
        dynamoDb.query(
            QueryRequest.builder()
                .tableName(tableName)
                .indexName(ownerIndexName)
                .keyConditionExpression("ownerUserId = :ownerUserId")
                .expressionAttributeValues(
                    Map.of(":ownerUserId", AttributeValue.fromS(ownerUserId.trim())))
                .limit(1)
                .build());

    if (response.items().isEmpty()) {
      return Optional.empty();
    }
    return Optional.of(toPharmacy(response.items().get(0)));
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
            .updateExpression(
                approved
                    ? "SET approved = :approved, updatedAt = :updatedAt REMOVE pendingRegistrationStatus, pendingRegistrationCreatedAt"
                    : "SET approved = :approved, updatedAt = :updatedAt, pendingRegistrationStatus = :pendingStatus, pendingRegistrationCreatedAt = :pendingCreatedAt")
            .expressionAttributeValues(approvalValues(approved))
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
    putString(item, "ownerUserId", pharmacy.ownerUserId());
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
    putHours(item, pharmacy.hours());
    putString(item, "createdAt", pharmacy.createdAt());
    putString(item, "updatedAt", pharmacy.updatedAt());
    if (!pharmacy.approved()) {
      putString(item, "pendingRegistrationStatus", "pending");
      putString(item, "pendingRegistrationCreatedAt", pharmacy.createdAt());
    }
    return item;
  }

  private static Pharmacy toPharmacy(Map<String, AttributeValue> item) {
    String pharmacyId = firstStringValue(item, "pharmacyId", "id");
    String ownerUserId = firstStringValue(item, "ownerUserId", "pharmacistId");
    return new Pharmacy(
        pharmacyId,
        ownerUserId,
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
        hoursValue(item),
        stringValue(item, "createdAt"),
        stringValue(item, "updatedAt"));
  }

  private static void putHours(Map<String, AttributeValue> item, PharmacyHours hours) {
    PharmacyHours safeHours = hours == null ? PharmacyHours.unknown() : hours;
    putString(item, "timezone", safeHours.timezone());
    item.put("hoursMode", AttributeValue.fromS(safeHours.hoursMode().apiValue()));
    item.put("weeklyHours", AttributeValue.fromM(toWeeklyHoursItem(safeHours.weeklyHours())));
  }

  private static Map<String, AttributeValue> toWeeklyHoursItem(
      Map<DayOfWeek, List<OpeningInterval>> weeklyHours) {
    if (weeklyHours == null || weeklyHours.isEmpty()) {
      return Map.of();
    }

    Map<String, AttributeValue> value = new HashMap<>();
    weeklyHours.forEach(
        (day, intervals) -> {
          if (day == null || intervals == null) {
            return;
          }
          List<AttributeValue> intervalItems =
              intervals.stream()
                  .filter(Objects::nonNull)
                  .map(
                      interval ->
                          AttributeValue.fromM(
                              Map.of(
                                  "open", AttributeValue.fromS(interval.open()),
                                  "close", AttributeValue.fromS(interval.close()))))
                  .toList();
          value.put(day.name(), AttributeValue.fromL(intervalItems));
        });
    return value;
  }

  private static PharmacyHours hoursValue(Map<String, AttributeValue> item) {
    String timezone = stringValue(item, "timezone");
    if (timezone.isBlank()) {
      timezone = PharmacyHours.DEFAULT_TIMEZONE;
    }

    HoursMode hoursMode = HoursMode.fromValue(stringValue(item, "hoursMode"));
    return new PharmacyHours(timezone, hoursMode, weeklyHoursValue(item.get("weeklyHours")));
  }

  private static Map<DayOfWeek, List<OpeningInterval>> weeklyHoursValue(AttributeValue value) {
    if (value == null || value.m() == null || value.m().isEmpty()) {
      return Map.of();
    }

    Map<DayOfWeek, List<OpeningInterval>> weeklyHours = new HashMap<>();
    value.m()
        .forEach(
            (dayName, intervalsValue) -> {
              try {
                DayOfWeek day = DayOfWeek.valueOf(dayName);
                weeklyHours.put(day, intervalsValue(intervalsValue));
              } catch (IllegalArgumentException ignored) {
                // Ignore unknown day keys from hand-edited DynamoDB rows.
              }
            });
    return weeklyHours;
  }

  private static List<OpeningInterval> intervalsValue(AttributeValue value) {
    if (value == null || value.l() == null || value.l().isEmpty()) {
      return List.of();
    }

    return value.l().stream()
        .map(AttributeValue::m)
        .filter(map -> map != null && !map.isEmpty())
        .map(map -> new OpeningInterval(stringValue(map, "open"), stringValue(map, "close")))
        .toList();
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

  private static Map<String, AttributeValue> approvalValues(boolean approved) {
    String now = java.time.Instant.now().toString();
    if (approved) {
      return Map.of(
          ":approved", AttributeValue.fromBool(true),
          ":updatedAt", AttributeValue.fromS(now));
    }
    return Map.of(
        ":approved", AttributeValue.fromBool(false),
        ":updatedAt", AttributeValue.fromS(now),
        ":pendingStatus", AttributeValue.fromS("pending"),
        ":pendingCreatedAt", AttributeValue.fromS(now));
  }

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value;
  }
}
