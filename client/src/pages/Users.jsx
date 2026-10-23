import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "team_member" });
  const [error, setError] = useState("");
  const limit = 10;

  async function load() {
    try {
      const res = await api("/users?page=" + page + "&limit=" + limit + "&role=" + roleFilter);
      setUsers(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (user.role === "admin") load();
  }, [page, roleFilter]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/users", "POST", form);
      setForm({ name: "", email: "", password: "", role: "team_member" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRole(id, role) {
    setError("");
    try {
      await api("/users/" + id, "PUT", { role: role });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleActive(u) {
    setError("");
    try {
      await api("/users/" + u._id + (u.isActive ? "/deactivate" : "/activate"), "PATCH");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (user.role !== "admin") {
    return <p className="error">Only an admin can view this page.</p>;
  }

  const lastPage = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <h2>Users</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleCreate} className="row box">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password (6+)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="admin">admin</option>
          <option value="project_manager">project_manager</option>
          <option value="team_member">team_member</option>
          <option value="viewer">viewer</option>
        </select>
        <button type="submit">Create user</button>
      </form>

      <div className="row">
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="admin">admin</option>
          <option value="project_manager">project_manager</option>
          <option value="team_member">team_member</option>
          <option value="viewer">viewer</option>
        </select>
      </div>

      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => handleRole(u._id, e.target.value)}>
                  <option value="admin">admin</option>
                  <option value="project_manager">project_manager</option>
                  <option value="team_member">team_member</option>
                  <option value="viewer">viewer</option>
                </select>
              </td>
              <td>{u.isActive ? "Active" : "Deactivated"}</td>
              <td>
                {u._id !== user.id && (
                  <button onClick={() => handleActive(u)}>{u.isActive ? "Deactivate" : "Activate"}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {lastPage}</span>
        <button disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}