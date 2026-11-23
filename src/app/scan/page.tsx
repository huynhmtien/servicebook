import { redirect } from "next/navigation";

export default async function ScanRedirect({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  redirect(error ? `/records/new?error=${encodeURIComponent(error)}` : "/records/new");
}
