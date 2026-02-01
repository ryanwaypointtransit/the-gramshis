import { notFound } from "next/navigation";

// Old admin route - now uses secret URL at /control/[adminKey]/bots
export default function BotAdminPage() {
  notFound();
}