package com.dawaa.domain.medicine;

import java.util.List;
import java.util.Optional;

public interface MedicineRepository {
  Optional<Medicine> findByNormalizedBrandName(String normalizedBrandName);

  List<Medicine> searchByNormalizedBrandName(String normalizedBrandName, int limit);
}
