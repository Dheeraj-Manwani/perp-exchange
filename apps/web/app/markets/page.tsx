import { Navbar } from "@/components/navbar";
import { MarketsTable } from "@/components/markets-table";

export default function MarketsPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base">
      <Navbar />
      <MarketsTable />
    </div>
  );
}
