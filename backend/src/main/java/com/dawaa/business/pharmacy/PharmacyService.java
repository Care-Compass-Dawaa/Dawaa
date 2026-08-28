package com.dawaa.business.pharmacy;

import com.dawaa.domain.pharmacy.HoursMode;
import com.dawaa.domain.pharmacy.NearbyPharmacy;
import com.dawaa.domain.pharmacy.OpeningInterval;
import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.domain.pharmacy.PharmacyHours;
import com.dawaa.domain.pharmacy.PharmacyOpenStatus;
import com.dawaa.domain.pharmacy.PharmacyRepository;
import com.dawaa.domain.user.User;
import com.dawaa.domain.user.UserRole;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

public class PharmacyService {
  private static final double EARTH_RADIUS_METERS = 6_371_000;
  private static final int MAX_INTERVALS_PER_DAY = 4;
  private static final Pattern EMAIL_PATTERN =
      Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

  private final PharmacyRepository pharmacyRepository;

  public PharmacyService(PharmacyRepository pharmacyRepository) {
    this.pharmacyRepository =
        Objects.requireNonNull(pharmacyRepository, "pharmacyRepository is required");
  }

  private static boolean isEmpty(String value){
        return value==null || value.isBlank();
    }

  public static void requireAdmin(User requester){
        if (requester == null) {
            throw new IllegalArgumentException("Requester is required");
        }
        if (requester.role()!=UserRole.ADMIN){
            throw new SecurityException("Admin access is required.");
        }
    }

  public Pharmacy registerPharmacy(User requester, Pharmacy pharmacy) {
    if (requester == null) {
      throw new IllegalArgumentException("Requester is required");
    }
    if (requester.role() != UserRole.PHARMACIST) {
      throw new SecurityException("Only pharmacists can register a pharmacy");
    }
    if (!requester.active()) {
      throw new SecurityException("Requester account is inactive");
    }
    if (pharmacy == null) {
      throw new IllegalArgumentException("pharmacy is required");
    }

    return registerPharmacyForOwner(pharmacy, requester.userId());
  }

  private Pharmacy registerPharmacyForOwner(Pharmacy pharmacy, String ownerUserId) {
    if (!textPresent(pharmacy.name())) {
      throw new IllegalArgumentException("name is required");
    }
    if (!textPresent(pharmacy.address())) {
      throw new IllegalArgumentException("address is required");
    }
    if (!textPresent(pharmacy.area())) {
      throw new IllegalArgumentException("area is required");
    }
    if (!textPresent(pharmacy.phone())) {
      throw new IllegalArgumentException("phone is required");
    }
    String normalizedPhone = normalizeLebanesePhone(pharmacy.phone());

    Optional<Pharmacy> existing = pharmacyRepository.findByOwnerUserId(ownerUserId);
    if (existing.isPresent()) {
        throw new IllegalArgumentException("This pharmacist already has a registered pharmacy");
    }//throws an exception if a pharmacy already exists for this pharmacist

    String now = Instant.now().toString();
    String pharmacyId =
        textPresent(pharmacy.pharmacyId())
            ? pharmacy.pharmacyId().trim()
            : "PHARMACY#" + UUID.randomUUID();

    return pharmacyRepository.save(
        new Pharmacy(
            pharmacyId,
            ownerUserId.trim(),
            pharmacy.name().trim(),
            pharmacy.address().trim(),
            pharmacy.area().trim(),
            trimToEmpty(pharmacy.district()),
            normalizedPhone,
            trimToEmpty(pharmacy.email()),
            pharmacy.latitude(),
            pharmacy.longitude(),
            false,
            true,
            PharmacyHours.unknown(),
            textPresent(pharmacy.createdAt()) ? pharmacy.createdAt() : now,
            now));
  }

