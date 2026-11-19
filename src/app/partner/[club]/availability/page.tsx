import { OperationsPage } from "@/components/partner/operations-page";

export default async function Page({ params, searchParams }: {
  params: Promise<{ club: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ club }, { date }] = await Promise.all([params, searchParams]);
  return <OperationsPage club={club} requestedDate={date} section="availability" />;
}
