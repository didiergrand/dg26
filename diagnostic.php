<?php
/* Mini formulaires de la page site-vitrine.html :
   - type « diagnostic » (par défaut) : adresse du site, nom, contact ;
   - type « rendez-vous » : formule choisie, nom, contact.
   Envoie la demande par e-mail à Didier, puis répond en JSON (envoi en JS)
   ou redirige vers la page (si JavaScript est désactivé).

   Protections contre les abus :
   - destinataire fixe, en-têtes nettoyés, longueurs limitées ;
   - champ piège invisible et délai minimum de remplissage (robots ignorés en silence) ;
   - envois acceptés seulement depuis ce site (en-têtes Origin / Referer) ;
   - au maximum 3 envois par heure par adresse IP et 30 envois par jour au total. */

const DESTINATAIRE = "dg@digitalgarage.ch";
const EXPEDITEUR   = "noreply@digitalgarage.ch"; // doit être une adresse du domaine hébergé
const RETOUR       = "site-vitrine.html";

const DELAI_MIN_MS   = 3000; // un humain met plus de 3 secondes à remplir le formulaire
const MAX_PAR_IP     = 3;    // envois par adresse IP…
const FENETRE_IP     = 3600; // …sur 1 heure
const MAX_PAR_JOUR   = 30;   // envois au total sur 24 heures
// Compteur des envois. L'extension .php et la première ligne « exit » empêchent de le lire depuis le web.
const COMPTEUR = __DIR__ . "/envois-compteur.php";

$type = (isset($_POST["type"]) && $_POST["type"] === "rendez-vous") ? "rendez-vous" : "diagnostic";
$ancre = $type === "rendez-vous" ? "demande" : "diagnostic";
$json = isset($_SERVER["HTTP_ACCEPT"]) && strpos($_SERVER["HTTP_ACCEPT"], "application/json") !== false;
$secours = "Vous pouvez m’écrire directement à dg@digitalgarage.ch ou appeler le 078 653 58 90.";

function reponse($ok, $message, $json) {
  global $ancre;
  if ($json) {
    http_response_code($ok ? 200 : 400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => $ok, "message" => $message]);
  } else {
    header("Location: " . RETOUR . "?envoi=" . ($ok ? "ok" : "erreur") . "#" . $ancre, true, 303);
  }
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") reponse(false, "Méthode non autorisée.", $json);

// 1. Envoi depuis un autre site : refusé
$hote = preg_replace("/^www\./", "", strtolower(explode(":", $_SERVER["HTTP_HOST"] ?? "")[0]));
foreach (["HTTP_ORIGIN", "HTTP_REFERER"] as $h) {
  if (empty($_SERVER[$h])) continue;
  $vient = preg_replace("/^www\./", "", strtolower((string) parse_url($_SERVER[$h], PHP_URL_HOST)));
  if ($vient !== $hote) reponse(false, "Envoi refusé.", $json);
}

// 2. Robots : champ piège rempli, ou formulaire envoyé trop vite (ou sans passer par la page).
//    On répond « merci » sans rien envoyer, pour ne pas leur donner d'indice.
if (!empty($_POST["societe_web"])) reponse(true, "Merci.", $json);
if ((int) ($_POST["duree"] ?? 0) < DELAI_MIN_MS) reponse(true, "Merci.", $json);

$propre = function ($k, $max) {
  $v = isset($_POST[$k]) ? trim((string) $_POST[$k]) : "";
  $v = preg_replace("/[\r\n\t]+/", " ", $v);
  return mb_substr($v, 0, $max);
};
$site    = $propre("site", 200);
$nom     = $propre("nom", 120);
$contact = $propre("contact", 160);
$origine = $propre("origine", 60);
$formule = $propre("formule", 40);
$formules = ["Essentiel", "Confort", "Plus", "Je ne sais pas encore"];

if ($nom === "" || $contact === "") reponse(false, "Merci de remplir tous les champs.", $json);
if ($type === "diagnostic" && $site === "") reponse(false, "Merci de remplir tous les champs.", $json);
if ($type === "rendez-vous" && !in_array($formule, $formules, true)) reponse(false, "Merci de choisir une formule.", $json);

$email = filter_var($contact, FILTER_VALIDATE_EMAIL) ? $contact : "";
$tel   = preg_match("/^[+0-9 ().\/-]{9,20}$/", $contact) ? $contact : "";
if ($email === "" && $tel === "") reponse(false, "Merci d’indiquer un e-mail ou un numéro de téléphone valable.", $json);

// 3. Limites d'envoi. L'adresse IP est enregistrée sous forme brouillée (empreinte), jamais en clair.
//    Si le compteur ne peut pas être ouvert, on laisse passer pour ne perdre aucune demande.
$fp = @fopen(COMPTEUR, "c+");
$journal = ["jour" => [], "ip" => []];
if ($fp && flock($fp, LOCK_EX)) {
  $brut = stream_get_contents($fp);
  $donnees = json_decode((string) substr($brut, strpos($brut, "\n") !== false ? strpos($brut, "\n") + 1 : strlen($brut)), true);
  if (is_array($donnees)) $journal = $donnees + $journal;
  $maintenant = time();
  $ip = hash("sha256", ($_SERVER["REMOTE_ADDR"] ?? "") . "|digitalgarage");
  $journal["jour"] = array_values(array_filter($journal["jour"], fn($t) => $t > $maintenant - 86400));
  foreach ($journal["ip"] as $cle => $liste) {
    $liste = array_values(array_filter($liste, fn($t) => $t > $maintenant - FENETRE_IP));
    if ($liste) $journal["ip"][$cle] = $liste; else unset($journal["ip"][$cle]);
  }
  $trop = count($journal["jour"]) >= MAX_PAR_JOUR || count($journal["ip"][$ip] ?? []) >= MAX_PAR_IP;
  if (!$trop) { $journal["jour"][] = $maintenant; $journal["ip"][$ip][] = $maintenant; }
  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, "<?php exit; ?>\n" . json_encode($journal));
  fflush($fp); flock($fp, LOCK_UN); fclose($fp);
  if ($trop) reponse(false, "Le formulaire a reçu trop de demandes. " . $secours, $json);
}

if ($type === "rendez-vous") {
  $sujet = "Site vitrine, formule " . $formule . " : " . $nom;
  $corps = "Nouvelle demande de rendez-vous pour un site vitrine\n\n"
         . "Formule : " . $formule . "\n";
} else {
  $sujet = "Diagnostic gratuit : " . $site;
  $corps = "Nouvelle demande de diagnostic gratuit\n\n"
         . "Site actuel : " . $site . "\n";
}
$corps .= "Nom : " . $nom . "\n"
       . "Contact : " . $contact . "\n"
       . "Provenance : " . ($origine !== "" ? $origine : "site-vitrine") . "\n"
       . "Date : " . date("d.m.Y H:i") . "\n";

$entetes = "From: Digitalgarage <" . EXPEDITEUR . ">\r\n"
         . ($email !== "" ? "Reply-To: " . $email . "\r\n" : "")
         . "Content-Type: text/plain; charset=UTF-8\r\n";

$envoye = mail(DESTINATAIRE, "=?UTF-8?B?" . base64_encode($sujet) . "?=", $corps, $entetes, "-f" . EXPEDITEUR);

if (!$envoye) reponse(false, "L’envoi n’a pas fonctionné. " . $secours, $json);
reponse(true, "Merci.", $json);
