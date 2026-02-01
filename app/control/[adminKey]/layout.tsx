"use client";

import { useParams, notFound } from "next/navigation";
import { AdminKeyProvider } from "./AdminContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const adminKey = params.adminKey as string;
  
  // Get the expected secret from environment (client-side check is supplementary,
  // real validation happens on API routes)
  const expectedSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || "gramshis-control-2026";
  
  if (adminKey !== expectedSecret) {
    notFound();
  }
  
  return (
    <AdminKeyProvider adminKey={adminKey}>
      {children}
    </AdminKeyProvider>
  );
}
