import axios from "axios";

let authHeader = "";

export function configureAuth(credentials) {
  authHeader = credentials ? `Basic ${btoa(`${credentials.username}:${credentials.password}`)}` : "";
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080/api",
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  if (authHeader) config.headers.Authorization = authHeader;
  if (["post", "put", "patch", "delete"].includes(config.method?.toLowerCase())) {
    const response = await axios.get(`${api.defaults.baseURL}/auth/csrf`, { withCredentials: true });
    config.headers["X-XSRF-TOKEN"] = response.data.token;
  }
  return config;
});