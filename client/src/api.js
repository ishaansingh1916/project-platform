const API = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export function getToken() {
  return localStorage.getItem("token");
}

// One helper for every request. It adds the token and turns errors into exceptions.
export async function api(path, method = "GET", body) {
  const options = { method: method, headers: {} };
  const token = getToken();
  if (token) options.headers.Authorization = "Bearer " + token;
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, options);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== "/auth/login") {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
  if (!res.ok) {
    const err = new Error(data.message || "Something went wrong");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}