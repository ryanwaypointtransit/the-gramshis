"use client";

import { createContext, useContext } from "react";

// Admin context to share the admin key with child components
const AdminKeyContext = createContext<string>("");

export function AdminKeyProvider({ 
  adminKey, 
  children 
}: { 
  adminKey: string; 
  children: React.ReactNode;
}) {
  return (
    <AdminKeyContext.Provider value={adminKey}>
      {children}
    </AdminKeyContext.Provider>
  );
}

export function useAdminKey() {
  return useContext(AdminKeyContext);
}

// Helper function to make authenticated admin fetch calls
export function useAdminFetch() {
  const adminKey = useAdminKey();
  
  return async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set("x-admin-key", adminKey);
    
    return fetch(url, {
      ...options,
      headers,
    });
  };
}
