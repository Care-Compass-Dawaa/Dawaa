package com.dawaa.business.pharmacy;

import com.dawaa.domain.pharmacy.NearbyPharmacy;
import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.domain.pharmacy.PharmacyRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public class PharmacyService {
  private static final double EARTH_RADIUS_METERS = 6_371_000;

  private final PharmacyRepository pharmacyRepository;

  public PharmacyService(PharmacyRepository pharmacyRepository) {
    this.pharmacyRepository =
        Objects.requireNonNull(pharmacyRepository, "pharmacyRepository is required");
  }

  public Pharmacy registerPharmacy(Pharmacy pharmacy) {
    if (!textPresent(pharmacy.pharmacistId())) {
      throw new IllegalArgumentException("pharmacistId is required");
    }
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

    Optional<Pharmacy> existing = pharmacyRepository.findByPharmacistId(pharmacy.pharmacistId());
    if (existing.isPresent()) {
      return existing.get();
    }

    String now = Instant.now().toString();
    String pharmacyId =
        textPresent(pharmacy.pharmacyId())
            ? pharmacy.pharmacyId().trim()
            : "PHARMACY#" + UUID.randomUUID();

    return pharmacyRepository.save(
        new Pharmacy(
            pharmacyId,
            pharmacy.pharmacistId().trim(),
            pharmacy.name().trim(),
            pharmacy.address().trim(),
            pharmacy.area().trim(),
            trimToEmpty(pharmacy.district()),
            pharmacy.phone().trim(),
            trimToEmpty(pharmacy.email()),
            pharmacy.latitude(),
            pharmacy.longitude(),
            false,
            true,
            textPresent(pharmacy.createdAt()) ? pharmacy.createdAt() : now,
            now));
  }

  public Optional<Pharmacy> findByPharmacistId(String pharmacistId) {
    if (!textPresent(pharmacistId)) {
      throw new IllegalArgumentException("pharmacistId is required");
    }
    return pharmacyRepository.findByPharmacistId(pharmacistId.trim());
  }

  public List<Pharmacy> listAllPharmacies() {
    return pharmacyRepository.findAll();
  }

  public void setApproval(String pharmacyId, boolean approved) {
    if (!textPresent(pharmacyId)) {
      throw new IllegalArgumentException("pharmacyId is required");
    }
    pharmacyRepository.updateApproval(pharmacyId.trim(), approved);
  }

  public List<NearbyPharmacy> findNearbyPharmacies(
      double latitude, double longitude, int radiusMeters, int limit) {
    int normalizedRadius = Math.min(Math.max(radiusMeters, 500), 50_000);
    int normalizedLimit = Math.min(Math.max(limit, 1), 50);

    return pharmacyRepository.findAll().stream()
        .filter(PharmacyService::isSearchable)
        .filter(PharmacyService::hasCoordinates)
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
    return pharmacy.active() && pharmacy.approved();
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
}