  public Pharmacy getPublicPharmacyById(String pharmacyId) {
      Pharmacy pharmacy = findExistingById(pharmacyId);
      if (!isSearchable(pharmacy)) {
          throw new NoSuchElementException("pharmacy not found.");
      }
      return pharmacy;
  }

  public Pharmacy getAdminPharmacyById(User requester, String pharmacyId){
      requireAdmin(requester);
      return findExistingById(pharmacyId);
  }

  public Optional<Pharmacy> getMyPharmacy(User requester) {
    if (requester == null) {
        throw new IllegalArgumentException("Requester is required");
    }
    if (requester.role() != UserRole.PHARMACIST) {
        throw new SecurityException("Only pharmacists can have a pharmacy profile");
    }
    if (!requester.active()) {
        throw new SecurityException("Requester account is inactive");
    }

    return pharmacyRepository.findByOwnerUserId(requester.userId());
  }

  public Pharmacy updateMyPharmacy(
      User requester, String email, String phone, double latitude, double longitude) {
    if (requester == null) {
      throw new IllegalArgumentException("Requester is required");
    }
    if (requester.role() != UserRole.PHARMACIST) {
      throw new SecurityException("Only pharmacists can update a pharmacy profile");
    }
    if (!requester.active()) {
      throw new SecurityException("Requester account is inactive");
    }
    if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
      throw new IllegalArgumentException("valid latitude and longitude are required");
    }

    Pharmacy existing =
        pharmacyRepository
            .findByOwnerUserId(requester.userId())
            .orElseThrow(() -> new NoSuchElementException("pharmacy not found."));

