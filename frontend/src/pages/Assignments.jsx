import React, { useEffect, useState } from "react";
import axios from "axios";

const Assignment = () => {
  const [form, setForm] = useState({
    staff_name: "",
    room_number: "",
    task: "",
  });

  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats,setstats] =useState({});
  const [editId,setEditId]=useState(null);


  const API = "http://localhost:5001/api";
  const role=localStorage.getItem("role");

  // ================= LOAD USERS =================
  const loadUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // ================= LOAD ASSIGNMENTS =================
 // ================= LOAD ASSIGNMENTS =================
const loadAssignments = async () => {
  try {
    const res = await axios.get(
      `${API}/assignments?role=${localStorage.getItem("role")}&name=${localStorage.getItem("name")}`
    );
    setAssignments(res.data);
  } catch (err) {
    console.log(err);
  }
};
 // Load stats
 const loadStats=async()=>{
  try{
    const res = await axios.get(`${API}/assignments/stats`);
    setstats(res.data);

  }catch(err){
    console.log(err);
  }
 }




  useEffect(() => {
    loadUsers();
    loadAssignments();
    loadStats();

  }, []);

  // ================= HANDLE CHANGE =================
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ================= SUBMIT =================
  const handleSubmit = async (e) => {
    e.preventDefault();

 try {
      if (editId) {
        await axios.put(`${API}/assignments/edit/${editId}`, form);
        setEditId(null);
      } else {
        await axios.post(`${API}/assignments`, {
          ...form,
          assigned_by: localStorage.getItem("name"),
        });
      }

      setForm({
        staff_name: "",
        room_number: "",
        task: "",
      });

      loadAssignments();
      loadStats();
    } catch (err) {
      console.log(err);
      alert("Error assigning task");
    }
  };

  // ================= MARK COMPLETE =================
  const markComplete = async (id) => {
    try {
      await axios.put(`${API}/assignments/${id}`, {
        status: "Completed",
      });

      loadAssignments();
      loadStats();

    } catch (err) {
      console.log(err);
    }
  };
  // ================= DELETE =================
  const deleteTask = async (id) => {
    try {
      await axios.delete(`${API}/assignments/${id}`);
      loadAssignments();
      loadStats();
    } catch (err) {
      console.log(err);
    }
  };

// ================= EDIT =================
  const editTask = (task) => {
    setForm({
      staff_name: task.staff_name,
      room_number: task.room_number,
      task: task.task,
    });
    setEditId(task.id);
  };



  return (
    <div className="p-6">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-6 rounded-2xl shadow-lg mb-6">
        <h2 className="text-2xl font-bold">Task Assignment</h2>
        <p className="text-sm opacity-90">
          Assign tasks to staff members and track completion
        </p>
      </div>
      
      {/*stats */}
       <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded-xl shadow">
          <h4 className="font-semibold">Total Tasks</h4>
          <p className="text-2xl font-bold">{stats.total || 0}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-xl shadow">
          <h4 className="font-semibold">Completed</h4>
          <p className="text-2xl font-bold">{stats.completed || 0}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded-xl shadow">
          <h4 className="font-semibold">Pending</h4>
          <p className="text-2xl font-bold">{stats.pending || 0}</p>
        </div>
      </div>

      {role !== "housekeeping" && (
<div className="bg-white rounded-2xl shadow-md p-6 mb-8">
  <h3 className="text-lg font-semibold mb-4">Assign New Task</h3>

  <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4">

    <select
      name="staff_name"
      value={form.staff_name}
      onChange={handleChange}
      className="border rounded-lg p-2 focus:ring-2 focus:ring-indigo-400"
      required
    >
      <option value="">Select Staff</option>

      {users
        .filter((u) => u.role === "Housekeeping")
        .map((u) => (
          <option key={u.id} value={u.name}>
            {u.name} ({u.role})
          </option>
        ))}
    </select>

    <input
      type="text"
      name="room_number"
      placeholder="Room Number"
      value={form.room_number}
      onChange={handleChange}
      className="border rounded-lg p-2"
      required
    />

    <input
      type="text"
      name="task"
      placeholder="Task"
      value={form.task}
      onChange={handleChange}
      className="border rounded-lg p-2"
      required
    />

    <button
      type="submit"
      className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-4 py-2 font-semibold"
    >
      {editId ? "Update Task" : "Assign Task"}
    </button>

  </form>
</div>
)}

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Assigned Tasks</h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Staff</th>
                <th className="p-3">Room</th>
                <th className="p-3">Task</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assigned By</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {assignments.map((a) => (
                <tr
                  key={a.id}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="p-3 font-medium">{a.staff_name}</td>
                  <td className="p-3">{a.room_number}</td>
                  <td className="p-3">{a.task}</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold
                        ${
                          a.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                    >
                      {a.status}
                    </span>
                  </td>

                  <td className="p-3">{a.assigned_by}</td>

                  <td className="p-3">
                    {a.status !== "Completed" && (
                      <button
                        onClick={() => markComplete(a.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm"
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {assignments.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center p-4 text-gray-500">
                    No tasks assigned yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Assignment;