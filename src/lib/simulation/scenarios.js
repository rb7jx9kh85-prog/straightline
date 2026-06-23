// Mode SIMULATION — rejoue de fausses conversations (objections classiques)
// pour tester latence + qualité des suggestions sans appeler un vrai prospect.
// Après chaque réplique [PROSPECT], l'app déclenche /api/coach.
//
// Chaque réplique [PROSPECT] embarque aussi une carte `coach` pré-écrite
// (méthode Straight Line). Elle sert de REPLI HORS-LIGNE : si l'API OpenAI est
// indisponible (clé sans crédit, quota dépassé, réseau…), l'app affiche cette
// carte au lieu d'une erreur — la démo reste pleinement jouable sans clé.

export const SCENARIOS = [
  {
    id: 'reflechir',
    title: '« Je dois réfléchir »',
    business_type: 'restaurant',
    description: "Resto à Sion. Premier close → objection écran de fumée → déflexion → loops.",
    turns: [
      { speaker: 'MOI', text: "Bonjour, je suis bien chez le restaurant Le Cervin ? C'est Noé, de l'agence Alpinia, à Leytron. Comment allez-vous aujourd'hui ?", delayMs: 2600 },
      {
        speaker: 'PROSPECT', text: "Oui bonjour, ça va et vous ? C'est à quel sujet ?", delayMs: 2400,
        coach: {
          phase: 'AVANT_LIGNE', ten_cible: null, certitude_estimee: 3, objection_detectee: 'aucune',
          phrase_a_dire: "Très bien, merci ! Je fais court : on aide les restaurants de la région à remplir leur salle en semaine grâce à un site qui prend les réservations en ligne. Je peux vous poser deux ou trois questions rapides ?",
          tonalite: ['enthousiaste mais raisonnable', "j'ai une raison précise d'appeler"],
          pourquoi: "Les 4 premières secondes décident de tout : sois vif, enthousiaste et expert, donne une raison claire et demande la permission de continuer.",
          prochain_coup: "Obtiens le « oui » pour les questions, puis qualifie (intelligence gathering).",
        },
      },
      { speaker: 'MOI', text: "Très bien merci. La raison de mon appel : on crée des sites qui remplissent la salle en semaine pour les restos du coin. Juste deux-trois questions rapides pour voir si ça colle, je peux ?", delayMs: 3200 },
      {
        speaker: 'PROSPECT', text: "Allez-y.", delayMs: 1500,
        coach: {
          phase: 'LIGNE_DROITE', ten_cible: 'PRODUIT', certitude_estimee: 4, objection_detectee: 'aucune',
          phrase_a_dire: "Parfait. Aujourd'hui, quand quelqu'un veut réserver chez vous, il fait comment — il appelle, il passe par Facebook ? Vous avez un site qui prend les réservations ?",
          tonalite: ['curiosité sincère', 'expert qui creuse'],
          pourquoi: "Tu as la permission : reste sur la ligne droite et récolte la douleur actuelle (canaux, réservations manquées) pour t'en servir en présentation.",
          prochain_coup: "Écoute la douleur (pas de réservation en ligne) et garde-la en mémoire.",
        },
      },
      { speaker: 'MOI', text: "Aujourd'hui, les gens qui veulent réserver chez vous, ils font comment ? Vous avez un site ?", delayMs: 2600 },
      {
        speaker: 'PROSPECT', text: "On a une page Facebook, et un vieux site mais il est plus à jour. Les gens appellent surtout.", delayMs: 3000,
        coach: {
          phase: 'PRESENTATION', ten_cible: 'PRODUIT', certitude_estimee: 5, objection_detectee: 'aucune',
          phrase_a_dire: "C'est exactement ce qu'on règle. Imaginez un site moderne, menu à jour, qui prend les réservations tout seul — même en plein service. Prêt en deux semaines. On se lance ?",
          tonalite: ['certitude absolue', 'vision enthousiaste'],
          pourquoi: "Tu tiens la douleur (appels uniquement, site mort) : présente le produit comme LA solution, monte la certitude sur le Ten n°1, puis tente le close.",
          prochain_coup: "Premier close. S'il hésite → déflexion, surtout ne pas baisser le prix.",
        },
      },
      { speaker: 'MOI', text: "Ok. Donc voilà ce que je vous propose : un site moderne avec réservation en ligne et le menu à jour, prêt en deux semaines. On se lance ?", delayMs: 3200 },
      {
        speaker: 'PROSPECT', text: "Écoutez... il faut que je réfléchisse.", delayMs: 1900,
        coach: {
          phase: 'DEFLEXION', ten_cible: 'PRODUIT', certitude_estimee: 5, objection_detectee: 'écran de fumée : « je dois réfléchir »',
          phrase_a_dire: "Je comprends parfaitement. Juste pour être sûr : sur le principe, l'idée vous plaît ? Vous aimez le concept ?",
          tonalite: ['raisonnable et posé', 'vraiment curieux'],
          pourquoi: "« Je dois réfléchir » est un écran de fumée. On dévie sans pression et on revient sur la ligne droite en testant la certitude produit.",
          prochain_coup: "S'il dit oui → loop sur le produit pour remonter la certitude.",
        },
      },
      { speaker: 'MOI', text: "Je comprends parfaitement. Juste une question : sur le principe, l'idée vous parle ? Vous aimez l'idée ?", delayMs: 2800 },
      {
        speaker: 'PROSPECT', text: "Ouais... c'est pas mal, faut voir.", delayMs: 1800,
        coach: {
          phase: 'LOOP_1', ten_cible: 'PRODUIT', certitude_estimee: 6, objection_detectee: 'tiédeur sur le produit',
          phrase_a_dire: "Exactement, et c'est justement une belle opportunité : vos clients réservent en direct, même à minuit, sans que vous décrochiez. Vous voyez l'intérêt, non ?",
          tonalite: ['enthousiasme qui rassure', 'certitude'],
          pourquoi: "Loop n°1 (le produit) : on renforce la certitude logique avec un bénéfice concret avant de passer à la confiance (Ten n°2).",
          prochain_coup: "Quand le produit est à 8+/10, loop sur TOI (la confiance).",
        },
      },
      { speaker: 'MOI', text: "Exactement, et c'est justement une super opportunité. Une des vraies forces, c'est que vos clients réservent directement, même à minuit, sans que vous décrochiez. Vous voyez l'idée ?", delayMs: 3400 },
      {
        speaker: 'PROSPECT', text: "Oui ça je vois, ce serait pratique. Mais bon, je vous connais pas trop.", delayMs: 2600,
        coach: {
          phase: 'LOOP_2_PLUS', ten_cible: 'MOI', certitude_estimee: 7, objection_detectee: 'manque de confiance (« je vous connais pas »)',
          phrase_a_dire: "C'est tout à fait normal, et vous avez raison d'être prudent. Justement : on a déjà refait le site de plusieurs restos du coin, et je reste votre interlocuteur direct du début à la fin. On part sur deux semaines, vous jugez sur pièces ?",
          tonalite: ['sincère et chaleureux', 'expert digne de confiance'],
          pourquoi: "La certitude produit est haute : l'objection bascule sur le Ten n°2 (toi). On bâtit la confiance avec des preuves locales et on réduit le risque perçu pour rapprocher du close.",
          prochain_coup: "Confiance OK → loop entreprise (Ten n°3) ou close direct.",
        },
      },
    ],
  },
  {
    id: 'trop_cher',
    title: '« C\'est trop cher »',
    business_type: 'hôtel',
    description: "Hôtel à Verbier. Objection prix → déflexion → abaisser le seuil d'action (step-down).",
    turns: [
      { speaker: 'MOI', text: "Bonjour, l'Hôtel des Alpes ? Noé, agence Alpinia. La raison de mon appel : on aide les hôtels de Verbier à capter plus de réservations directes, sans commission. J'ai deux minutes pour vous montrer ?", delayMs: 3400 },
      {
        speaker: 'PROSPECT', text: "Oui, allez-y, mais faites vite.", delayMs: 1700,
        coach: {
          phase: 'LIGNE_DROITE', ten_cible: 'PRODUIT', certitude_estimee: 3, objection_detectee: 'aucune',
          phrase_a_dire: "Promis, je fais vite. Aujourd'hui vos réservations passent surtout par Booking, avec la commission qui va avec, c'est bien ça ?",
          tonalite: ['respect du temps', 'expert efficace'],
          pourquoi: "Il te donne peu de temps : montre que tu respectes son agenda et pose tout de suite LA question qui révèle la douleur (commissions Booking).",
          prochain_coup: "Fais-lui ressentir/chiffrer la douleur des commissions.",
        },
      },
      { speaker: 'MOI', text: "Parfait. Aujourd'hui vos réservations passent surtout par Booking, avec 15% de commission, c'est ça ?", delayMs: 2800 },
      {
        speaker: 'PROSPECT', text: "Oui, et ça nous coûte une fortune chaque mois.", delayMs: 2200,
        coach: {
          phase: 'PRESENTATION', ten_cible: 'PRODUIT', certitude_estimee: 5, objection_detectee: 'aucune',
          phrase_a_dire: "C'est précisément le problème qu'on supprime : un site qui prend les réservations en direct, zéro commission. Ce que vous versez à Booking en un mois finance le site. On démarre cette semaine ?",
          tonalite: ['certitude absolue', 'enthousiaste'],
          pourquoi: "La douleur est explicite et chiffrée : présente le produit comme la solution exacte, ancre la valeur (le coût Booking) et tente le close.",
          prochain_coup: "Close. Objection prix probable → déflexion, ne JAMAIS casser le prix d'emblée.",
        },
      },
      { speaker: 'MOI', text: "C'est exactement le problème qu'on règle. Un site qui prend les réservations en direct, zéro commission. On démarre cette semaine ?", delayMs: 3000 },
      {
        speaker: 'PROSPECT', text: "Attendez, c'est beaucoup trop cher pour nous ça.", delayMs: 1900,
        coach: {
          phase: 'DEFLEXION', ten_cible: 'PRODUIT', certitude_estimee: 5, objection_detectee: 'prix (« trop cher »)',
          phrase_a_dire: "Je comprends. Mais sur le principe, l'idée de ne plus jamais payer de commission, ça vous parle ?",
          tonalite: ['raisonnable et calme', 'curiosité sincère'],
          pourquoi: "« Trop cher » est souvent un écran de fumée tant que la certitude n'est pas au maximum. On dévie sans baisser le prix et on revient tester l'envie (produit).",
          prochain_coup: "S'il adhère → remonte la certitude, puis abaisse le seuil d'action (formule de départ) plutôt que le prix.",
        },
      },
      { speaker: 'MOI', text: "Je comprends. Mais sur le principe, l'idée de ne plus payer de commission, ça vous parle ?", delayMs: 2600 },
      {
        speaker: 'PROSPECT', text: "Ah ça oui, clairement, on adorerait arrêter Booking.", delayMs: 2200,
        coach: {
          phase: 'LOOP_1', ten_cible: 'SEUIL_ACTION', certitude_estimee: 7, objection_detectee: 'prix / engagement',
          phrase_a_dire: "Alors faisons simple : on démarre avec la formule essentielle — réservation en direct, sans commission — à un budget léger ce mois-ci. Vous voyez les premières réservations tomber, et on étoffe ensuite. On lance comme ça ?",
          tonalite: ['enthousiaste', "ton de l'évidence"],
          pourquoi: "Forte envie + objection prix : on abaisse le SEUIL D'ACTION (step-down, petite première marche) sans dévaloriser l'offre, pour déclencher la décision.",
          prochain_coup: "S'il bloque encore → loop douleur (Ten n°5 : continuer à payer Booking).",
        },
      },
    ],
  },
  {
    id: 'associe',
    title: '« J\'en parle à mon associé »',
    business_type: 'café',
    description: "Café-bar à Martigny. Objection associé → Forrest Gump (Ten MOI / la confiance).",
    turns: [
      { speaker: 'MOI', text: "Bonjour, le Café de la Place ? C'est Noé d'Alpinia. On crée la présence en ligne des cafés de Martigny pour remplir la terrasse en semaine. Je peux vous poser deux questions ?", delayMs: 3200 },
      {
        speaker: 'PROSPECT', text: "Oui bien sûr.", delayMs: 1400,
        coach: {
          phase: 'LIGNE_DROITE', ten_cible: 'PRODUIT', certitude_estimee: 3, objection_detectee: 'aucune',
          phrase_a_dire: "Super. En semaine, le midi, votre terrasse est pleine ou il vous reste pas mal de tables ?",
          tonalite: ['curiosité sincère', 'léger et sympathique'],
          pourquoi: "Permission obtenue : pose la question qui fait émerger la douleur (midi calme en semaine) avant toute présentation.",
          prochain_coup: "Capte la douleur « midi creux » pour la réutiliser.",
        },
      },
      { speaker: 'MOI', text: "En semaine, à midi, votre terrasse elle est pleine ou il reste des tables ?", delayMs: 2600 },
      {
        speaker: 'PROSPECT', text: "Franchement en semaine c'est calme, on aimerait plus de monde le midi.", delayMs: 2600,
        coach: {
          phase: 'PRESENTATION', ten_cible: 'PRODUIT', certitude_estimee: 5, objection_detectee: 'aucune',
          phrase_a_dire: "C'est exactement ce qu'on débloque. On vous rend visible sur Google avec une vraie page menu, pile quand les gens cherchent où déjeuner autour de vous. On lance ça ?",
          tonalite: ['certitude', 'vision enthousiaste'],
          pourquoi: "La douleur est posée (midi creux) : présente la solution comme l'évidence et tente le close pendant que l'envie est chaude.",
          prochain_coup: "Close. Objection « associé » probable → déflexion puis Forrest Gump.",
        },
      },
      { speaker: 'MOI', text: "C'est exactement ce qu'on débloque. Voilà ce que je propose : on lance votre page menu + Google, visible quand les gens cherchent où manger. On y va ?", delayMs: 3200 },
      {
        speaker: 'PROSPECT', text: "Faut que j'en parle à mon associé d'abord.", delayMs: 1800,
        coach: {
          phase: 'DEFLEXION', ten_cible: 'MOI', certitude_estimee: 5, objection_detectee: 'tierce personne (associé)',
          phrase_a_dire: "Bien sûr, c'est normal de décider à deux. Mais vous, personnellement, sur le principe : l'idée vous plaît ?",
          tonalite: ['raisonnable', 'chaleureux'],
          pourquoi: "L'associé est souvent un écran de fumée. On isole d'abord SA conviction à lui avant de gérer le tiers absent.",
          prochain_coup: "S'il dit oui → Forrest Gump : il devient ton ambassadeur auprès de l'associé.",
        },
      },
      { speaker: 'MOI', text: "Je comprends tout à fait. Sur le principe, vous, l'idée vous plaît ?", delayMs: 2400 },
      {
        speaker: 'PROSPECT', text: "Oui oui ça me plaît, mais on décide à deux.", delayMs: 2000,
        coach: {
          phase: 'LOOP_2_PLUS', ten_cible: 'MOI', certitude_estimee: 7, objection_detectee: 'validation de l\'associé',
          phrase_a_dire: "Génial, et c'est vous qui le vivez au quotidien. Je vous propose ça : on cale 10 minutes à trois cette semaine, je présente tout à votre associé, vous n'avez rien à réexpliquer. Jeudi ou vendredi, vous préférez quand ?",
          tonalite: ['enthousiaste et sûr', "ton de l'évidence"],
          pourquoi: "Sa certitude est haute (Ten n°2 OK) : technique Forrest Gump — tu prends en charge le tiers, et tu closes sur un choix d'agenda plutôt que sur un oui/non.",
          prochain_coup: "Verrouille le rendez-vous à trois (close alternatif sur la date).",
        },
      },
    ],
  },
];
