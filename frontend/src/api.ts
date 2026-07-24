import axios from "axios";

export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api'
});

api.interceptors.request.use(async (config) => {
  // @ts-ignore
  const token = await window.Clerk?.session?.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
