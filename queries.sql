CREATE TABLE users(
id SERIAL PRIMARY KEY ,
email VARCHAR(100) NOT NULL UNIQUE,
password VARCHAR(100) ,
fname VARCHAR(100),
lname VARCHAR(100),
role VARCHAR(20) DEFAULT 'user'
);

CREATE TABLE staff(
    id SERIAL PRIMARY KEY ,
    email VARCHAR(100) NOT NULL UNIQUE,
    staff_id VARCHAR(50) UNIQUE NOT NULL,
    fname VARCHAR(100),
    lname VARCHAR(100),
    role VARCHAR(20) DEFAULT 'staff'
);

CREATE TABLE teachers (
    id SERIAL PRIMARY KEY,
    teacher_id VARCHAR(20) UNIQUE NOT NULL,
    fname VARCHAR(100) NOT NULL,
    lname VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(100)
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    course_name VARCHAR(100) NOT NULL,
    teacher_id INTEGER REFERENCES teachers(id),
    credits INTEGER NOT NULL,
    description TEXT
);

CREATE TABLE student_courses (
    student_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    PRIMARY KEY (student_id, course_id)
);

