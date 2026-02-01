import { notFound } from "next/navigation";

// Old admin route - now uses secret URL at /control/[adminKey]/markets/new
export default function NewMarketPage() {
  notFound();
}
