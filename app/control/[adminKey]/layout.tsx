"use client";

import { useParams, redirect, notFound } from "next/navigation";
import { createContext, useContext, ReactNode } from "react";

// Admin context to share the admin key with child components
const AdminKeyContext = createContext<string>("");

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

export default function AdminLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const adminKey = params.adminKey as string;
  
  // Get the expected secret from environment (client-side check is supplementary,
  // real validation happens on API routes)
  const expectedSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || "gramshis-control-2026";
  
  if (adminKey !== expectedSecret) {
    notFound();
  }
  
  return (
    <AdminKeyContext.Provider value={adminKey}>
      {children}
    </AdminKeyContext.Provider>
  );
}
