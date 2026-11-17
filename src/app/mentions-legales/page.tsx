import type { Metadata } from "next";
import PageLegale, { Bloc, ACompleter } from "@/components/PageLegale";
import { HEBERGEURS } from "@/lib/legal";
import { editeur } from "@/lib/legalServeur";
import { getRequestOrg } from "@/lib/org";

export const metadata: Metadata = {
  title: "Mentions légales — BIA Manager",
  description: "Éditeur, hébergement et conditions d'utilisation de BIA Manager.",
};

export default async function MentionsLegalesPage() {
  const e = await editeur();
  const club = await getRequestOrg();

  return (
    <PageLegale
      titre="Mentions légales"
      chapeau="Qui édite BIA Manager, qui l'héberge, et comment nous joindre."
    >
      <Bloc titre="Éditeur du site">
        {e.complet ? (
          <ul className="space-y-1">
            <li><strong className="text-gray-800">{e.nom}</strong>{e.statut ? ` — ${e.statut}` : ""}</li>
            {e.siret && <li>SIRET : {e.siret}</li>}
            <li>{e.adresse}</li>
            <li>
              Contact : <a href={`mailto:${e.email}`} className="text-brand-600 hover:underline">{e.email}</a>
            </li>
            <li>Directeur de la publication : {e.directeur}</li>
          </ul>
        ) : (
          <div className="space-y-2">
            <p>
              Les informations d&apos;identification de l&apos;éditeur ne sont pas encore renseignées sur cette
              installation.
            </p>
            <ul className="space-y-1.5">
              <li><ACompleter quoi="Nom de l'éditeur" /></li>
              <li><ACompleter quoi="Forme juridique et SIRET" /></li>
              <li><ACompleter quoi="Adresse du siège" /></li>
              <li><ACompleter quoi="Adresse de contact" /></li>
            </ul>
            <p className="text-xs text-gray-400">
              Ces valeurs se règlent dans les variables d&apos;environnement du projet
              depuis la console propriétaire, onglet <strong>Contrats</strong> › <em>Identité de l&apos;éditeur</em>.
            </p>
          </div>
        )}
      </Bloc>

      <Bloc titre="Hébergement">
        <p>L&apos;application et les données qu&apos;elle contient sont hébergées par :</p>
        <ul className="space-y-3 mt-2">
          {HEBERGEURS.map((h) => (
            <li key={h.nom}>
              <strong className="text-gray-800">{h.nom}</strong>{" "}
              <span className="text-gray-400">· {h.role}</span>
              <br />
              {h.adresse}
              <br />
              <a href={h.site} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer noopener">
                {h.site.replace("https://", "")}
              </a>
              <br />
              <span className="text-xs text-gray-500">{h.note}</span>
            </li>
          ))}
        </ul>
      </Bloc>

      {club && (
        <Bloc titre="Aéroclub utilisateur de cet espace">
          <p>
            Cet espace est utilisé par <strong className="text-gray-800">{club.nom}</strong>, qui décide seul des
            données qu&apos;il y enregistre et des personnes de son équipe qui y accèdent. Pour toute question sur un
            dossier d&apos;élève, adressez-vous d&apos;abord à l&apos;aéroclub.
          </p>
        </Bloc>
      )}

      <Bloc titre="Objet du service">
        <p>
          BIA Manager est un outil de gestion du Brevet d&apos;Initiation Aéronautique à destination des aéroclubs :
          inscription des élèves, autorisations parentales, planning des vols de découverte, suivi financier et
          espace de formation en ligne. L&apos;accès est réservé aux aéroclubs abonnés, à leurs établissements
          partenaires et aux familles des élèves inscrits.
        </p>
      </Bloc>

      <Bloc titre="Propriété intellectuelle">
        <p>
          Le code, l&apos;interface et les textes de BIA Manager sont la propriété de son éditeur. Les documents de
          cours, fichiers et contenus déposés par un aéroclub ou par une famille restent la propriété de leur auteur ;
          l&apos;éditeur ne les exploite à aucune autre fin que leur mise à disposition dans l&apos;application.
        </p>
      </Bloc>

      <Bloc titre="Signaler un contenu ou une erreur">
        <p>
          Pour signaler un contenu illicite, une donnée inexacte ou un dysfonctionnement, écrivez à{" "}
          {e.email ? (
            <a href={`mailto:${e.email}`} className="text-brand-600 hover:underline">{e.email}</a>
          ) : (
            <ACompleter quoi="adresse de contact" />
          )}
          . Les demandes concernant les données personnelles sont détaillées dans la{" "}
          <a href="/confidentialite" className="text-brand-600 hover:underline">politique de confidentialité</a>.
        </p>
      </Bloc>
    </PageLegale>
  );
}
