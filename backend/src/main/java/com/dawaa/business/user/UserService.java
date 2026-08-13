package com.dawaa.business.user;

import com.dawaa.domain.user.*;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository){
        this.userRepository = 
            Objects.requireNonNull(userRepository, "userRepository is required.");
    }

    private static boolean isEmpty(String value){
        return value==null || value.isBlank();
    }

    public User registerUser(User user){
        if( isEmpty(user.email())||
            isEmpty(user.name())||
            isEmpty(user.passwordHash())||
            isEmpty(user.createdAt())||
            isEmpty(user.updatedAt())||
            user.role()==null)
            //user.active()==null|| you don't check this because "boolean" is a primitive type and is guaranteed
            //to either be true/false. but "Boolean" can be null (the upper case one cause it's the main class)
            {
                throw new IllegalArgumentException("all User fields are required");
            }

        Optional<User> existingUser = userRepository.findByEmail(user.email());
        if (existingUser.isPresent()) { //returns true if user already exists
            throw new IllegalArgumentException("An account with this email already exists");
        }

        String now = Instant.now().toString();
        String userId = !isEmpty(user.userId())? user.userId().trim()
                : "USER#" + UUID.randomUUID();
        //replaces user id if not found

        User newUser = new User(
            user.userId().trim(),
            user.email().trim(),
            user.name().trim(),
            UserRole.PATIENT,
            user.passwordHash(),
            true,
            now,
            now
        );

        return userRepository.save(newUser);
        //save user if no account with this email exists
    }

    public static void requireAdmin(User requester){
        if (requester == null || requester.role()!=UserRole.ADMIN){
            throw new IllegalArgumentException("Admin access is required.");
        }
    } 

    public User getById(User requester, String userId){
        requireAdmin(requester); //requester has to be an admin
        if (isEmpty(userId)){
            throw new IllegalArgumentException("userId is required");
        }
        return userRepository.findById(userId.trim())
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
    
    public User getByEmail(User requester, String userEmail){
        requireAdmin(requester); //requester has to be an admin
        if (isEmpty(userEmail)){
            throw new IllegalArgumentException("userEmail is required");
        }
        return userRepository.findByEmail(userEmail.trim())
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public List<User> getAllUsers(User requester){
        requireAdmin(requester);
        return userRepository.findAll();
    }

    public User updateUser(User requester, String name, String email){
        if (requester==null){
            throw new IllegalArgumentException("Requester is required");
        }

        if (isEmpty(name)){
            throw new IllegalArgumentException("name is required");
        }

        if (isEmpty(email)){
            throw new IllegalArgumentException("email is required");
        }

        String normalizedEmail = email.trim().toLowerCase();
        Optional<User> existingUser = userRepository.findByEmail(normalizedEmail);
        if (existingUser.isPresent() && !existingUser.get().userId().equals(requester.userId())){
            throw new IllegalArgumentException("Email is already used by another account");
        }

        User updatedUser = new User(
            requester.userId(),
            normalizedEmail,
            name.trim(),
            requester.role(),
            requester.passwordHash(),
            requester.active(),
            requester.createdAt(),
            Instant.now().toString());

        return userRepository.update(updatedUser);
    }

    public void deactivateUser(User requester, String userId){
        requireAdmin(requester);//person should be an admin to deactivate someone
        
        if (isEmpty(userId)) {//if user id is missing, throw exception
            throw new IllegalArgumentException("userId is required");
        }

        if (!userRepository.findById(userId.trim()).isPresent()) { //if user not present, throw exception
            throw new IllegalArgumentException("User not found");
        }

        userRepository.deactivate(userId.trim());
    }


}
