import { notFound } from "next/navigation";

// Old admin route - now uses secret URL at /control/[adminKey]/markets/[id]
export default function AdminMarketDetailPage() {
  notFound();
}
