import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  function fill(e) {
    setEmail(e);
    setPassword("Password@123");
  }

  return (
    <div className="login-box">
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>
      <p className="muted">Demo logins (password Password@123):</p>
      <div className="row">
        <button onClick={() => fill("admin@test.com")}>Admin</button>
        <button onClick={() => fill("manager@test.com")}>Manager</button>
        <button onClick={() => fill("member@test.com")}>Member</button>
        <button onClick={() => fill("viewer@test.com")}>Viewer</button>
      </div>
    </div>
  );
}