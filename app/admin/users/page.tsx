import { notFound } from "next/navigation";

// Old admin route - now uses secret URL at /control/[adminKey]/users
export default function AdminUsersPage() {
  notFound();
}
