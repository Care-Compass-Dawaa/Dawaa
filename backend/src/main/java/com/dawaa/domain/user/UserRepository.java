package com.dawaa.domain.user;

import java.util.List;
import java.util.Optional;
//or just use import of java.util.*; 

public interface UserRepository {
    Optional<User> findById(String userId);

    Optional<User> findByEmail(String email);

    User save(User user); //add a user in the table

    List<User> findAll();
    
    User update(User user); //update information of a user
    
    void deactivate(String userId); //delete/deactivate user in table
}
