# Validation juriste — formules C2a (candidats verified)

Généré : 2026-07-20T19:26:59.880288+00:00

Merci de valider **2 à 3 formules** ci-dessous avant promotion définitive en production.

## 1. `prescription-salaire-indemnites-3ans`

**Libellé :** Prescription action salaire & indemnités de rupture
**Formule moteur :** `date_exigibilité + 3 ans`
**Ancrage :** Loi n° 92-007 Code du travail — Art. 74
**Source :** `18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf`

Action en paiement du salaire se prescrit par trois ans ; indemnités de rupture assimilées au salaire.

### Points à contrôler

- [ ] Le délai de 3 ans s'applique-t-il bien aux indemnités de licenciement ?
- [ ] Point de départ : date d'exigibilité — cas particuliers (licenciement, rappel de salaire) ?
- [ ] Interruptions (inspecteur du travail, citation) correctement exclues du moteur automatique ?

**Décision :** ☐ CONFORME · ☐ PARTIEL · ☐ NON CONFORME

**Notes :**

_______________________________________________

## 2. `indemnite-licenciement-conditions`

**Libellé :** Conditions d'ouverture indemnité de licenciement
**Formule moteur :** `CDI + initiative employeur + hors faute lourde + ancienneté continue ≥ 2 ans`
**Ancrage :** Loi n° 92-007 — Art. 37
**Source :** `18_Securite_sociale/Loi_1992-007_Code_du_travail_FR.pdf`

Droit à indemnité distincte du préavis si rupture CDI employeur hors faute lourde et ≥ 2 ans ; modalités par arrêté.

### Points à contrôler

- [ ] Les 4 conditions sont-elles exhaustives pour le principe d'ouverture ?
- [ ] Confirmer que le montant ne doit PAS être codifié sans l'arrêté ministériel.
- [ ] Cas de licenciement économique (Art. 40+) : impact sur l'indemnité ?

**Décision :** ☐ CONFORME · ☐ PARTIEL · ☐ NON CONFORME

**Notes :**

_______________________________________________

## 3. `ohada-opposition-injonction-10j`

**Libellé :** Délai d'opposition à l'injonction de payer OHADA
**Formule moteur :** `date_signification + 10 jours (+ délais de distance non auto)`
**Ancrage :** AUPSRVE 2023 — Art. 9–10
**Source :** `ohada/AUPSRVE-2023_fr.md`

Opposition = recours ordinaire ; formée dans les 10 jours de la signification.

### Points à contrôler

- [ ] Le délai de 10 jours est-il franc ou calendaire selon la pratique CCJA ?
- [ ] Signification non personnelle (Art. 10 al. 2) : faut-il un second calcul dans le moteur ?
- [ ] Interaction avec délais de distance : laisser en note manuelle est-il acceptable ?

**Décision :** ☐ CONFORME · ☐ PARTIEL · ☐ NON CONFORME

**Notes :**

_______________________________________________

---

**Juriste :** __________________  **Barreau :** ________  **Date :** ________

Fichier machine : `build\jurist_validation_pack_c2a.json`