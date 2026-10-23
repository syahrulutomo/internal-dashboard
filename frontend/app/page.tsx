import { redirect } from "next/navigation";

// Entry point: route to the dashboard. The dashboard's client guard bounces
// unauthenticated users to /login.
export default function Home() {
  redirect("/dashboard");
}
