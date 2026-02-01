import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Old admin route - now uses secret URL at /control/[adminKey]/markets
export default function AdminMarketsPage() {
  notFound();
}
