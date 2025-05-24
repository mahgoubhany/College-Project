import express from "express";
import bcrypt from "bcrypt";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const port = 3000;
const saltRounds = 10;
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "project",
  password: "123456",
  port: 5432,
});
db.connect();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.get(["/", "/home"], (req, res) => {
  res.render("home.ejs");
});
//getting teacher id from the url and checking on it if it not there so error if its there do qurey to get info and render teacher.ejs
// so it gets data from db
app.get("/teacher/:teacherId", async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    const teacherResult = await db.query(
      "SELECT id, teacher_id, fname, lname, email, department FROM teachers WHERE teacher_id = $1",
      [teacherId]
    );
    if (teacherResult.rows.length === 0) {
      return res
        .status(404)
        .render("error.ejs", { message: "Teacher not found" });
    }
    const teacher = teacherResult.rows[0];
    const coursesResult = await db.query(
      `SELECT c.*, COUNT(sc.student_id) as students_count 
      FROM courses c
      LEFT JOIN student_courses sc ON c.id = sc.course_id
      WHERE c.teacher_id = $1
      GROUP BY c.id`,
      [teacher.id]
    );
    const studentsResult = await db.query(
      `SELECT u.id, u.fname, u.lname, u.email, COUNT(sc.course_id) as course_count
      FROM users u
      JOIN student_courses sc ON u.id = sc.student_id
      WHERE sc.course_id IN (
        SELECT id FROM courses WHERE teacher_id = $1
      )
      GROUP BY u.id`,
      [teacher.id]
    );
    res.render("teacher.ejs", {
      teacher: {
        id: teacher.teacher_id,
        name: `${teacher.fname} ${teacher.lname}`,
        email: teacher.email,
        department: teacher.department,
      },
      courses: coursesResult.rows,
      students: studentsResult.rows,
    });
  } catch (err) {
    console.error("Teacher dashboard error:", err);
    res.status(500).render("error.ejs", { message: "Internal server error" });
  }
});


// app.get("/teacher/:teacherId", async (req, res) => {
//   try {
//     const teacherId = req.params.teacherId;
//     const teacherResult = await db.query(
//       "SELECT id, teacher_id, fname, lname, email, department FROM teachers WHERE teacher_id = $1",
//       [teacherId]
//     );
//     if (teacherResult.rows.length === 0) {
//       return res
//         .status(404)
//         .render("error.ejs", { message: "Teacher not found" });
//     }
//     const teacher = teacherResult.rows[0];
//     const coursesResult = await db.query(
//       `SELECT c.*, COUNT(sc.student_id) as students_count 
//       FROM courses c
//       LEFT JOIN student_courses sc ON c.id = sc.course_id
//       WHERE c.teacher_id = $1
//       GROUP BY c.id`,
//       [teacher.id]
//     );
//     const studentsResult = await db.query(
//       `SELECT u.id, u.fname, u.lname, u.email, COUNT(sc.course_id) as course_count
//       FROM users u
//       JOIN student_courses sc ON u.id = sc.student_id
//       WHERE sc.course_id IN (
//         SELECT id FROM courses WHERE teacher_id = $1
//       )
//       GROUP BY u.id`,
//       [teacher.id]
//     );
//     res.render("teacher.ejs", {
//       teacher: {
//         id: teacher.teacher_id,
//         name: `${teacher.fname} ${teacher.lname}`,
//         email: teacher.email,
//         department: teacher.department,
//       },
//       courses: coursesResult.rows,
//       students: studentsResult.rows,
//     });
//   } catch (err) {
//     console.error("Teacher dashboard error:", err);
//     res.status(500).render("error.ejs", { message: "Internal server error" });
//   }
// });
//for student login and make the output in the student.ejs page
app.get("/student/:studentId", async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (isNaN(studentId)) {
      return res
        .status(400)
        .render("error.ejs", { message: "Invalid student ID" });
    }
    const studentResult = await db.query(
      "SELECT id, email, fname, lname FROM users WHERE id = $1 AND role = 'user'",
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res
        .status(404)
        .render("error.ejs", { message: "Student not found" });
    }
    const student = studentResult.rows[0];
    const coursesResult = await db.query(
      `SELECT 
        c.id,
        c.course_code,
        c.course_name,
        c.credits,
        c.description,
        t.fname AS teacher_fname,
        t.lname AS teacher_lname,
        t.id AS teacher_id
      FROM courses c
      JOIN student_courses sc ON c.id = sc.course_id
      JOIN teachers t ON c.teacher_id = t.id
      WHERE sc.student_id = $1`,
      [student.id]
    );
    const teachersResult = await db.query(
      `SELECT 
        t.id,
        t.fname,
        t.lname,
        COUNT(c.id) AS courses_count
      FROM teachers t
      JOIN courses c ON t.id = c.teacher_id
      JOIN student_courses sc ON c.id = sc.course_id
      WHERE sc.student_id = $1
      GROUP BY t.id`,
      [student.id]
    );
    const courses = coursesResult.rows.map((course) => ({
      id: course.id,
      code: course.course_code,
      name: course.course_name,
      credits: course.credits,
      description: course.description,
      teacher: `${course.teacher_fname} ${course.teacher_lname}`,
      teacher_id: course.teacher_id,
    }));
    const teachers = teachersResult.rows.map((teacher) => ({
      id: teacher.id,
      name: `${teacher.fname} ${teacher.lname}`,
      courses_count: teacher.courses_count,
    }));
    res.render("student.ejs", {
      student: {
        id: student.id,
        firstname: student.fname,
        lastname: student.lname,
        email: student.email,
      },
      courses: courses,
      teachers: teachers,
    });
  } catch (err) {
    console.error("Student dashboard error:", err);
    res.status(500).render("error.ejs", {
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});
app.use(express.json());

//wasiiiiiiiiiiiiiiiiiiiiiimmmmmmmmmmmmmmmmmmmmmmmmmmm
//this is for the update info in students
app.post("/student/:studentId/update", async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const { fname, lname, email, password } = req.body;
    if (isNaN(studentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid student ID" });
    }
    if (!fname || !lname || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }
    const emailCheck = await db.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [email, studentId]
    );
    if (emailCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email already in use" });
    }
    let query = "UPDATE users SET fname = $1, lname = $2, email = $3";
    let params = [fname, lname, email];
    if (password && password.length >= 8) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ", password = $4 WHERE id = $5 RETURNING *";
      params.push(hashedPassword, studentId);
    } else if (password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be at least 8 characters",
        });
    } else {
      query += " WHERE id = $4 RETURNING *";
      params.push(studentId);
    }
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }
    res.json({
      success: true,
      student: {
        id: result.rows[0].id,
        firstname: result.rows[0].fname,
        lastname: result.rows[0].lname,
        email: result.rows[0].email,
      },
    });
  } catch (err) {
    console.error("Student update error:", err);
    // res.status(500).json({
    //   success: false,
    //   message: "Internal server error",
    //   error: process.env.NODE_ENV === "development" ? err.message : undefined,
    res.status(500).json({
  success: false,
  message: "Internal server error",
  error: err.message, // Force showing real error

    });
  }
});

