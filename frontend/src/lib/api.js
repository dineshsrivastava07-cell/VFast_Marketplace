import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("vfast_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // soft-clear stale token
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/admin/login")) {
        localStorage.removeItem("vfast_token");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
