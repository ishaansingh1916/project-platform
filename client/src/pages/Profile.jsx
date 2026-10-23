import { useAuth } from "../AuthContext";

export default function Profile() {
  const { user } = useAuth();
  return (
    <div>
      <h2>Profile</h2>
      <div className="box">
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Role: {user.role}</p>
      </div>
    </div>
  );
}