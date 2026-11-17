import type { Metadata } from "next";
import PageLegale, { Bloc, ACompleter } from "@/components/PageLegale";
import { DONNEES, CONSERVATION, DROITS } from "@/lib/legal";
import { editeur } from "@/lib/legalServeur";
import { getRequestOrg } from "@/lib/org";

export const metadata: Metadata = {
  title: "Politique de confidentialité — BIA Manager",
  description: "Quelles données BIA Manager enregistre, pourquoi, combien de temps, et comment les faire supprimer.",
};

export default async function ConfidentialitePage() {
  const e = await editeur();
  const club = await getRequestOrg();
  const nomClub = club?.nom ?? "l'aéroclub";

  return (
    <PageLegale
      titre="Politique de confidentialité"
      chapeau="BIA Manager enregistre des données concernant des mineurs. Cette page dit lesquelles, pourquoi, combien de temps elles sont gardées, et comment en demander la suppression."
    >
      <Bloc titre="Qui est responsable de vos données">
        <p>
          <strong className="text-gray-800">{nomClub}</strong> décide des données enregistrées dans cet espace et des
          personnes de son équipe qui y accèdent. C&apos;est le <em>responsable de traitement</em> au sens du RGPD, et
          c&apos;est à lui qu&apos;il faut s&apos;adresser en premier.
        </p>
        <p>
          {e.complet ? (
            <>
              <strong className="text-gray-800">{e.nom}</strong>, éditeur de BIA Manager, fournit l&apos;outil et
              l&apos;héberge.
            </>
          ) : (
            <>
              L&apos;éditeur de BIA Manager (<ACompleter quoi="identité" />) fournit l&apos;outil et l&apos;héberge.
            </>
          )}{" "}
          Il agit comme <em>sous-traitant</em> : il n&apos;utilise jamais ces données pour son propre compte, ne les
          vend pas et ne les transmet à personne d&apos;autre que l&apos;aéroclub concerné.
        </p>
      </Bloc>

      <Bloc titre="Les données enregistrées">
        <p>Seules les données nécessaires à l&apos;organisation du BIA sont collectées :</p>
        <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {DONNEES.map((d) => (
            <div key={d.titre} className="p-3">
              <p className="font-semibold text-gray-800 text-sm">{d.titre}</p>
              <p className="text-sm text-gray-600 mt-0.5">{d.details}</p>
              <p className="text-xs text-gray-400 mt-1">Pourquoi : {d.pourquoi}</p>
            </div>
          ))}
        </div>
        <p className="mt-3">
          Aucune donnée bancaire n&apos;est enregistrée par BIA Manager. Aucun traceur publicitaire ni outil de mesure
          d&apos;audience tiers n&apos;est utilisé : les seuls cookies déposés servent à vous garder connecté.
        </p>
      </Bloc>

      <Bloc titre="Sur quelle base légale">
        <p>
          Le traitement repose sur l&apos;<strong className="text-gray-800">exécution du contrat</strong> qui lie la
          famille à l&apos;aéroclub pour la formation au BIA et le vol de découverte, et sur l&apos;
          <strong className="text-gray-800">obligation légale</strong> pour ce qui touche à la comptabilité et à
          l&apos;autorisation parentale de vol d&apos;un mineur.
        </p>
      </Bloc>

      <Bloc titre="Qui y a accès">
        <p>
          Chaque aéroclub ne voit que ses propres données : la séparation est appliquée par la base de données
          elle-même, pas seulement par l&apos;affichage. Au sein d&apos;un aéroclub, l&apos;accès dépend du rôle —
          un pilote voit les élèves de ses vols, un formateur ceux de ses établissements, un parent uniquement ses
          propres enfants.
        </p>
        <p>
          Les prestataires techniques (hébergement, base de données, envoi des emails) sont listés dans les{" "}
          <a href="/mentions-legales" className="text-brand-600 hover:underline">mentions légales</a>. Les données sont
          stockées dans l&apos;Union européenne.
        </p>
      </Bloc>

      <Bloc titre="Combien de temps elles sont gardées">
        <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {CONSERVATION.map((c) => (
            <div key={c.quoi} className="p-3">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <p className="font-semibold text-gray-800 text-sm">{c.quoi}</p>
                <p className="text-sm font-semibold text-brand-600 shrink-0">{c.duree}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">{c.pourquoi}</p>
            </div>
          ))}
        </div>
      </Bloc>

      <Bloc titre="Vos droits">
        <p>
          Vous pouvez exercer les droits suivants, pour vous-même et pour votre enfant mineur :
        </p>
        <ul className="mt-2 space-y-1.5">
          {DROITS.map((d) => (
            <li key={d.titre}>
              <strong className="text-gray-800">{d.titre}</strong> — {d.texte}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Adressez votre demande à {nomClub}. Si vous n&apos;obtenez pas de réponse, écrivez à{" "}
          {e.email ? (
            <a href={`mailto:${e.email}`} className="text-brand-600 hover:underline">{e.email}</a>
          ) : (
            <ACompleter quoi="adresse de contact" />
          )}
          . Vous pouvez enfin saisir la <strong className="text-gray-800">CNIL</strong> (
          <a href="https://www.cnil.fr" className="text-brand-600 hover:underline" target="_blank" rel="noreferrer noopener">
            cnil.fr
          </a>
          ) si vous estimez vos droits non respectés.
        </p>
      </Bloc>

      <Bloc titre="Données des mineurs">
        <p>
          Les élèves inscrits au BIA sont le plus souvent mineurs. Ils n&apos;ont pas de compte personnel :
          l&apos;espace est ouvert au nom du ou des responsables légaux, qui gardent la main sur le dossier. Le vol de
          découverte n&apos;est possible qu&apos;après signature de l&apos;autorisation parentale.
        </p>
      </Bloc>

      <Bloc titre="Sécurité">
        <p>
          Les mots de passe ne sont jamais stockés en clair. Les échanges avec l&apos;application sont chiffrés. Les
          documents déposés (autorisations, devoirs) ne sont accessibles que par un lien signé, de courte durée,
          délivré après vérification des droits. Les accès d&apos;un aéroclub à un autre sont impossibles.
        </p>
      </Bloc>

      <Bloc titre="Modifications">
        <p>
          Cette politique peut évoluer avec l&apos;application. La version affichée ici est toujours celle qui
          s&apos;applique.
        </p>
      </Bloc>
    </PageLegale>
  );
}
