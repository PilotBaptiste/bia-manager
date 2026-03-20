"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  CalendarPlus,
  Plane,
  Loader2,
  Check,
  X,
  Mail,
  Phone,
  User,
  AlertCircle,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

export default function ReservationPage() {
  const supabase = createClient();
  const [enfants, setEnfants] = useState<any[]>([]);
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<{
    eleveId: string;
    creneauId: string;
    typeVol: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmCancelLoading, setConfirmCancelLoading] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Auto-link any unlinked children (handles multi-child families and late additions)
    fetch("/api/link-parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email: user.email }),
    }).catch(() => {});
    const [eR, cR] = await Promise.all([
      supabase
        .from("eleves")
        .select(
          "*, etablissement:etablissements(nom), reservations(*, creneau:creneaux(date_vol, heure_debut, heure_fin, statut, pilote:profiles!pilote_id(nom, prenom, email, telephone), aeronef:aeronefs(type_aeronef, immatriculation)))",
        )
        .eq("parent_id", user.id)
        .eq("archive", false),
      supabase
        .from("creneaux")
        .select(
          "*, pilote:profiles!pilote_id(nom, prenom, email, telephone), aeronef:aeronefs(type_aeronef, immatriculation, nb_places_eleves), etablissement:etablissements(nom), reservations(id, statut)",
        )
        .in("statut", ["ouvert", "confirme"])
        .order("date_vol"),
    ]);
    setEnfants(eR.data || []);
    setCreneaux(cR.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function canCancel(r: any): { allowed: boolean; reason?: string } {
    if (!r.creneau) return { allowed: false, reason: "Donnees manquantes" };
    if (r.statut === "effectue")
      return { allowed: false, reason: "Vol effectue" };
    const volDate = new Date(`${r.creneau.date_vol}T${r.creneau.heure_debut}`);
    const diffH = (volDate.getTime() - Date.now()) / 36e5;
    if (diffH < 48)
      return { allowed: false, reason: "Moins de 48h. Contactez le pilote." };
    return { allowed: true };
  }

  function handleCancel(id: string) {
    setConfirmCancelId(id);
  }

  async function doCancel(id: string) {
    setSaving(true);
    // Find the reservation details before cancelling (for the email)
    let cancelledRes: any = null;
    for (const e of enfants) {
      const r = (e.reservations || []).find((r: any) => r.id === id);
      if (r) { cancelledRes = { ...r, eleve: e }; break; }
    }
    await supabase.from("reservations").update({ statut: "annule" }).eq("id", id);
    setSaving(false);
    toast.success("Réservation annulée");
    // Send cancellation emails (fire-and-forget)
    if (cancelledRes) {
      const { data: { user } } = await supabase.auth.getUser();
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "booking_cancel",
          eleve_id: cancelledRes.eleve?.id ?? null,
          parent_email: user?.email,
          parent_prenom: cancelledRes.eleve?.parent_prenom || "",
          eleve_prenom: cancelledRes.eleve?.prenom,
          eleve_nom: cancelledRes.eleve?.nom,
          type_vol: cancelledRes.type_vol,
          date_vol: cancelledRes.creneau?.date_vol,
          heure_debut: cancelledRes.creneau?.heure_debut,
          pilote_email: cancelledRes.creneau?.pilote?.email,
          pilote_nom: cancelledRes.creneau?.pilote ? `${cancelledRes.creneau.pilote.prenom} ${cancelledRes.creneau.pilote.nom}` : "",
        }),
      }).catch(() => {});
    }
    load();
  }

  async function handleBook() {
    if (!booking) return;
    setError(null);
    const enfant = enfants.find((e) => e.id === booking.eleveId);
    if (enfant) {
      const active = (enfant.reservations || []).filter(
        (r: any) => r.type_vol === booking.typeVol && r.statut !== "annule",
      );
      if (active.length > 0) {
        setError(
          `Reservation active existante pour le vol ${booking.typeVol}. Annulez-la d'abord.`,
        );
        return;
      }
    }
    setSaving(true);
    // Upsert: reactivate a cancelled reservation if one exists (avoids unique constraint violation)
    const { data: cancelled } = await supabase
      .from("reservations")
      .select("id")
      .eq("creneau_id", booking.creneauId)
      .eq("eleve_id", booking.eleveId)
      .eq("statut", "annule")
      .maybeSingle();

    let err: any = null;
    if (cancelled) {
      const { error: e } = await supabase
        .from("reservations")
        .update({ statut: "reserve", type_vol: booking.typeVol })
        .eq("id", cancelled.id);
      err = e;
    } else {
      const { error: e } = await supabase
        .from("reservations")
        .insert({ creneau_id: booking.creneauId, eleve_id: booking.eleveId, type_vol: booking.typeVol });
      err = e;
    }
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess("Reservation confirmee !");
    setBooking(null);
    setTimeout(() => setSuccess(null), 3000);
    // Send booking confirmation emails (fire-and-forget)
    const { data: { user } } = await supabase.auth.getUser();
    const creneau = creneaux.find((c) => c.id === booking.creneauId);
    const bookedEnfant = enfants.find((e) => e.id === booking.eleveId);
    if (creneau && bookedEnfant) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "booking_confirm",
          eleve_id: bookedEnfant.id ?? null,
          parent_email: user?.email,
          parent_prenom: bookedEnfant.parent_prenom || "",
          eleve_prenom: bookedEnfant.prenom,
          eleve_nom: bookedEnfant.nom,
          type_vol: booking.typeVol,
          date_vol: creneau.date_vol,
          heure_debut: creneau.heure_debut,
          heure_fin: creneau.heure_fin,
          aeronef: creneau.aeronef ? `${creneau.aeronef.type_aeronef} (${creneau.aeronef.immatriculation})` : "",
          pilote_nom: creneau.pilote ? `${creneau.pilote.prenom} ${creneau.pilote.nom}` : "",
          pilote_email: creneau.pilote?.email || "",
          pilote_telephone: creneau.pilote?.telephone || "",
          etablissement: creneau.etablissement?.nom || "",
        }),
      }).catch(() => {});

    }
    load();
  }

  // Filter creneaux by student's etablissement and eleves_autorises
  function getCreneauxForEleve(enfant: any) {
    return creneaux.filter((c) => {
      // Use live aeronef capacity, not the stale stored places_disponibles
      const capacity = c.aeronef?.nb_places_eleves ?? c.places_disponibles ?? 1;
      const activeBookings = (c.reservations || []).filter(
        (r: any) => r.statut !== "annule",
      ).length;
      if (activeBookings >= capacity) return false;
      // Show creneaux for this student's etablissement OR creneaux open to all
      if (
        c.etablissement_id &&
        enfant.etablissement_id &&
        c.etablissement_id !== enfant.etablissement_id
      )
        return false;
      // If the slot restricts to specific students, check inclusion
      if (c.eleves_autorises && c.eleves_autorises.length > 0) {
        if (!c.eleves_autorises.includes(enfant.id)) return false;
      }
      return true;
    });
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );

  const bookableEnfants = enfants.filter((e) => {
    const activeRes = (e.reservations || []).filter(
      (r: any) => r.statut !== "annule" && r.creneau?.statut !== "annule",
    );
    const hasActiveVol1 = activeRes.some(
      (r: any) => r.type_vol === 1 && r.statut !== "effectue",
    );
    const hasActiveVol2 = activeRes.some(
      (r: any) => r.type_vol === 2 && r.statut !== "effectue",
    );
    if (
      e.paiement_effectue &&
      e.attestation_signee &&
      !e.vol1_effectue &&
      !hasActiveVol1
    )
      return true;
    if (e.vol2_autorise && !e.vol2_effectue && !hasActiveVol2) return true;
    return false;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reserver un vol</h1>
        <p className="text-sm text-gray-500 mt-1">
          Creneaux disponibles pour votre etablissement
        </p>
      </div>

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Active reservations */}
      {enfants.some(
        (e) =>
          e.reservations?.filter((r: any) => r.statut !== "annule" && r.creneau?.statut !== "annule").length > 0,
      ) && (
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Mes reservations actives
          </h2>
          {enfants.map((e) =>
            e.reservations
              ?.filter((r: any) => r.statut !== "annule" && r.creneau?.statut !== "annule")
              .map((r: any) => {
                const ci = canCancel(r);
                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-lg bg-gray-50 mb-3 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {e.prenom} {e.nom} — Vol {r.type_vol}
                        </p>
                        <span
                          className={`badge ${r.statut === "effectue" ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-500"}`}
                        >
                          {r.statut === "effectue" ? "Effectue" : "Reserve"}
                        </span>
                      </div>
                      {r.statut !== "effectue" &&
                        (ci.allowed ? (
                          <button
                            onClick={() => handleCancel(r.id)}
                            disabled={saving}
                            className="btn-danger btn-sm"
                          >
                            <X className="w-3 h-3" /> Annuler
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 max-w-[180px]">
                            {ci.reason}
                          </span>
                        ))}
                    </div>
                    {r.creneau && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200 mb-3">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">
                          Details du vol
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Date</span>{" "}
                            <span className="font-medium">
                              {new Date(r.creneau.date_vol).toLocaleDateString(
                                "fr-FR",
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Horaire</span>{" "}
                            <span className="font-medium">
                              {r.creneau.heure_debut?.slice(0, 5)} -{" "}
                              {r.creneau.heure_fin?.slice(0, 5)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Aeronef</span>{" "}
                            <span className="font-medium">
                              {r.creneau.aeronef?.type_aeronef} (
                              {r.creneau.aeronef?.immatriculation})
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Statut vol</span>{" "}
                            <span className="font-medium">
                              {r.creneau.statut === "termine"
                                ? "Termine"
                                : "En cours"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {r.creneau?.pilote && (
                      <div className="p-3 bg-brand-50/50 rounded-lg border border-brand-100">
                        <p className="text-[10px] font-semibold text-brand-500 uppercase mb-2">
                          Votre pilote
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-3.5 h-3.5 text-brand-400" />
                            <span className="font-medium">
                              {r.creneau.pilote.prenom} {r.creneau.pilote.nom}
                            </span>
                          </div>
                          {r.creneau.pilote.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-3.5 h-3.5 text-brand-400" />
                              <a
                                href={`mailto:${r.creneau.pilote.email}`}
                                className="text-brand-500 hover:underline"
                              >
                                {r.creneau.pilote.email}
                              </a>
                            </div>
                          )}
                          {r.creneau.pilote.telephone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-3.5 h-3.5 text-brand-400" />
                              <a
                                href={`tel:${r.creneau.pilote.telephone}`}
                                className="text-brand-500 hover:underline"
                              >
                                {r.creneau.pilote.telephone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }),
          )}
        </div>
      )}

      {/* Booking */}
      {bookableEnfants.length === 0 ? (
        <div className="card text-center py-12">
          <CalendarPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">Aucun enfant eligible.</p>
          <p className="text-xs text-gray-400">
            {enfants.some((e) =>
              e.reservations?.some(
                (r: any) => r.statut !== "annule" && r.statut !== "effectue",
              ),
            )
              ? "Reservation active en cours."
              : "Paiement et attestation requis."}
          </p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Creneaux disponibles
          </h2>
          {bookableEnfants.map((enfant) => {
            const isVol2 =
              enfant.vol1_effectue &&
              enfant.vol2_autorise &&
              !enfant.vol2_effectue;
            const typeVol = isVol2 ? 2 : 1;
            const available = getCreneauxForEleve(enfant);
            return (
              <div key={enfant.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {enfant.prenom} {enfant.nom}
                  </h3>
                  <span
                    className={`badge ${isVol2 ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-500"}`}
                  >
                    {isVol2 ? "Vol 2" : "Vol 1"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {enfant.etablissement?.nom}
                  </span>
                </div>
                {available.length === 0 ? (
                  <p className="text-sm text-gray-400 p-3">
                    Aucun creneau disponible pour votre etablissement.
                  </p>
                ) : (
                  available.map((c) => {
                    const capacity = c.aeronef?.nb_places_eleves ?? c.places_disponibles ?? 1;
                    const activeBookings = (c.reservations || []).filter((r: any) => r.statut !== "annule").length;
                    const remaining = capacity - activeBookings;
                    return (
                    <div
                      key={c.id}
                      className="p-4 rounded-lg border border-gray-100 mb-2 hover:border-brand-200 transition-colors"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                            <Plane className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {new Date(c.date_vol).toLocaleDateString("fr-FR")}{" "}
                              · {c.heure_debut?.slice(0, 5)} -{" "}
                              {c.heure_fin?.slice(0, 5)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {c.aeronef?.type_aeronef} (
                              {c.aeronef?.immatriculation})
                            </p>
                            <p className={`text-xs font-medium mt-0.5 ${remaining === 1 ? "text-amber-600" : "text-emerald-600"}`}>
                              {remaining === 1 ? "⚠ Dernière place" : `${remaining} place${remaining > 1 ? "s" : ""} disponible${remaining > 1 ? "s" : ""}`}
                            </p>
                          </div>
                        </div>
                        {booking?.creneauId === c.id &&
                        booking?.eleveId === enfant.id ? (
                          <div className="flex flex-col items-end gap-1">
                            {error && (
                              <p className="text-xs text-red-600">{error}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={handleBook}
                                disabled={saving}
                                className="btn-primary btn-sm"
                              >
                                {saving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}{" "}
                                Confirmer
                              </button>
                              <button
                                onClick={() => {
                                  setBooking(null);
                                  setError(null);
                                }}
                                className="btn-secondary btn-sm"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setError(null);
                              setBooking({
                                eleveId: enfant.id,
                                creneauId: c.id,
                                typeVol,
                              });
                            }}
                            className="btn-primary btn-sm"
                          >
                            Reserver
                          </button>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {c.pilote?.prenom}{" "}
                          {c.pilote?.nom}
                        </span>
                        {c.pilote?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {c.pilote.email}
                          </span>
                        )}
                        {c.pilote?.telephone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.pilote.telephone}
                          </span>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmCancelId}
        title="Annuler la réservation"
        message={"Confirmer l'annulation de cette réservation ?\nUn email de confirmation sera envoyé."}
        confirmLabel="Annuler la réservation"
        variant="danger"
        loading={confirmCancelLoading}
        onCancel={() => setConfirmCancelId(null)}
        onConfirm={async () => {
          if (!confirmCancelId) return;
          setConfirmCancelLoading(true);
          await doCancel(confirmCancelId);
          setConfirmCancelLoading(false);
          setConfirmCancelId(null);
        }}
      />
    </div>
  );
}