app.get(["/", "/home"], (req, res) => {
  res.render("home.ejs");
});
app.get("/teacher", (req, res) => {
  res.render("teacher.ejs");
});
app.get("/student_login", (req, res) => {
  res.render("student_login.ejs", { error: null });
});
app.get("/student_register", (req, res) => {
  res.render("student_register.ejs", { error: null });
});
app.get("/staff_login", (req, res) => {
  res.render("staff_login.ejs", { error: null });
});
app.get("/admin_login", (req, res) => {
  res.render("admin_login.ejs", { error: null });
});
app.get("/student", (req, res) => {
  res.redirect("/student_login");
});

//to rendder admin data
app.get("/admin", async (req, res) => {
  try {
    const data = await getAdminData();
    res.render("admin.ejs", data);
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).render("error.ejs", {
      message: "Internal server error",
    });
  }
});

app.set("view engine", "ejs");
async function getAdminData() {
  try {
    const [students, teachers, courses] = await Promise.all([
      db.query("SELECT id, fname, lname, email FROM users WHERE role = 'user'"),
      db.query(
        "SELECT id, teacher_id, fname, lname, email, department FROM teachers"
      ),
      db.query(`
        SELECT c.*, t.fname as teacher_fname, t.lname as teacher_lname 
        FROM courses c 
        LEFT JOIN teachers t ON c.teacher_id = t.id
      `),
    ]);
    //Returns all fetched data in an object, so the route /admin can pass it directly into the EJS template.
    return {
      students: students.rows,
      teachers: teachers.rows,
      courses: courses.rows,
    };
  } catch (err) {
    console.error("Error fetching admin data:", err);
    throw err;
  }
}
app.get(["/", "/home"], (req, res) => {
  res.render("home.ejs");
});

