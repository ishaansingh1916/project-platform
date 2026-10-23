import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const p = await api("/projects?limit=50");
        setProjects(p.data);
        const all = [];
        for (let i = 0; i < p.data.length; i++) {
          const t = await api("/projects/" + p.data[i]._id + "/tasks?assignee=me&limit=100");
          for (let j = 0; j < t.data.length; j++) {
            all.push({ ...t.data[j], projectName: p.data[i].name });
          }
        }
        setMyTasks(all);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  const openTasks = myTasks.filter((t) => t.status !== "done");
  const doneTasks = myTasks.filter((t) => t.status === "done");
  const activeProjects = projects.filter((p) => p.status === "active");

  return (
    <div>
      <h2>Dashboard</h2>
      {error && <p className="error">{error}</p>}
      <div className="cards">
        <div className="card">Projects<b>{projects.length}</b></div>
        <div className="card">Active projects<b>{activeProjects.length}</b></div>
        <div className="card">My open tasks<b>{openTasks.length}</b></div>
        <div className="card">My completed tasks<b>{doneTasks.length}</b></div>
      </div>

      <h3>My open tasks</h3>
      {openTasks.length === 0 && <p className="muted">No open tasks assigned to you.</p>}
      <table>
        <tbody>
          {openTasks.map((t) => (
            <tr key={t._id}>
              <td><Link to={"/tasks/" + t._id}>{t.title}</Link></td>
              <td>{t.projectName}</td>
              <td>{t.status}</td>
              <td>{t.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}