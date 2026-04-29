import { getCurrentProfile } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "sonner";
import { YearProvider } from "@/contexts/YearContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <YearProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar profile={profile} />
        <main className="flex-1 overflow-x-hidden pt-14 lg:pt-0" id="main-content" aria-label="Contenu principal">
          <div className="max-w-[1280px] mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    </YearProvider>
  );
}
