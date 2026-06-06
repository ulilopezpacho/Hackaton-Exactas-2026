import { redirect } from "next/navigation";

export default function NewTripPage() {
  redirect("/app/trips/new/destination");
}