// app.get("/teacher/:teacherId", async (req, res) => {
//   try {
//     const teacherId = req.params.teacherId;
//     const teacherResult = await db.query(
//       "SELECT id, teacher_id, fname, lname, email, department FROM teachers WHERE teacher_id = $1",
//       [teacherId]
//     );
//     if (teacherResult.rows.length === 0) {
//       return res
//         .status(404)
//         .render("error.ejs", { message: "Teacher not found" });
//     }
//     const teacher = teacherResult.rows[0];
//     const coursesResult = await db.query(
//       `SELECT c.*, COUNT(sc.student_id) as students_count 
//       FROM courses c
//       LEFT JOIN student_courses sc ON c.id = sc.course_id
//       WHERE c.teacher_id = $1
//       GROUP BY c.id`,
//       [teacher.id]
//     );
//     const studentsResult = await db.query(
//       `SELECT u.id, u.fname, u.lname, u.email, COUNT(sc.course_id) as course_count
//       FROM users u
//       JOIN student_courses sc ON u.id = sc.student_id
//       WHERE sc.course_id IN (
//         SELECT id FROM courses WHERE teacher_id = $1
//       )
//       GROUP BY u.id`,
//       [teacher.id]
//     );
//     res.render("teacher.ejs", {
//       teacher: {
//         id: teacher.teacher_id,
//         name: `${teacher.fname} ${teacher.lname}`,
//         email: teacher.email,
//         department: teacher.department,
//       },
//       courses: coursesResult.rows,
//       students: studentsResult.rows,
//     });
//   } catch (err) {
//     console.error("Teacher dashboard error:", err);
//     res.status(500).render("error.ejs", { message: "Internal server error" });
//   }
// });
//wasiiiiiiiiiiiiiiiiiiiimmmmmmmmmmmmmmmmmmmmmmm
//for updating teacher info in teacher ejs
app.post("/teacher/:teacherId/update", async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    const { fname, lname, email, department } = req.body;
    await db.query(
      "UPDATE teachers SET fname = $1, lname = $2, email = $3, department = $4 WHERE teacher_id = $5",
      [fname, lname, email, department, teacherId]
    );
    await db.query(
      "UPDATE staff SET email = $1, fname = $2, lname = $3 WHERE email = (SELECT email FROM teachers WHERE teacher_id = $4)",
      [email, fname, lname, teacherId]
    );
    res.json({
      success: true,
      teacher: {
        id: teacherId,
        name: `${fname} ${lname}`,
        email,
        department,
      },
    });
  } catch (error) {
    console.error("Error updating teacher:", error);
    res.status(500).json({ success: false, message: "Error updating teacher" });
  }
});

//insert data into the database and after this redirect me to the login page
app.post("/student_register", async (req, res) => {
  const { username: email, password, fname, lname } = req.body;
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (checkResult.rows.length > 0) {
      return res.render("student_register.ejs", {
        error: "Email already exists. Try logging in.",
      });
    }
    const hash = await bcrypt.hash(password, saltRounds);
    await db.query(
      "INSERT INTO users (email, password, fname, lname, role) VALUES ($1, $2, $3, $4, 'user')",
      [email, hash, fname, lname]
    );
    res.redirect("/student_login");
  } catch (err) {
    console.error("Registration error:", err);
    res.render("student_register.ejs", {
      error: "Registration failed. Please try again.",
    });
  }
});
//to post the email,password the user try to log in with 
app.post("/student_login", async (req, res) => {
  const { username: email, password } = req.body;
  try {
    const userResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (userResult.rows.length === 0) {
      return res.render("student_login.ejs", { error: "User not found" });
    }
    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.render("student_login.ejs", { error: "Incorrect password" });
    }
    const coursesResult = await db.query(
      `SELECT c.id, c.course_name as name, c.course_code as code, 
              CONCAT(t.fname, ' ', t.lname) as teacher
       FROM courses c
       JOIN student_courses sc ON c.id = sc.course_id
       JOIN teachers t ON c.teacher_id = t.id
       WHERE sc.student_id = $1`,
      [user.id]
    );
    const teachersResult = await db.query(
      `SELECT DISTINCT t.id, CONCAT(t.fname, ' ', t.lname) as name,
              COUNT(c.id) as courses_count
       FROM teachers t
       JOIN courses c ON t.id = c.teacher_id
       JOIN student_courses sc ON c.id = sc.course_id
       WHERE sc.student_id = $1
       GROUP BY t.id`,
      [user.id]
    );
    // response with the studentejs that has object that i will return the object values in the student,ejs
    res.render("student.ejs", {
      student: {
        id: user.id,
        firstname: user.fname,
        lastname: user.lname,
        email: user.email,
      },
      courses: coursesResult.rows || [],
      teachers: teachersResult.rows || [],
    });
  } catch (err) {
    console.error("Login error:", err);
    res.render("student_login.ejs", {
      error: "Login failed. Please try again.",
    });
  }
});

