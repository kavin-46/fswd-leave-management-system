const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Atlas Connected"))
    .catch((error) => console.log("MongoDB Connection Error:", error));


// Student Schema
const Student = mongoose.model("Student", {
    name: String,
    email: String,
    password: String,
    studentId: { type: String, unique: true },
    casualLeave: { type: Number, default: 10 },
    medicalLeave: { type: Number, default: 10 }
});

// Leave Schema
const Leave = mongoose.model("Leave", {
    studentId: String,
    studentName: String,
    leaveType: String,
    fromDate: String,
    toDate: String,
    days: Number,
    reason: String,
    status: { type: String, default: "Pending" }
});

// Student Registration
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password || password.length < 6) {
            return res.status(400).json({
                message: "Enter all details. Password must have 6 characters."
            });
        }

        const existing = await Student.findOne({ email });

        if (existing) {
            return res.status(400).json({
                message: "Email already registered"
            });
        }

        const studentId = "STU" + Date.now();

        const student = new Student({
            name,
            email,
            password,
            studentId
        });

        await student.save();

        res.json({
            message: "Registration Successful",
            studentId
        });

    } catch (error) {
        res.status(500).json({ message: "Registration Failed" });
    }
});

// Student Login
app.post("/student-login", async (req, res) => {
    try {
        const student = await Student.findOne({
            studentId: req.body.studentId,
            password: req.body.password
        });

        if (!student) {
            return res.status(401).json({
                message: "Invalid Student ID or Password"
            });
        }

        res.json({
            message: "Login Successful",
            student
        });

    } catch (error) {
        res.status(500).json({ message: "Login Failed" });
    }
});

// Teacher Login
app.post("/teacher-login", (req, res) => {

    if (
        req.body.teacherId === "ITSTAFF001" &&
        req.body.password === "12345"
    ) {
        res.json({
            message: "Login Successful"
        });
    } else {
        res.status(401).json({
            message: "Invalid Teacher Login"
        });
    }
});

// Apply Leave
app.post("/apply-leave", async (req, res) => {
    try {
        const {
            studentId,
            leaveType,
            fromDate,
            toDate,
            reason
        } = req.body;

        const student = await Student.findOne({ studentId });

        if (!student) {
            return res.status(404).json({
                message: "Student Not Found"
            });
        }

        if (!["Casual", "Medical"].includes(leaveType)) {
            return res.status(400).json({
                message: "Invalid Leave Type"
            });
        }

        const start = new Date(fromDate + "T00:00:00");
        const end = new Date(toDate + "T00:00:00");

        if (!fromDate || !toDate || isNaN(start) ||
            isNaN(end) || end < start || !reason || !reason.trim()) {
            return res.status(400).json({
                message: "Enter valid leave details"
            });
        }

        const days = Math.round(
            (end - start) / (1000 * 60 * 60 * 24)
        ) + 1;

        const balance = leaveType === "Casual"
            ? student.casualLeave
            : student.medicalLeave;

        if (days > balance) {
            return res.status(400).json({
                message: "Insufficient Leave Balance"
            });
        }

        const overlap = await Leave.findOne({
            studentId,
            status: { $in: ["Pending", "Approved"] },
            fromDate: { $lte: toDate },
            toDate: { $gte: fromDate }
        });

        if (overlap) {
            return res.status(400).json({
                message: "Leave already applied for these dates"
            });
        }

        const leave = new Leave({
            studentId,
            studentName: student.name,
            leaveType,
            fromDate,
            toDate,
            days,
            reason: reason.trim()
        });

        await leave.save();

        res.json({
            message: "Leave Applied Successfully"
        });

    } catch (error) {
        res.status(500).json({ message: "Leave Application Failed" });
    }
});

// Student Dashboard
app.get("/student/:id", async (req, res) => {
    try {
        const student = await Student.findOne({
            studentId: req.params.id
        }).select("-password");

        if (!student) {
            return res.status(404).json({
                message: "Student Not Found"
            });
        }

        const leaves = await Leave.find({
            studentId: req.params.id
        });

        res.json({ student, leaves });

    } catch (error) {
        res.status(500).json({ message: "Unable to Load Details" });
    }
});

// Teacher View All Leaves
app.get("/all-leaves", async (req, res) => {
    try {
        const leaves = await Leave.find().sort({ _id: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: "Unable to Load Applications" });
    }
});

// Teacher Approve or Reject
app.post("/update-leave/:id", async (req, res) => {
    try {
        const { status } = req.body;

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({
                message: "Invalid Status"
            });
        }

        const leave = await Leave.findById(req.params.id);

        if (!leave || leave.status !== "Pending") {
            return res.status(400).json({
                message: "Application Not Available"
            });
        }

        if (status === "Approved") {

            const student = await Student.findOne({
                studentId: leave.studentId
            });

            if (!student) {
                return res.status(404).json({
                    message: "Student Not Found"
                });
            }

            const balance = leave.leaveType === "Casual"
                ? student.casualLeave
                : student.medicalLeave;

            if (leave.days > balance) {
                return res.status(400).json({
                    message: "Insufficient Leave Balance"
                });
            }

            if (leave.leaveType === "Casual") {
                student.casualLeave -= leave.days;
            } else {
                student.medicalLeave -= leave.days;
            }

            await student.save();
        }

        leave.status = status;
        await leave.save();

        res.json({
            message: "Leave " + status + " Successfully"
        });

    } catch (error) {
        res.status(500).json({ message: "Update Failed" });
    }
});

// Start Server
mongoose.connection.once("open", () => {
    app.listen(5000, () => {
        console.log("Server running on port 5000");
    });
});
