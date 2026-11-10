
const API = "http://localhost:5000";

const form = document.getElementById("leaveForm");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const studentName = document.getElementById("studentName").value.trim();
    const leaveType = document.getElementById("leaveType").value;
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;
    const reason = document.getElementById("reason").value.trim();

    if (toDate < fromDate) {
        alert("To Date must be after From Date");
        return;
    }

    const response = await fetch(API + "/leaves", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            studentName,
            leaveType,
            fromDate,
            toDate,
            reason
        })
    });

    const data = await response.json();

    if (!response.ok) {
        alert(data.message);
        return;
    }

    alert("Leave application submitted successfully!");
    form.reset();
    loadLeaves(studentName);
});

async function loadLeaves(studentName = "") {
    const response = await fetch(API + "/leaves");
    const leaves = await response.json();

    const studentTable = document.getElementById("studentLeaves");
    const teacherTable = document.getElementById("teacherLeaves");

    studentTable.innerHTML = "";
    teacherTable.innerHTML = "";

    leaves.forEach(leave => {
        if (!studentName || leave.studentName === studentName) {
            studentTable.innerHTML += `
                <tr>
                    <td>${leave.leaveType}</td>
                    <td>${leave.fromDate}</td>
                    <td>${leave.toDate}</td>
                    <td>${leave.days}</td>
                    <td>${leave.status}</td>
                </tr>
            `;
        }

        teacherTable.innerHTML += `
            <tr>
                <td>${leave.studentName}</td>
                <td>${leave.leaveType}</td>
                <td>${leave.fromDate} to ${leave.toDate}</td>
                <td>${leave.reason}</td>
                <td>${leave.status}</td>
                <td>
                    ${
                        leave.status === "Pending"
                        ? `<button class="approve" onclick="updateLeave('${leave._id}', 'Approved')">Approve</button>
                           <button class="reject" onclick="updateLeave('${leave._id}', 'Rejected')">Reject</button>`
                        : leave.status
                    }
                </td>
            </tr>
        `;
    });

    if (studentName) {
        loadBalance(studentName);
    }
}

async function updateLeave(id, status) {
    const response = await fetch(API + "/leaves/" + id, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
    });

    const data = await response.json();

    alert(data.message);

    if (response.ok) {
        loadLeaves();
    }
}

async function loadBalance(studentName) {
    const response = await fetch(
        API + "/balance/" + encodeURIComponent(studentName)
    );

    const balance = await response.json();

    document.getElementById("casualDays").textContent =
        balance["Casual Leave"];

    document.getElementById("medicalDays").textContent =
        balance["Medical Leave"];
}

document.getElementById("studentName").addEventListener("change", function () {
    const name = this.value.trim();

    if (name) {
        loadLeaves(name);
    }
});

loadLeaves();

