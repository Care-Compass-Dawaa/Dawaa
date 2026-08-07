package com.dawaa.business.medicine;

import com.dawaa.domain.medicine.Medicine;
import com.dawaa.domain.medicine.MedicineRepository;
import java.util.List;
import java.util.Locale;
import java.text.Normalizer;
import java.util.Objects;
import java.util.Optional;

public class MedicineService {
  private final MedicineRepository medicineRepository;

  public MedicineService(MedicineRepository medicineRepository) {
    this.medicineRepository =
        Objects.requireNonNull(medicineRepository, "medicineRepository is required");
  }

  public Optional<Medicine> findActiveMedicineByBrandName(String brandName) {
    String normalizedBrandName = normalizeRequired(brandName);

    return medicineRepository
        .findByNormalizedBrandName(normalizedBrandName)
        .filter(Medicine::active);
  }

  public List<Medicine> suggestActiveMedicinesByBrandName(String brandName, int limit) {
    String normalizedBrandName = normalizeRequired(brandName);

    return medicineRepository.searchByNormalizedBrandName(normalizedBrandName, limit).stream()
        .filter(Medicine::active)
        .toList();
  }

  private static String normalizeRequired(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("brandName is required");
    }
    return Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKD)
        .replaceAll("\\p{M}", "")
        .replaceAll("[^\\p{L}\\p{N}]+", " ")
        .trim();
  }
}
