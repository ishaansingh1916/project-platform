import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [managers, setManagers] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", managerId: "" });
  const [error, setError] = useState("");
  const limit = 6;

  async function load() {
    try {
      const query =
        "?page=" + page + "&limit=" + limit +
        "&search=" + encodeURIComponent(search) + "&status=" + status;
      const res = await api("/projects" + query);
      setProjects(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [page, search, status]);

  useEffect(() => {
    if (user.role === "admin") {
      api("/users/directory").then((list) =>
        setManagers(list.filter((u) => u.role === "project_manager"))
      );
    }
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.managerId) {
      setError("Project name and a manager are required");
      return;
    }
    try {
      await api("/projects", "POST", form);
      setForm({ name: "", description: "", managerId: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this project with all its tasks?")) return;
    try {
      await api("/projects/" + id, "DELETE");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <h2>Projects</h2>
      {error && <p className="error">{error}</p>}

      {user.role === "admin" && (
        <form onSubmit={handleCreate} className="row box">
          <input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
            <option value="">Select manager</option>
            {managers.map((m) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
          <button type="submit">Create project</button>
        </form>
      )}

      <div className="row">
        <input placeholder="Search projects..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {projects.length === 0 && <p className="muted">No projects found.</p>}
      <div className="cards">
        {projects.map((p) => (
          <div className="card" key={p._id}>
            <Link to={"/projects/" + p._id}><b style={{ fontSize: 18 }}>{p.name}</b></Link>
            <span className="muted">{p.description}</span>
            <span>Status: {p.status} | Members: {p.members.length}</span>
            {user.role === "admin" && (
              <button onClick={() => handleDelete(p._id)}>Delete</button>
            )}
          </div>
        ))}
      </div>

      <div className="row">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {lastPage}</span>
        <button disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}