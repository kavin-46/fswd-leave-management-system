
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

const leaveSchema = new mongoose.Schema({
    studentName: String,
    leaveType: String,
    fromDate: String,
    toDate: String,
    days: Number,
    reason: String,
    status: {
        type: String,
        default: "Pending"
    }
});

const Leave = mongoose.model("Leave", leaveSchema);

const balances = {
    "Casual Leave": 12,
    "Medical Leave": 10
};

app.get("/", (req, res) => {
    res.send("Leave Management System Backend Running");
});

app.get("/leaves", async (req, res) => {
    const leaves = await Leave.find();
    res.json(leaves);
});

app.post("/leaves", async (req, res) => {
    try {
        const { studentName, leaveType, fromDate, toDate, reason } = req.body;

        if (!studentName || !leaveType || !fromDate || !toDate || !reason) {
            return res.status(400).json({ message: "Fill all fields" });
        }

        const start = new Date(fromDate);
        const end = new Date(toDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
            return res.status(400).json({ message: "Invalid leave dates" });
        }

        const days = Math.floor((end - start) / 86400000) + 1;

        const leave = new Leave({
            studentName,
            leaveType,
            fromDate,
            toDate,
            days,
            reason
        });

        await leave.save();

        res.status(201).json({
            message: "Leave application submitted",
            leave
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

app.patch("/leaves/:id", async (req, res) => {
    try {
        const { status } = req.body;

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        if (leave.status !== "Pending") {
            return res.status(400).json({ message: "Request already reviewed" });
        }

        if (status === "Approved") {
            const usedDays = await Leave.aggregate([
                {
                    $match: {
                        studentName: leave.studentName,
                        leaveType: leave.leaveType,
                        status: "Approved"
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$days" }
                    }
                }
            ]);

            const used = usedDays.length ? usedDays[0].total : 0;
            const available = balances[leave.leaveType] - used;

            if (leave.days > available) {
                return res.status(400).json({
                    message: "Insufficient leave balance"
                });
            }
        }

        leave.status = status;
        await leave.save();

        res.json({
            message: "Leave " + status.toLowerCase(),
            leave
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/balance/:studentName", async (req, res) => {
    try {
        const leaves = await Leave.find({
            studentName: req.params.studentName,
            status: "Approved"
        });

        const result = {
            "Casual Leave": balances["Casual Leave"],
            "Medical Leave": balances["Medical Leave"]
        };

        leaves.forEach(leave => {
            result[leave.leaveType] -= leave.days;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

app.listen(process.env.PORT || 5000, () => {
    console.log("Server running on port 5000");
});

