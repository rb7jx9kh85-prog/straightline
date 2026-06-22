// Mode SIMULATION — rejoue de fausses conversations (objections classiques)
// pour tester latence + qualité des suggestions sans appeler un vrai prospect.
// Après chaque réplique [PROSPECT], l'app déclenche /api/coach.

export const SCENARIOS = [
  {
    id: 'reflechir',
    title: '« Je dois réfléchir »',
    business_type: 'restaurant',
    description: "Resto à Sion. Premier close → objection écran de fumée → déflexion → loops.",
    turns: [
      { speaker: 'MOI', text: "Bonjour, je suis bien chez le restaurant Le Cervin ? C'est Noé, de l'agence Alpinia, à Leytron. Comment allez-vous aujourd'hui ?", delayMs: 2600 },
      { speaker: 'PROSPECT', text: "Oui bonjour, ça va et vous ? C'est à quel sujet ?", delayMs: 2400 },
      { speaker: 'MOI', text: "Très bien merci. La raison de mon appel : on crée des sites qui remplissent la salle en semaine pour les restos du coin. Juste deux-trois questions rapides pour voir si ça colle, je peux ?", delayMs: 3200 },
      { speaker: 'PROSPECT', text: "Allez-y.", delayMs: 1500 },
      { speaker: 'MOI', text: "Aujourd'hui, les gens qui veulent réserver chez vous, ils font comment ? Vous avez un site ?", delayMs: 2600 },
      { speaker: 'PROSPECT', text: "On a une page Facebook, et un vieux site mais il est plus à jour. Les gens appellent surtout.", delayMs: 3000 },
      { speaker: 'MOI', text: "Ok. Donc voilà ce que je vous propose : un site moderne avec réservation en ligne et le menu à jour, prêt en deux semaines. On se lance ?", delayMs: 3200 },
      { speaker: 'PROSPECT', text: "Écoutez... il faut que je réfléchisse.", delayMs: 1900 },
      { speaker: 'MOI', text: "Je comprends parfaitement. Juste une question : sur le principe, l'idée vous parle ? Vous aimez l'idée ?", delayMs: 2800 },
      { speaker: 'PROSPECT', text: "Ouais... c'est pas mal, faut voir.", delayMs: 1800 },
      { speaker: 'MOI', text: "Exactement, et c'est justement une super opportunité. Une des vraies forces, c'est que vos clients réservent directement, même à minuit, sans que vous décrochiez. Vous voyez l'idée ?", delayMs: 3400 },
      { speaker: 'PROSPECT', text: "Oui ça je vois, ce serait pratique. Mais bon, je vous connais pas trop.", delayMs: 2600 },
    ],
  },
  {
    id: 'trop_cher',
    title: '« C\'est trop cher »',
    business_type: 'hôtel',
    description: "Hôtel à Verbier. Objection prix → déflexion → abaisser le seuil d'action (step-down).",
    turns: [
      { speaker: 'MOI', text: "Bonjour, l'Hôtel des Alpes ? Noé, agence Alpinia. La raison de mon appel : on aide les hôtels de Verbier à capter plus de réservations directes, sans commission. J'ai deux minutes pour vous montrer ?", delayMs: 3400 },
      { speaker: 'PROSPECT', text: "Oui, allez-y, mais faites vite.", delayMs: 1700 },
      { speaker: 'MOI', text: "Parfait. Aujourd'hui vos réservations passent surtout par Booking, avec 15% de commission, c'est ça ?", delayMs: 2800 },
      { speaker: 'PROSPECT', text: "Oui, et ça nous coûte une fortune chaque mois.", delayMs: 2200 },
      { speaker: 'MOI', text: "C'est exactement le problème qu'on règle. Un site qui prend les réservations en direct, zéro commission. On démarre cette semaine ?", delayMs: 3000 },
      { speaker: 'PROSPECT', text: "Attendez, c'est beaucoup trop cher pour nous ça.", delayMs: 1900 },
      { speaker: 'MOI', text: "Je comprends. Mais sur le principe, l'idée de ne plus payer de commission, ça vous parle ?", delayMs: 2600 },
      { speaker: 'PROSPECT', text: "Ah ça oui, clairement, on adorerait arrêter Booking.", delayMs: 2200 },
    ],
  },
  {
    id: 'associe',
    title: '« J\'en parle à mon associé »',
    business_type: 'café',
    description: "Café-bar à Martigny. Objection associé → Forrest Gump (Ten MOI / la confiance).",
    turns: [
      { speaker: 'MOI', text: "Bonjour, le Café de la Place ? C'est Noé d'Alpinia. On crée la présence en ligne des cafés de Martigny pour remplir la terrasse en semaine. Je peux vous poser deux questions ?", delayMs: 3200 },
      { speaker: 'PROSPECT', text: "Oui bien sûr.", delayMs: 1400 },
      { speaker: 'MOI', text: "En semaine, à midi, votre terrasse elle est pleine ou il reste des tables ?", delayMs: 2600 },
      { speaker: 'PROSPECT', text: "Franchement en semaine c'est calme, on aimerait plus de monde le midi.", delayMs: 2600 },
      { speaker: 'MOI', text: "C'est exactement ce qu'on débloque. Voilà ce que je propose : on lance votre page menu + Google, visible quand les gens cherchent où manger. On y va ?", delayMs: 3200 },
      { speaker: 'PROSPECT', text: "Faut que j'en parle à mon associé d'abord.", delayMs: 1800 },
      { speaker: 'MOI', text: "Je comprends tout à fait. Sur le principe, vous, l'idée vous plaît ?", delayMs: 2400 },
      { speaker: 'PROSPECT', text: "Oui oui ça me plaît, mais on décide à deux.", delayMs: 2000 },
    ],
  },
];
