-- ANONYMOUS QUESTION SUBMISSION - DATABASE SCHEMA

CREATE DATABASE IF NOT EXISTS anonymous_qa_db;
USE anonymous_qa_db;

-- 1. DROP TABLES IN REVERSE DEPENDENCY ORDER
DROP TABLE IF EXISTS Interactions;
DROP TABLE IF EXISTS Tags;
DROP TABLE IF EXISTS Questions;
DROP TABLE IF EXISTS Sessions;
DROP TABLE IF EXISTS Enrollments;
DROP TABLE IF EXISTS Classes;
DROP TABLE IF EXISTS Users;

-- 2. CREATE TABLES IN STRICT DEPENDENCY ORDER

CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Student', 'Instructor') NOT NULL
);

CREATE TABLE Classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    instructor_id INT NOT NULL,
    join_code VARCHAR(10) NOT NULL UNIQUE,
    FOREIGN KEY (instructor_id) REFERENCES Users(user_id)
);

CREATE TABLE Enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    class_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (class_id) REFERENCES Classes(class_id),
    UNIQUE(user_id, class_id) -- Prevents a student from joining the same class twice
);

CREATE TABLE Sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    session_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    FOREIGN KEY (class_id) REFERENCES Classes(class_id)
);

CREATE TABLE Questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id INT NOT NULL, -- Changed from class_id to tie directly to the lecture
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Pending', 'Displayed', 'Answered', 'Rejected') DEFAULT 'Pending', -- Replaced boolean for more flexibility
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (session_id) REFERENCES Sessions(session_id)
);

CREATE TABLE Tags (
    tag_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    tag_name VARCHAR(50) NOT NULL, -- Removed UNIQUE so multiple questions can be 'Urgent'
    FOREIGN KEY (question_id) REFERENCES Questions(question_id)
);

CREATE TABLE Interactions (
    interaction_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    user_id INT NOT NULL, -- To prevent the same student from upvoting 50 times
    interaction_type ENUM('Upvote', 'Displayed_On_Board') NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES Questions(question_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    UNIQUE(question_id, user_id, interaction_type) -- Ensures 1 upvote per student per question
);