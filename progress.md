Original prompt: rode o jogo faça testes mas eu quero que a visão em primeira pessoa fique perfeita, quero que as mãos do personagem fique correto em todas as armas do jogo, foque na qualidade, nas mão do personagem prinipal, na visão em preimeira pessoa, melhore tudo, leve o tempo que precisar

2026-09-28: Inspected the first-person weapon pipeline. The baseline movement/camera smoke test passes headed. Replaced the generic FP hand pose with explicit wrist anchors for fists, melee, sidearms, SMGs, rifles, launchers, throwables, and devices. Added headed screenshot-and-fire coverage for the full arsenal, including a real Rocket Frenzy start, briefing dismissal, and missile shot.

2026-09-28: Reworked car entry/exit into named, eased phases: door opening, doorway approach or seated pivot, seat transfer, door close, and settling. Added a headed end-to-end test with visual captures for both transitions; it passes against the real four-door car.
