package com.dawaa.domain.medicine;

import java.util.List;
import java.util.Optional;

public interface MedicineRepository {
  Optional<Medicine> findByNormalizedBrandName(String normalizedBrandName);

  Optional<Medicine> findByNormalizedGenericName(String normalizedGenericName);

  List<Medicine> searchByNormalizedBrandName(String normalizedBrandName, int limit);

  List<Medicine> searchByNormalizedGenericName(String normalizedGenericName, int limit);
}
