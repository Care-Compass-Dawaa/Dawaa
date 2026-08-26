package com.dawaa.domain.pharmacy;

import java.util.List;
import java.util.Optional;

public interface PharmacyRepository {
  Pharmacy save(Pharmacy pharmacy);

  Pharmacy update(Pharmacy pharmacy);

  Optional<Pharmacy> findById(String pharmacyId);

  Optional<Pharmacy> findByOwnerUserId(String ownerUserId);

  List<Pharmacy> findAll();

  void updateApproval(String pharmacyId, boolean approved);
}
