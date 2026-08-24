import { ArrowLeft, Pill } from "lucide-react";

function medicineSubtitle(medicine) {
  return [medicine.genericName, medicine.strength, medicine.dosageForm, medicine.manufacturer]
    .filter(Boolean)
    .join(" - ");
}

export function MedicineSelectionPage({ query, medicines, loading, message, onBack, onSelect }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to search
      </button>

      <div>
        <h1 className="text-2xl font-bold">Choose the exact medicine</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Showing catalog matches for {query || "your search"}.
        </p>
      </div>

      {loading && (
        <p className="rounded-xl border bg-accent px-4 py-3 text-sm">
          Searching the medicine catalog...
        </p>
      )}

      {message && !loading && (
        <p className="rounded-xl border bg-accent px-4 py-3 text-sm">{message}</p>
      )}

      {!loading && medicines.length > 0 && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="divide-y">
            {medicines.map((medicine) => (
              <button
                key={medicine.medicineId}
                type="button"
                onClick={() => onSelect(medicine)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/70"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Pill className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {medicine.brandName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {medicineSubtitle(medicine) || "Medicine catalog match"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