    return pharmacyRepository.update(
        new Pharmacy(
            existing.pharmacyId(),
            existing.ownerUserId(),
            existing.name(),
            existing.address(),
            existing.area(),
            existing.district(),
            normalizeLebanesePhone(phone),
            normalizeEmailOptional(email),
            latitude,
            longitude,
            existing.approved(),
            existing.active(),
            existing.hours(),
            existing.createdAt(),
            Instant.now().toString()));
  }

  public Pharmacy updateMyPharmacySchedule(User requester, PharmacyHours hours) {
    if (requester == null) {
      throw new IllegalArgumentException("Requester is required");
    }
    if (requester.role() != UserRole.PHARMACIST) {
      throw new SecurityException("Only pharmacists can update a pharmacy schedule");
    }
    if (!requester.active()) {
      throw new SecurityException("Requester account is inactive");
    }

    Pharmacy existing =
        pharmacyRepository
            .findByOwnerUserId(requester.userId())
            .orElseThrow(() -> new NoSuchElementException("pharmacy not found."));
    PharmacyHours normalizedHours = validateHours(hours);

    return pharmacyRepository.update(
        new Pharmacy(
            existing.pharmacyId(),
            existing.ownerUserId(),
            existing.name(),
            existing.address(),
            existing.area(),
            existing.district(),
            existing.phone(),
            existing.email(),
            existing.latitude(),
            existing.longitude(),
            existing.approved(),
            existing.active(),
            normalizedHours,
            existing.createdAt(),
            Instant.now().toString()));
  }

  public Optional<Pharmacy> findByOwnerUserId(String ownerUserId) {
    if (!textPresent(ownerUserId)) {
        throw new IllegalArgumentException("ownerUserId is required");
    }
    return pharmacyRepository.findByOwnerUserId(ownerUserId.trim());
  }

  public List<Pharmacy> listAllPharmacies(User requester) {
    requireAdmin(requester);
    return pharmacyRepository.findAll();
  }

  public void setApproval(User requester, String pharmacyId, boolean approved) {
    requireAdmin(requester);
    if (!textPresent(pharmacyId)) {
      throw new IllegalArgumentException("pharmacyId is required");
    }
    findExistingById(pharmacyId);
    pharmacyRepository.updateApproval(pharmacyId.trim(), approved);
  }

  public List<NearbyPharmacy> findNearbyPharmacies(
      double latitude, double longitude, int radiusMeters, int limit) {
    return findNearbyPharmacies(latitude, longitude, radiusMeters, limit, null, false);
  }

  public List<NearbyPharmacy> findNearbyPharmacies(
      double latitude, double longitude, int radiusMeters, int limit, Set<String> pharmacyIds) {
    return findNearbyPharmacies(latitude, longitude, radiusMeters, limit, pharmacyIds, false);
  }

  public List<NearbyPharmacy> findNearbyPharmacies(
      double latitude,
      double longitude,
      int radiusMeters,
      int limit,
      Set<String> pharmacyIds,
      boolean openNowOnly) {
    int normalizedRadius = Math.min(Math.max(radiusMeters, 500), 50_000);
    int normalizedLimit = Math.min(Math.max(limit, 1), 50);

    return pharmacyRepository.findAll().stream()
        .filter(PharmacyService::isSearchable)
        .filter(PharmacyService::hasCoordinates)
        .filter(pharmacy -> pharmacyIds == null || pharmacyIds.contains(pharmacy.pharmacyId()))
        .filter(pharmacy -> !openNowOnly || Boolean.TRUE.equals(openStatus(pharmacy).openNow()))
        .map(
            pharmacy ->
                new NearbyPharmacy(
                    pharmacy,
                    Math.round(
                        haversine(
                            latitude,
                            longitude,
                            pharmacy.latitude(),
                            pharmacy.longitude()))))
        .filter(result -> result.distanceMeters() <= normalizedRadius)
        .sorted(Comparator.comparingLong(NearbyPharmacy::distanceMeters))
        .limit(normalizedLimit)
        .toList();
  }

  private static boolean isSearchable(Pharmacy pharmacy) {
    return pharmacy != null && pharmacy.active() && pharmacy.approved();
  }

  public PharmacyOpenStatus openStatus(Pharmacy pharmacy) {
    return openStatus(pharmacy == null ? null : pharmacy.hours(), Instant.now());
  }

  public PharmacyOpenStatus openStatus(PharmacyHours hours, Instant instant) {
    PharmacyHours safeHours = hours == null ? PharmacyHours.unknown() : hours;
    if (safeHours.hoursMode() == HoursMode.TWENTY_FOUR_HOURS) {
      return new PharmacyOpenStatus(
          "open", true, List.of(new OpeningInterval("00:00", "23:59")));
    }
    if (safeHours.hoursMode() != HoursMode.REGULAR) {
      return new PharmacyOpenStatus("unknown", null, List.of());
    }

    ZoneId zone = zoneId(safeHours.timezone());
    ZonedDateTime now = instant.atZone(zone);
    List<OpeningInterval> todayIntervals =
        safeHours.weeklyHours() == null
            ? List.of()
            : safeHours.weeklyHours().getOrDefault(now.getDayOfWeek(), List.of());
    LocalTime currentTime = now.toLocalTime();
    boolean open =
        todayIntervals.stream()
            .anyMatch(
                interval ->
                    !currentTime.isBefore(parseTime(interval.open()))
                        && currentTime.isBefore(parseTime(interval.close())));

    return new PharmacyOpenStatus(open ? "open" : "closed", open, todayIntervals);
  }

  private Pharmacy findExistingById(String pharmacyId) {
      if (isEmpty(pharmacyId)){
          throw new IllegalArgumentException("pharmacyId is required.");
      }
      return pharmacyRepository.findById(pharmacyId.trim())
          .orElseThrow(() -> new NoSuchElementException("pharmacy not found."));
  }

  private static boolean hasCoordinates(Pharmacy pharmacy) {
    return pharmacy.latitude() != 0 || pharmacy.longitude() != 0;
  }

  private static double haversine(double latA, double lngA, double latB, double lngB) {
    double dLat = Math.toRadians(latB - latA);
    double dLng = Math.toRadians(lngB - lngA);
    double a =
        Math.pow(Math.sin(dLat / 2), 2)
            + Math.cos(Math.toRadians(latA))
                * Math.cos(Math.toRadians(latB))
                * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
  }

  private static boolean textPresent(String value) {
    return value != null && !value.isBlank();
  }

  private static String trimToEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  private static String normalizeLebanesePhone(String phone) {
    String digits = phone == null ? "" : phone.replaceAll("\\D", "");
    if (digits.startsWith("961")) {
      digits = digits.substring(3);
    }
    if (digits.length() != 8) {
      throw new IllegalArgumentException("phone must contain 8 digits after +961");
    }
    return "+961" + digits;
  }

  private static String normalizeEmailOptional(String email) {
    if (!textPresent(email)) {
      return "";
    }
    String normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.matcher(normalized).matches()) {
      throw new IllegalArgumentException("email must be valid");
    }
    return normalized;
  }

  private static PharmacyHours validateHours(PharmacyHours hours) {
    if (hours == null || hours.hoursMode() == null || hours.hoursMode() == HoursMode.UNKNOWN) {
      return PharmacyHours.unknown();
    }

    String timezone = normalizeTimezone(hours.timezone());
    if (hours.hoursMode() == HoursMode.TWENTY_FOUR_HOURS) {
      return new PharmacyHours(timezone, HoursMode.TWENTY_FOUR_HOURS, Map.of());
    }

    if (hours.hoursMode() != HoursMode.REGULAR) {
      throw new IllegalArgumentException("hoursMode is invalid");
    }

    Map<DayOfWeek, List<OpeningInterval>> weeklyHours =
        hours.weeklyHours() == null ? Map.of() : hours.weeklyHours();
    weeklyHours.forEach(PharmacyService::validateDailyIntervals);
    return new PharmacyHours(timezone, HoursMode.REGULAR, weeklyHours);
  }

  private static void validateDailyIntervals(DayOfWeek day, List<OpeningInterval> intervals) {
    if (day == null) {
      throw new IllegalArgumentException("weeklyHours contains an invalid day");
    }
    if (intervals == null) {
      return;
    }
    if (intervals.size() > MAX_INTERVALS_PER_DAY) {
      throw new IllegalArgumentException("weeklyHours can contain up to 4 intervals per day");
    }

    List<OpeningInterval> sorted =
        intervals.stream()
            .filter(Objects::nonNull)
            .sorted(Comparator.comparing(interval -> parseTime(interval.open())))
            .toList();
    LocalTime previousClose = null;
    for (OpeningInterval interval : sorted) {
      LocalTime open = parseTime(interval.open());
      LocalTime close = parseTime(interval.close());
      if (!open.isBefore(close)) {
        throw new IllegalArgumentException("opening interval close time must be after open time");
      }
      if (previousClose != null && open.isBefore(previousClose)) {
        throw new IllegalArgumentException("opening intervals cannot overlap");
      }
      previousClose = close;
    }
  }

  private static String normalizeTimezone(String timezone) {
    String normalized = textPresent(timezone) ? timezone.trim() : PharmacyHours.DEFAULT_TIMEZONE;
    zoneId(normalized);
    return normalized;
  }

  private static ZoneId zoneId(String timezone) {
    try {
      return ZoneId.of(textPresent(timezone) ? timezone.trim() : PharmacyHours.DEFAULT_TIMEZONE);
    } catch (DateTimeException error) {
      throw new IllegalArgumentException("timezone is invalid");
    }
  }

  private static LocalTime parseTime(String value) {
    if (!textPresent(value) || !value.matches("^\\d{2}:\\d{2}$")) {
      throw new IllegalArgumentException("opening interval times must use HH:mm");
    }
    try {
      return LocalTime.parse(value);
    } catch (DateTimeException error) {
      throw new IllegalArgumentException("opening interval times must be valid HH:mm values");
    }
  }
}
