import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Old admin route - now uses secret URL at /control/[adminKey]
export default function AdminPage() {
  // Always show 404 - admin access is now via secret URL
  notFound();
}