//post staf or insert info to the staff log in 
app.post("/staff_login", async (req, res) => {
  const { email, staffId } = req.body;
  try {
    const staffResult = await db.query(
      "SELECT * FROM staff WHERE email = $1 AND staff_id = $2",
      [email, staffId]
    );
    if (staffResult.rows.length === 0) {
      return res.render("staff_login.ejs", {
        error: "Invalid credentials. Please check your email and staff ID.",
      });
    }
    const staff = staffResult.rows[0];

    if (staff.role === "teacher") {
      const teacherResult = await db.query(
        "SELECT teacher_id FROM teachers WHERE email = $1",
        [email]
      );
      if (teacherResult.rows.length > 0) {
        // redirect me to the /teacher with id = the id given 
        return res.redirect(`/teacher/${teacherResult.rows[0].teacher_id}`);
      }
    }
    res.render("home.ejs", { user: { email: staff.email, role: "staff" } });
  } catch (err) {
    console.error("Staff login error:", err);
    res.render("staff_login.ejs", { error: "Login failed. Please try again." });
  }
});

//same logic as above
app.post("/admin_login", async (req, res) => {
  const { username: email, password } = req.body;
  try {
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const data = await getAdminData();
      return res.render("admin.ejs", data);
    }
    res.render("admin_login.ejs", { error: "Invalid admin credentials" });
  } catch (err) {
    console.error("Admin login error:", err);
    res.render("admin_login.ejs", { error: "Login failed. Please try again." });
  }
});

app.post("/admin/add-teacher", async (req, res) => {
  const { teacherId, fname, lname, email, department, staffId } = req.body;

  try {
    await db.query(
      "INSERT INTO teachers (teacher_id, fname, lname, email, department) VALUES ($1, $2, $3, $4, $5)",
      [teacherId, fname, lname, email, department]
    );

    await db.query(
      "INSERT INTO staff (email, staff_id, fname, lname, role) VALUES ($1, $2, $3, $4, 'teacher')",
      [email, staffId, fname, lname]
    );

    res.redirect("/admin");
  } catch (err) {
    console.error("Add teacher error:", err);
    const data = await getAdminData();
    res.render("admin.ejs", {
      ...data,
      error:
        "Error adding teacher. Teacher ID, staff ID or email might already exist.",
    });
  }
});

app.post("/admin/remove-student/:id", async (req, res) => {
  const studentId = req.params.id;
  try {
    await db.query("DELETE FROM student_courses WHERE student_id = $1", [
      studentId,
    ]);
    await db.query("DELETE FROM users WHERE id = $1 AND role = 'user'", [
      studentId,
    ]);
    res.redirect("/admin");
  } catch (err) {
    console.error("Remove student error:", err);
    const data = await getAdminData();
    res.render("admin.ejs", {
      ...data,
      error: "Error removing student",
    });
  }
});

app.post("/admin/add-course", async (req, res) => {
  const { courseCode, courseName, teacherId, credits, description } = req.body;
  try {
    await db.query(
      "INSERT INTO courses (course_code, course_name, teacher_id, credits, description) VALUES ($1, $2, $3, $4, $5)",
      [courseCode, courseName, teacherId, credits, description]
    );
    res.redirect("/admin");
  } catch (err) {
    console.error("Add course error:", err);
    const data = await getAdminData();
    res.render("admin.ejs", {
      ...data,
      error: "Error adding course. Course code might already exist.",
    });
  }
});

app.post("/admin/assign-course", async (req, res) => {
  const { courseId, teacherId } = req.body;
  try {
    await db.query("UPDATE courses SET teacher_id = $1 WHERE id = $2", [
      teacherId,
      courseId,
    ]);
    res.redirect("/admin");
  } catch (err) {
    console.error("Assign course error:", err);
    const data = await getAdminData();
    res.render("admin.ejs", {
      ...data,
      error: "Error assigning course",
    });
  }
});
// idk what does this do
// app.post("/staff_login", async (req, res) => {
//   const { username: email, password } = req.body;
//   try {
//     const staffResult = await db.query("SELECT * FROM staff WHERE email = $1", [
//       email,
//     ]);
//     if (staffResult.rows.length === 0) {
//       return res.render("staff_login.ejs", { error: "Staff not found" });
//     }
//     const staff = staffResult.rows[0];
//     const passwordMatch = await bcrypt.compare(password, staff.password);
//     if (!passwordMatch) {
//       return res.render("staff_login.ejs", { error: "Incorrect password" });
//     }
//     if (staff.role === "teacher") {
//       const teacherResult = await db.query(
//         "SELECT teacher_id FROM teachers WHERE email = $1",
//         [email]
//       );
//       if (teacherResult.rows.length > 0) {
//         return res.redirect(`/teacher/${teacherResult.rows[0].teacher_id}`);
//       }
//     }
//     res.render("home.ejs", { user: { email: staff.email, role: "staff" } });
//   } catch (err) {
//     console.error("Staff login error:", err);
//     res.render("staff_login.ejs", { error: "Login failed. Please try again." });
//   }
// });
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
