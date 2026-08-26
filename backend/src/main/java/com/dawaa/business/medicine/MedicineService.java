package com.dawaa.business.medicine;

import com.dawaa.domain.medicine.Medicine;
import com.dawaa.domain.medicine.MedicineRepository;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public class MedicineService {
  private final MedicineRepository medicineRepository;

  public MedicineService(MedicineRepository medicineRepository) {
    this.medicineRepository =
        Objects.requireNonNull(medicineRepository, "medicineRepository is required");
  }

  public Optional<Medicine> findActiveMedicineByBrandName(String brandName) {
    String normalizedBrandName = normalizeRequired(brandName, "brandName");

    return medicineRepository
        .findByNormalizedBrandName(normalizedBrandName)
        .filter(Medicine::active);
  }

  public Optional<Medicine> findActiveMedicineById(String medicineId) {
    String normalizedMedicineId = requireText(medicineId, "medicineId");

    return medicineRepository.findById(normalizedMedicineId).filter(Medicine::active);
  }

  public Optional<Medicine> findActiveMedicineByGenericName(String genericName) {
    String normalizedGenericName = normalizeRequired(genericName, "genericName");

    return medicineRepository
        .findByNormalizedGenericName(normalizedGenericName)
        .filter(Medicine::active);
  }

  public Optional<Medicine> findActiveMedicineByName(String name) {
    String normalizedName = normalizeRequired(name, "medicine name");

    return medicineRepository
        .findByNormalizedBrandName(normalizedName)
        .filter(Medicine::active)
        .or(
            () ->
                medicineRepository
                    .findByNormalizedGenericName(normalizedName)
                    .filter(Medicine::active));
  }

  public List<Medicine> suggestActiveMedicinesByBrandName(String brandName, int limit) {
    String normalizedBrandName = normalizeRequired(brandName, "brandName");

    return medicineRepository.searchByNormalizedBrandName(normalizedBrandName, limit).stream()
        .filter(Medicine::active)
        .toList();
  }

  public List<Medicine> suggestActiveMedicinesByGenericName(String genericName, int limit) {
    String normalizedGenericName = normalizeRequired(genericName, "genericName");

    return medicineRepository.searchByNormalizedGenericName(normalizedGenericName, limit).stream()
        .filter(Medicine::active)
        .toList();
  }

  public List<Medicine> suggestActiveMedicinesByName(String name, int limit) {
    String normalizedName = normalizeRequired(name, "medicine name");
    int safeLimit = Math.min(Math.max(limit, 1), 100);
    Map<String, Medicine> matchesByDisplayKey = new LinkedHashMap<>();

    List<Medicine> brandMatches =
        medicineRepository.searchByNormalizedBrandName(normalizedName, safeLimit);
    List<Medicine> genericMatches =
        medicineRepository.searchByNormalizedGenericName(normalizedName, safeLimit);

    addActiveMatches(matchesByDisplayKey, brandMatches);
    addActiveMatches(matchesByDisplayKey, genericMatches);

    return new ArrayList<>(matchesByDisplayKey.values()).stream().limit(safeLimit).toList();
  }

  private static void addActiveMatches(
      Map<String, Medicine> matchesByDisplayKey, List<Medicine> medicines) {
    for (Medicine medicine : medicines) {
      if (medicine.active()) {
        matchesByDisplayKey.putIfAbsent(displayKey(medicine), medicine);
      }
    }
  }

  private static String displayKey(Medicine medicine) {
    return String.join(
        "|",
        normalizeOptional(medicine.brandName()),
        normalizeOptional(medicine.genericName()),
        normalizeOptional(medicine.strength()),
        normalizeOptional(medicine.dosageForm()),
        normalizeOptional(medicine.manufacturer()));
  }

  private static String normalizeRequired(String value, String name) {
    requireText(value, name);
    return Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKD)
        .replaceAll("\\p{M}", "")
        .replaceAll("[^\\p{L}\\p{N}]+", " ")
        .trim();
  }

  private static String normalizeOptional(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }
    return Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKD)
        .replaceAll("\\p{M}", "")
        .replaceAll("[^\\p{L}\\p{N}]+", " ")
        .trim();
  }

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
