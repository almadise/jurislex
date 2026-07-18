-- ============================================================
-- JurisLex — Seed: Real OHADA & Cameroon Legal Texts
-- Covers: Constitution, OHADA Commercial Law, Labor Code, Civil Code
-- Search modes: semantic (embedding), lexical (fts_vector), exact (reference)
-- ============================================================

DO $$
BEGIN

-- ============================================================
-- 1. CONSTITUTION DE LA REPUBLIQUE DU CAMEROUN (18 janvier 1996)
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'Constitution de la République du Cameroun — Préambule',
  'Const. Cameroun 1996, Préambule',
  'Préambule',
  'Le peuple camerounais, fier de sa diversité culturelle et linguistique, élément de sa personnalité nationale, proclame son attachement aux libertés fondamentales.',
  'Le peuple camerounais, fier de sa diversité culturelle et linguistique, élément de sa personnalité nationale, proclame son attachement aux libertés fondamentales inscrites dans la Déclaration Universelle des Droits de l''Homme, la Charte des Nations Unies, la Charte Africaine des Droits de l''Homme et des Peuples et toutes les conventions internationales y relatives et dûment ratifiées, notamment aux principes suivants : — Toute personne a droit à la vie, à l''intégrité physique et morale et à un traitement humain en toutes circonstances. En aucun cas, nul ne peut être soumis à la torture, à des peines ou traitements cruels, inhumains ou dégradants. — Toute personne a droit à la liberté et à la sécurité. Nul ne peut être poursuivi, arrêté ou détenu que dans les cas et selon les formes déterminées par la loi. — Toute personne a droit à un jugement équitable. — Toute personne a droit à la vie privée. Le domicile est inviolable. — La liberté de communication, de presse, de réunion, d''association, de syndicalisation, ainsi que le droit de grève sont garantis dans les conditions fixées par la loi.',
  1,
  'Droit constitutionnel',
  'Assemblée Nationale du Cameroun',
  '18 janvier 1996',
  'official',
  'verified',
  'fr'
),
(
  'Constitution de la République du Cameroun — Article 1',
  'Const. Cameroun 1996, Art. 1',
  'Article 1',
  'Le Cameroun est un État unitaire décentralisé. Il est une et indivisible, laïc, démocratique et social.',
  'Article 1 : (1) La République du Cameroun est un État unitaire décentralisé. Elle est une et indivisible, laïc, démocratique et social. Elle reconnaît et protège les valeurs traditionnelles conformes aux principes démocratiques, aux droits de l''homme et à la loi. (2) La République du Cameroun adopte le français et l''anglais comme langues officielles d''égale valeur. Elle garantit la promotion du bilinguisme sur toute l''étendue du territoire. Elle œuvre pour la protection et la promotion des langues nationales. (3) La devise de la République est "Paix — Travail — Patrie". (4) Son drapeau est de trois couleurs : vert, rouge, jaune, avec une étoile dorée en son centre. (5) L''hymne national est le "Chant de Ralliement". (6) Le sceau de la République est défini par la loi. (7) La capitale de la République est Yaoundé.',
  2,
  'Droit constitutionnel',
  'Assemblée Nationale du Cameroun',
  '18 janvier 1996',
  'official',
  'verified',
  'fr'
),
(
  'Constitution de la République du Cameroun — Article 5',
  'Const. Cameroun 1996, Art. 5',
  'Article 5',
  'La souveraineté nationale appartient au peuple camerounais qui l''exerce soit par l''intermédiaire du Président de la République et des membres du Parlement, soit par voie de référendum.',
  'Article 5 : (1) La souveraineté nationale appartient au peuple camerounais qui l''exerce soit par l''intermédiaire du Président de la République et des membres du Parlement, soit par voie de référendum. Aucune fraction du peuple, aucun individu ne peut s''en attribuer l''exercice. (2) Le suffrage est universel, égal et secret. Il peut être direct ou indirect dans les conditions prévues par la Constitution et par la loi. Sont électeurs, dans les conditions déterminées par la loi, tous les citoyens camerounais des deux sexes, âgés de vingt ans révolus, jouissant de leurs droits civils et politiques.',
  5,
  'Droit constitutionnel',
  'Assemblée Nationale du Cameroun',
  '18 janvier 1996',
  'official',
  'verified',
  'fr'
),
(
  'Constitution de la République du Cameroun — Article 6',
  'Const. Cameroun 1996, Art. 6',
  'Article 6',
  'Le Président de la République est élu pour un mandat de sept ans renouvelable une fois.',
  'Article 6 : (1) Le Président de la République est élu pour un mandat de sept (7) ans renouvelable une fois. (2) L''élection du Président de la République a lieu au scrutin uninominal à un tour. Est élu le candidat ayant obtenu le plus grand nombre de suffrages exprimés. (3) Le Président de la République est élu au suffrage universel direct et au scrutin secret. (4) Nul ne peut exercer plus de deux mandats présidentiels. (5) En cas de vacance de la présidence de la République, pour quelque cause que ce soit, les fonctions de Président de la République sont provisoirement exercées par le Président du Sénat.',
  6,
  'Droit constitutionnel',
  'Assemblée Nationale du Cameroun',
  '18 janvier 1996',
  'official',
  'verified',
  'fr'
),
(
  'Constitution de la République du Cameroun — Article 26',
  'Const. Cameroun 1996, Art. 26',
  'Article 26',
  'La loi fixe les règles concernant les droits civiques et les garanties fondamentales accordées aux citoyens pour l''exercice des libertés publiques.',
  'Article 26 : La loi fixe les règles concernant : — les droits civiques et les garanties fondamentales accordées aux citoyens pour l''exercice des libertés publiques ; — les sujétions imposées par la Défense Nationale aux citoyens en leur personne et en leurs biens ; — la nationalité, l''état et la capacité des personnes, les régimes matrimoniaux, les successions et libéralités ; — la procédure selon laquelle les coutumes seront constatées et mises en harmonie avec les principes fondamentaux de la Constitution ; — la détermination des crimes et délits ainsi que les peines qui leur sont applicables, la procédure pénale, l''amnistie ; — l''organisation des juridictions de tous ordres et la procédure suivie devant ces juridictions, le statut des magistrats, les officiers ministériels et les auxiliaires de justice ; — l''assiette, le taux et les modalités de recouvrement des impositions de toutes natures.',
  26,
  'Droit constitutionnel',
  'Assemblée Nationale du Cameroun',
  '18 janvier 1996',
  'official',
  'verified',
  'fr'
),
(
  'Constitution de la République du Cameroun — Article 65',
  'Const. Cameroun 1996, Art. 65',
  'Article 65',
  'Le préambule fait partie intégrante de la Constitution.',
  'Article 65 : Le préambule fait partie intégrante de la présente Constitution.',
  65,
  'Droit constitutionnel',
  'Assemblée Nationale du Cameroun',
  '18 janvier 1996',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. ACTE UNIFORME OHADA RELATIF AU DROIT COMMERCIAL GENERAL
--    (Révisé le 15 décembre 2010, en vigueur le 15 mai 2011)
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'AUDCG — Champ d''application et définition du commerçant',
  'AUDCG 2010, Art. 1',
  'Article 1',
  'Le présent Acte uniforme s''applique à toute personne physique ou morale à laquelle les lois de chaque État partie confèrent la qualité de commerçant.',
  'Article 1 : Le présent Acte uniforme s''applique à toute personne physique ou morale à laquelle les lois de chaque État partie confèrent la qualité de commerçant et qui exerce une activité commerciale à titre professionnel. Il s''applique également aux sociétés commerciales et au groupement d''intérêt économique dont le siège social est situé sur le territoire de l''un des États parties au Traité relatif à l''Harmonisation du Droit des Affaires en Afrique.',
  1,
  'Droit commercial',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '15 décembre 2010',
  'official',
  'verified',
  'fr'
),
(
  'AUDCG — Définition des actes de commerce',
  'AUDCG 2010, Art. 3',
  'Article 3',
  'L''achat de biens, meubles ou immeubles, en vue de leur revente constitue un acte de commerce.',
  'Article 3 : Sont réputés actes de commerce : — l''achat de biens, meubles ou immeubles, en vue de leur revente ; — les opérations de banque, de bourse, de change, de courtage, d''assurance et de transit ; — les contrats entre commerçants pour les besoins de leur commerce ; — l''exploitation industrielle des mines, carrières et de tout gisement de ressources naturelles ; — les opérations de location de meubles ; — les opérations de manufacture, de transport et de télécommunication ; — les opérations des intermédiaires de commerce, tels que la commission, le courtage, l''agence, ainsi que les opérations d''intermédiaire pour l''achat, la souscription, la vente ou la location d''immeubles, de fonds de commerce, d''actions ou de parts de sociétés commerciales ou immobilières ; — les actes effectués par les sociétés commerciales.',
  3,
  'Droit commercial',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '15 décembre 2010',
  'official',
  'verified',
  'fr'
),
(
  'AUDCG — Registre du Commerce et du Crédit Mobilier (RCCM)',
  'AUDCG 2010, Art. 19',
  'Article 19',
  'Il est tenu dans chaque État partie un Registre du Commerce et du Crédit Mobilier destiné à recevoir l''immatriculation des personnes physiques et morales commerçantes.',
  'Article 19 : Il est tenu dans chaque État partie un Registre du Commerce et du Crédit Mobilier destiné à recevoir l''immatriculation des personnes physiques et morales commerçantes, ainsi que les déclarations d''activité des personnes physiques qui exercent une activité commerciale à titre individuel. Ce registre est tenu par le greffe de la juridiction compétente ou par tout organe compétent désigné par chaque État partie. Il est organisé en registres locaux tenus au niveau des juridictions ou organes compétents et en un fichier national centralisé tenu au niveau national.',
  19,
  'Droit commercial',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '15 décembre 2010',
  'official',
  'verified',
  'fr'
),
(
  'AUDCG — Obligation d''immatriculation du commerçant',
  'AUDCG 2010, Art. 25',
  'Article 25',
  'Toute personne physique ayant la qualité de commerçant est tenue de requérir son immatriculation au Registre du Commerce et du Crédit Mobilier.',
  'Article 25 : Toute personne physique ayant la qualité de commerçant est tenue de requérir son immatriculation au Registre du Commerce et du Crédit Mobilier du lieu de son établissement principal dans le délai d''un mois suivant le début de son activité commerciale. Elle doit également requérir son immatriculation dans chacun des ressorts où elle a un établissement secondaire. La demande d''immatriculation est faite par le commerçant lui-même ou par son mandataire dûment habilité.',
  25,
  'Droit commercial',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '15 décembre 2010',
  'official',
  'verified',
  'fr'
),
(
  'AUDCG — Fonds de commerce : définition et éléments',
  'AUDCG 2010, Art. 103',
  'Article 103',
  'Le fonds de commerce est constitué par un ensemble de moyens qui permettent au commerçant d''attirer et de conserver une clientèle.',
  'Article 103 : Le fonds de commerce est constitué par un ensemble de moyens qui permettent au commerçant d''attirer et de conserver une clientèle. Il comprend nécessairement la clientèle et l''enseigne ou le nom commercial. Il peut comprendre aussi, notamment, le droit au bail, les licences d''exploitation, les brevets d''invention, les marques de fabrique et de commerce, les dessins et modèles industriels et les droits de propriété intellectuelle.',
  103,
  'Droit commercial',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '15 décembre 2010',
  'official',
  'verified',
  'fr'
),
(
  'AUDCG — Bail commercial : durée minimale',
  'AUDCG 2010, Art. 102',
  'Article 102',
  'Le bail commercial est le contrat par lequel le propriétaire d''un immeuble ou d''une partie d''un immeuble donne en location des locaux à usage commercial.',
  'Article 102 : Le bail commercial est le contrat par lequel le propriétaire d''un immeuble ou d''une partie d''un immeuble donne en location des locaux à usage commercial, industriel, artisanal ou professionnel à un preneur qui s''oblige à payer un loyer et à exploiter les locaux conformément à leur destination. Tout bail d''immeuble ou de locaux dans lequel un fonds de commerce est exploité, qu''il ait été consenti par le propriétaire de ce fonds ou par un locataire principal, est soumis aux dispositions du présent Acte uniforme, dès lors que ce fonds est inscrit au Registre du Commerce et du Crédit Mobilier.',
  102,
  'Droit commercial',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '15 décembre 2010',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. ACTE UNIFORME OHADA RELATIF AU DROIT DES SOCIETES COMMERCIALES
--    ET DU GROUPEMENT D'INTERET ECONOMIQUE (AUSCGIE — révisé 2014)
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'AUSCGIE — Définition et formes de sociétés commerciales',
  'AUSCGIE 2014, Art. 6',
  'Article 6',
  'La société commerciale est créée par deux ou plusieurs personnes qui conviennent, par un contrat, d''affecter à une activité des biens en numéraire ou en nature, dans le but de partager le bénéfice ou de profiter de l''économie qui pourra en résulter.',
  'Article 6 : La société commerciale est créée par deux ou plusieurs personnes qui conviennent, par un contrat, d''affecter à une activité des biens en numéraire ou en nature, dans le but de partager le bénéfice ou de profiter de l''économie qui pourra en résulter. Les associés s''engagent à contribuer aux pertes dans les conditions prévues par le présent Acte uniforme. La société commerciale doit être créée dans l''intérêt commun des associés. Les formes de sociétés commerciales reconnues par le présent Acte uniforme sont : la société en nom collectif (SNC) ; la société en commandite simple (SCS) ; la société à responsabilité limitée (SARL) ; la société anonyme (SA) ; la société par actions simplifiée (SAS) ; la société en commandite par actions (SCA).',
  6,
  'Droit des sociétés',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '30 janvier 2014',
  'official',
  'verified',
  'fr'
),
(
  'AUSCGIE — Société à Responsabilité Limitée (SARL) : capital minimum',
  'AUSCGIE 2014, Art. 311',
  'Article 311',
  'La société à responsabilité limitée est une société dans laquelle les associés ne sont responsables des dettes sociales qu''à concurrence de leurs apports.',
  'Article 311 : La société à responsabilité limitée est une société dans laquelle les associés ne sont responsables des dettes sociales qu''à concurrence de leurs apports et dont les droits sont représentés par des parts sociales. Elle peut être constituée par une personne physique ou morale, ou entre deux ou plusieurs personnes physiques ou morales. Le capital social est divisé en parts sociales égales. Le montant du capital social est fixé par les associés dans les statuts. Il ne peut être inférieur à un million (1 000 000) de francs CFA. Toutefois, les États parties peuvent fixer un capital minimum plus élevé pour certaines activités réglementées.',
  311,
  'Droit des sociétés',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '30 janvier 2014',
  'official',
  'verified',
  'fr'
),
(
  'AUSCGIE — Société Anonyme (SA) : capital minimum',
  'AUSCGIE 2014, Art. 387',
  'Article 387',
  'La société anonyme est une société dans laquelle les actionnaires ne sont responsables des dettes sociales qu''à concurrence de leurs apports.',
  'Article 387 : La société anonyme est une société dans laquelle les actionnaires ne sont responsables des dettes sociales qu''à concurrence de leurs apports et dont les droits des actionnaires sont représentés par des actions. Elle peut ne comprendre qu''un seul actionnaire. Le capital social minimum est de dix millions (10 000 000) de francs CFA. Toutefois, pour les sociétés faisant appel public à l''épargne, le capital social minimum est de cent millions (100 000 000) de francs CFA. Les actions sont nominatives ou au porteur.',
  387,
  'Droit des sociétés',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '30 janvier 2014',
  'official',
  'verified',
  'fr'
),
(
  'AUSCGIE — Dissolution et liquidation des sociétés',
  'AUSCGIE 2014, Art. 200',
  'Article 200',
  'La société prend fin par l''expiration du temps pour lequel elle a été constituée, la réalisation ou l''extinction de son objet, la dissolution anticipée décidée par les associés.',
  'Article 200 : La société prend fin par : — l''expiration du temps pour lequel elle a été constituée ; — la réalisation ou l''extinction de son objet ; — la dissolution anticipée décidée par les associés ; — la dissolution judiciaire prononcée par la juridiction compétente à la demande d''un associé pour justes motifs, notamment en cas d''inexécution de ses obligations par un associé, ou de mésentente entre associés paralysant le fonctionnement de la société ; — l''annulation du contrat de société ; — toute autre cause prévue par les statuts. La dissolution de la société entraîne sa liquidation. La personnalité morale de la société subsiste pour les besoins de la liquidation jusqu''à la clôture de celle-ci.',
  200,
  'Droit des sociétés',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '30 janvier 2014',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. CODE DU TRAVAIL DU CAMEROUN (Loi n° 92/007 du 14 août 1992)
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'Code du Travail du Cameroun — Champ d''application',
  'CT Cameroun 1992, Art. 1',
  'Article 1',
  'Le présent Code régit les relations entre employeurs et travailleurs résultant des contrats de travail conclus pour être exécutés sur le territoire de la République du Cameroun.',
  'Article 1 : (1) Le présent Code régit les relations entre employeurs et travailleurs résultant des contrats de travail conclus pour être exécutés sur le territoire de la République du Cameroun, quelle que soit la nationalité des parties. (2) Il s''applique également aux travailleurs camerounais recrutés au Cameroun pour être employés à l''étranger, sauf dispositions contraires des conventions internationales du travail ratifiées par le Cameroun. (3) Sont soumis aux dispositions du présent Code, les travailleurs des entreprises publiques, des établissements publics à caractère industriel et commercial et des sociétés à capital public, sauf dispositions législatives ou réglementaires contraires.',
  1,
  'Droit du travail',
  'Assemblée Nationale du Cameroun',
  '14 août 1992',
  'official',
  'verified',
  'fr'
),
(
  'Code du Travail du Cameroun — Définition du contrat de travail',
  'CT Cameroun 1992, Art. 23',
  'Article 23',
  'Le contrat de travail est une convention par laquelle une personne physique s''engage à mettre son activité professionnelle sous la direction et l''autorité d''une autre personne physique ou morale, moyennant rémunération.',
  'Article 23 : (1) Le contrat de travail est une convention par laquelle une personne physique s''engage à mettre son activité professionnelle sous la direction et l''autorité d''une autre personne physique ou morale, moyennant rémunération. (2) Le contrat de travail peut être conclu pour une durée indéterminée ou pour une durée déterminée. (3) Le contrat de travail à durée déterminée est celui dont le terme est fixé à l''avance par les parties. Il ne peut être conclu que pour l''exécution d''une tâche précise et temporaire et seulement dans les cas énumérés par la loi. (4) Le contrat de travail à durée indéterminée est celui dont le terme n''est pas fixé à l''avance.',
  23,
  'Droit du travail',
  'Assemblée Nationale du Cameroun',
  '14 août 1992',
  'official',
  'verified',
  'fr'
),
(
  'Code du Travail du Cameroun — Durée légale du travail',
  'CT Cameroun 1992, Art. 80',
  'Article 80',
  'La durée légale du travail des employés est fixée à quarante heures par semaine pour toutes les entreprises.',
  'Article 80 : (1) La durée légale du travail des employés est fixée à quarante (40) heures par semaine pour toutes les entreprises, quels que soient leur forme juridique et leur activité. (2) Des décrets pris après avis du Comité National du Travail peuvent prévoir des modalités particulières d''application de la durée légale du travail dans certaines branches d''activité ou certaines catégories d''entreprises. (3) Les heures effectuées au-delà de la durée légale donnent lieu à une majoration de salaire dont le taux est fixé par décret.',
  80,
  'Droit du travail',
  'Assemblée Nationale du Cameroun',
  '14 août 1992',
  'official',
  'verified',
  'fr'
),
(
  'Code du Travail du Cameroun — Congé annuel payé',
  'CT Cameroun 1992, Art. 89',
  'Article 89',
  'Tout travailleur a droit, après une période de travail effectif d''un an chez le même employeur, à un congé annuel payé.',
  'Article 89 : (1) Tout travailleur a droit, après une période de travail effectif d''un an chez le même employeur, à un congé annuel payé à la charge de celui-ci. (2) La durée du congé est fixée à un jour et demi ouvrable par mois de service effectif, soit dix-huit jours ouvrables pour douze mois de service. (3) Cette durée est augmentée d''un jour ouvrable supplémentaire par période de cinq ans d''ancienneté dans l''entreprise. (4) Les femmes salariées bénéficient de deux jours ouvrables supplémentaires par enfant à charge âgé de moins de quinze ans.',
  89,
  'Droit du travail',
  'Assemblée Nationale du Cameroun',
  '14 août 1992',
  'official',
  'verified',
  'fr'
),
(
  'Code du Travail du Cameroun — Licenciement pour motif personnel',
  'CT Cameroun 1992, Art. 34',
  'Article 34',
  'Tout licenciement d''un travailleur doit être justifié par un motif réel et sérieux.',
  'Article 34 : (1) Tout licenciement d''un travailleur doit être justifié par un motif réel et sérieux. (2) Constitue un motif réel et sérieux de licenciement : la faute lourde du travailleur ; l''insuffisance professionnelle ; la suppression de poste pour motif économique ; l''inaptitude physique dûment constatée par le médecin du travail. (3) Le licenciement d''un travailleur sans motif réel et sérieux est abusif. (4) En cas de licenciement abusif, le travailleur a droit à des dommages-intérêts dont le montant est fixé par la juridiction compétente en tenant compte notamment de l''ancienneté du travailleur dans l''entreprise, de son âge, de sa situation de famille et des usages de la profession.',
  34,
  'Droit du travail',
  'Assemblée Nationale du Cameroun',
  '14 août 1992',
  'official',
  'verified',
  'fr'
),
(
  'Code du Travail du Cameroun — Salaire minimum interprofessionnel garanti (SMIG)',
  'CT Cameroun 1992, Art. 61',
  'Article 61',
  'Un salaire minimum interprofessionnel garanti est fixé par décret, après avis du Comité National du Travail.',
  'Article 61 : (1) Un salaire minimum interprofessionnel garanti est fixé par décret, après avis du Comité National du Travail. Ce salaire minimum est applicable à tous les travailleurs régis par le présent Code, sans distinction de sexe, d''âge, de nationalité ou de statut. (2) Aucun salaire ne peut être inférieur au salaire minimum interprofessionnel garanti. (3) Le salaire minimum peut être révisé en fonction de l''évolution du coût de la vie et des conditions économiques générales. (4) Tout employeur qui verse un salaire inférieur au minimum légal est passible des sanctions prévues par le présent Code.',
  61,
  'Droit du travail',
  'Assemblée Nationale du Cameroun',
  '14 août 1992',
  'official',
  'verified',
  'fr'
),
(
  'Code du Travail du Cameroun — Protection de la maternité',
  'CT Cameroun 1992, Art. 84',
  'Article 84',
  'Toute femme salariée a droit à un congé de maternité de quatorze semaines dont six semaines avant la date présumée de l''accouchement.',
  'Article 84 : (1) Toute femme salariée a droit à un congé de maternité de quatorze (14) semaines dont six (6) semaines avant la date présumée de l''accouchement et huit (8) semaines après l''accouchement. (2) Il est interdit à tout employeur de licencier une femme en état de grossesse dûment constatée ou en congé de maternité. (3) Pendant le congé de maternité, la femme salariée perçoit une indemnité journalière à la charge des organismes de prévoyance sociale. (4) A l''expiration du congé de maternité, la femme salariée retrouve son emploi ou un emploi similaire avec une rémunération au moins équivalente.',
  84,
  'Droit du travail',
  'Assemblée Nationale du Cameroun',
  '14 août 1992',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. CODE CIVIL CAMEROUNAIS (applicable en zone francophone)
--    Ordonnance n° 81-02 du 29 juin 1981 portant organisation
--    de l'état civil et diverses dispositions relatives à l'état
--    des personnes physiques
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'Code Civil — Jouissance des droits civils',
  'CC Cameroun, Art. 7',
  'Article 7',
  'L''exercice des droits civils est indépendant de l''exercice des droits politiques, lesquels s''acquièrent et se conservent conformément aux lois constitutionnelles et électorales.',
  'Article 7 : L''exercice des droits civils est indépendant de l''exercice des droits politiques, lesquels s''acquièrent et se conservent conformément aux lois constitutionnelles et électorales. Tout Camerounais jouira des droits civils. L''étranger jouira au Cameroun des mêmes droits civils que ceux qui sont ou seront accordés aux Camerounais par les traités de la nation à laquelle cet étranger appartient.',
  7,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Domicile : définition',
  'CC Cameroun, Art. 102',
  'Article 102',
  'Le domicile de tout Camerounais, quant à l''exercice de ses droits civils, est au lieu où il a son principal établissement.',
  'Article 102 : Le domicile de tout Camerounais, quant à l''exercice de ses droits civils, est au lieu où il a son principal établissement. En cas de contestation, le domicile est déterminé par les juges du fond en tenant compte de l''ensemble des circonstances de fait. Le changement de domicile s''opère par le fait d''une habitation réelle dans un autre lieu, joint à l''intention d''y fixer son principal établissement.',
  102,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Mariage : conditions de fond',
  'CC Cameroun, Art. 144',
  'Article 144',
  'L''homme avant dix-huit ans révolus, la femme avant quinze ans révolus, ne peuvent contracter mariage.',
  'Article 144 : L''homme avant dix-huit (18) ans révolus, la femme avant quinze (15) ans révolus, ne peuvent contracter mariage. Il ne peut être accordé de dispense d''âge que pour des motifs graves et dans l''intérêt des futurs époux, par le Président de la République ou son délégué. Le consentement des deux futurs époux est indispensable à la formation du mariage. En cas d''incapacité, le consentement du représentant légal est requis.',
  144,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Effets du mariage : obligations des époux',
  'CC Cameroun, Art. 212',
  'Article 212',
  'Les époux se doivent mutuellement fidélité, secours, assistance.',
  'Article 212 : Les époux se doivent mutuellement fidélité, secours, assistance. Ils s''obligent mutuellement à une communauté de vie. Ils assurent ensemble la direction morale et matérielle de la famille. Ils pourvoient à l''éducation des enfants et préparent leur avenir. La femme contribue aux charges du mariage à concurrence de ses facultés.',
  212,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Divorce : causes',
  'CC Cameroun, Art. 229',
  'Article 229',
  'Le divorce peut être prononcé en cas de faute de l''un des époux, en cas de rupture de la vie commune, ou par consentement mutuel.',
  'Article 229 : Le divorce peut être prononcé : — en cas de faute de l''un des époux constituant une violation grave ou renouvelée des devoirs et obligations du mariage rendant intolérable le maintien de la vie commune ; — en cas de rupture de la vie commune lorsque les époux vivent séparés de fait depuis deux ans au moins ; — par consentement mutuel lorsque les époux demandent ensemble le divorce en soumettant à l''approbation du juge un projet de convention réglant les conséquences du divorce. Le juge prononce le divorce après s''être assuré que la volonté de chacun des époux est réelle et que leur consentement est libre et éclairé.',
  229,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Filiation : présomption de paternité',
  'CC Cameroun, Art. 312',
  'Article 312',
  'L''enfant conçu pendant le mariage a pour père le mari.',
  'Article 312 : L''enfant conçu pendant le mariage a pour père le mari. La paternité du mari est présumée pour tout enfant né pendant le mariage ou dans les trois cents jours qui suivent la dissolution ou l''annulation du mariage. Cette présomption peut être écartée lorsqu''il est établi que le mari n''est pas le père de l''enfant. L''action en désaveu de paternité est ouverte au mari dans les six mois à compter du jour où il a eu connaissance de la naissance.',
  312,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Successions : ordre des héritiers',
  'CC Cameroun, Art. 731',
  'Article 731',
  'Les successions sont dévolues selon l''ordre et les règles ci-après déterminés, sans préjudice des droits du conjoint survivant.',
  'Article 731 : Les successions sont dévolues selon l''ordre et les règles ci-après déterminés, sans préjudice des droits du conjoint survivant. Les enfants et leurs descendants succèdent à leurs père et mère ou autres ascendants, sans distinction de sexe ni de primogéniture, et encore qu''ils soient issus de différentes unions. En l''absence de descendants, les ascendants et les collatéraux sont appelés à la succession dans les conditions prévues par la loi. Le conjoint survivant hérite en concours avec les autres héritiers selon les dispositions légales applicables.',
  731,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Contrats : conditions de validité',
  'CC Cameroun, Art. 1108',
  'Article 1108',
  'Quatre conditions sont essentielles pour la validité d''une convention : le consentement de la partie qui s''oblige ; sa capacité de contracter ; un objet certain qui forme la matière de l''engagement ; une cause licite dans l''obligation.',
  'Article 1108 : Quatre conditions sont essentielles pour la validité d''une convention : le consentement de la partie qui s''oblige ; sa capacité de contracter ; un objet certain qui forme la matière de l''engagement ; une cause licite dans l''obligation. Le consentement n''est point valable s''il n''a été donné que par erreur, ou s''il a été extorqué par violence ou surpris par dol. La violence exercée contre celui qui a contracté l''obligation est une cause de nullité, encore qu''elle ait été exercée par un tiers autre que celui au profit duquel la convention a été faite.',
  1108,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Responsabilité civile délictuelle',
  'CC Cameroun, Art. 1382',
  'Article 1382',
  'Tout fait quelconque de l''homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer.',
  'Article 1382 : Tout fait quelconque de l''homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer. Chacun est responsable du dommage qu''il a causé non seulement par son fait, mais encore par sa négligence ou par son imprudence. On est responsable non seulement du dommage que l''on cause par son propre fait, mais encore de celui qui est causé par le fait des personnes dont on doit répondre, ou des choses que l''on a sous sa garde.',
  1382,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
),
(
  'Code Civil — Propriété : définition',
  'CC Cameroun, Art. 544',
  'Article 544',
  'La propriété est le droit de jouir et disposer des choses de la manière la plus absolue, pourvu qu''on n''en fasse pas un usage prohibé par les lois ou par les règlements.',
  'Article 544 : La propriété est le droit de jouir et disposer des choses de la manière la plus absolue, pourvu qu''on n''en fasse pas un usage prohibé par les lois ou par les règlements. Nul ne peut être contraint de céder sa propriété, si ce n''est pour cause d''utilité publique, et moyennant une juste et préalable indemnité. La propriété du sol emporte la propriété du dessus et du dessous.',
  544,
  'Droit civil',
  'Assemblée Nationale du Cameroun',
  '29 juin 1981',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. ACTE UNIFORME OHADA PORTANT ORGANISATION DES PROCEDURES
--    COLLECTIVES D'APUREMENT DU PASSIF (AUPCAP — révisé 2015)
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'AUPCAP — Champ d''application des procédures collectives',
  'AUPCAP 2015, Art. 1',
  'Article 1',
  'Le présent Acte uniforme a vocation à s''appliquer à toute personne physique ou morale commerçante, et à toute personne morale de droit privé non commerçante.',
  'Article 1 : Le présent Acte uniforme a vocation à s''appliquer à toute personne physique ou morale commerçante, et à toute personne morale de droit privé non commerçante, ainsi qu''à toute entreprise publique ayant la forme d''une personne morale de droit privé, en cessation des paiements ou dont la situation financière est irrémédiablement compromise. Les procédures collectives d''apurement du passif sont : le règlement préventif ; le redressement judiciaire ; la liquidation des biens.',
  1,
  'Droit des affaires',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '10 septembre 2015',
  'official',
  'verified',
  'fr'
),
(
  'AUPCAP — Cessation des paiements : définition',
  'AUPCAP 2015, Art. 25',
  'Article 25',
  'La cessation des paiements est l''état où le débiteur se trouve dans l''impossibilité de faire face à son passif exigible avec son actif disponible.',
  'Article 25 : La cessation des paiements est l''état où le débiteur se trouve dans l''impossibilité de faire face à son passif exigible avec son actif disponible, à l''exclusion des réserves de crédit ou des délais que les créanciers lui consentiraient volontairement. Le débiteur qui est en cessation des paiements doit faire une déclaration aux fins d''obtenir l''ouverture d''une procédure de redressement judiciaire ou de liquidation des biens dans les trente jours qui suivent la cessation des paiements.',
  25,
  'Droit des affaires',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '10 septembre 2015',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. ACTE UNIFORME OHADA RELATIF AU DROIT DE L'ARBITRAGE (2017)
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'AUA OHADA — Champ d''application de l''arbitrage',
  'AUA OHADA 2017, Art. 1',
  'Article 1',
  'Le présent Acte uniforme a vocation à s''appliquer à tout arbitrage lorsque le siège du tribunal arbitral se trouve dans l''un des États parties.',
  'Article 1 : Le présent Acte uniforme a vocation à s''appliquer à tout arbitrage lorsque le siège du tribunal arbitral se trouve dans l''un des États parties au Traité relatif à l''Harmonisation du Droit des Affaires en Afrique, que les parties à la convention d''arbitrage soient des personnes physiques ou morales de droit public ou de droit privé. Les États et les autres collectivités publiques territoriales ainsi que les établissements publics peuvent également être parties à un arbitrage, sans pouvoir invoquer leur propre droit pour contester l''arbitrabilité d''un litige, leur capacité à compromettre ou la validité de la convention d''arbitrage.',
  1,
  'Droit de l''arbitrage',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '23 novembre 2017',
  'official',
  'verified',
  'fr'
),
(
  'AUA OHADA — Convention d''arbitrage : définition et forme',
  'AUA OHADA 2017, Art. 3',
  'Article 3',
  'La convention d''arbitrage est la clause compromissoire ou le compromis par lesquels les parties décident de soumettre à l''arbitrage les litiges nés ou à naître entre elles.',
  'Article 3 : La convention d''arbitrage est la clause compromissoire ou le compromis par lesquels les parties décident de soumettre à l''arbitrage les litiges nés ou à naître entre elles d''un rapport de droit contractuel ou non contractuel. La convention d''arbitrage doit être faite par écrit ou par tout autre moyen permettant d''en administrer la preuve, notamment par la référence faite dans un contrat à un document contenant une clause d''arbitrage. La convention d''arbitrage est indépendante du contrat principal. Sa validité n''est pas affectée par la nullité de ce contrat.',
  3,
  'Droit de l''arbitrage',
  'OHADA — Organisation pour l''Harmonisation en Afrique du Droit des Affaires',
  '23 novembre 2017',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. LOI N° 2003/008 DU 10 JUILLET 2003 PORTANT REPRESSION
--    DES INFRACTIONS CONTENUES DANS CERTAINS ACTES UNIFORMES OHADA
-- ============================================================

INSERT INTO public.legal_provisions
  (title, reference, article, excerpt, full_text, page_number, domain, authority, provision_date, provenance, legal_status, language)
VALUES
(
  'Loi pénale OHADA Cameroun — Infractions relatives aux sociétés commerciales',
  'Loi 2003/008 Cameroun, Art. 1',
  'Article 1',
  'La présente loi a pour objet de réprimer les infractions contenues dans certains Actes uniformes adoptés par l''OHADA.',
  'Article 1 : La présente loi a pour objet de réprimer les infractions contenues dans certains Actes uniformes adoptés par l''Organisation pour l''Harmonisation en Afrique du Droit des Affaires (OHADA), notamment l''Acte uniforme relatif au droit des sociétés commerciales et du groupement d''intérêt économique, l''Acte uniforme portant organisation des procédures collectives d''apurement du passif, et l''Acte uniforme relatif au droit commercial général. Les infractions prévues par la présente loi sont punies des peines prévues par le Code Pénal camerounais, sans préjudice des dispositions plus sévères qui pourraient être applicables.',
  1,
  'Droit pénal des affaires',
  'Assemblée Nationale du Cameroun',
  '10 juillet 2003',
  'official',
  'verified',
  'fr'
)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Seed migration completed: OHADA and Cameroon legal texts inserted successfully.';

END $$;
