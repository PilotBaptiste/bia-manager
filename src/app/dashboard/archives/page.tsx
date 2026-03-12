import { Settings2 } from "lucide-react";
export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center">
        <Settings2 className="w-6 h-6 text-brand-500" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">Section à venir</h2>
      <p className="text-sm text-gray-500">Cette page sera développée prochainement.</p>
    </div>
  );
}
