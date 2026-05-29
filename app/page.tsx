import { redirect } from "next/navigation";

// The root routes into the dashboard, which is the app's home for now.
export default function Home() {
  redirect("/dashboard");
}
