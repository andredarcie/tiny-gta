# Pipeline de animações do Mixamo → Tiny Crime

Tooling para **baixar** animações do Adobe Mixamo em lote e **integrá-las** ao sistema
de animação do jogo. Tudo aqui é **dev-only** (não entra no build do jogo).

> ⚠️ O `mixamo_cli.py` usa a API **interna/não-oficial** do Mixamo (engenharia reversa).
> Pode quebrar a qualquer momento e é zona cinzenta de ToS — use com a sua conta, uso pessoal.

---

## 1. Setup (uma vez)

```bash
cd tools/mixamo
pip install -r requirements.txt          # instala 'requests'
cp mixamo_config.example.json mixamo_config.json
```

Preencha `mixamo_config.json`:
1. Login em <https://www.mixamo.com> e suba/rigge um personagem (Upload Character → Auto-Rigger).
2. **access_token** → F12 > Console > `localStorage.access_token` (cole o valor).
3. **character_id** → pode deixar `""` (o script auto-detecta o personagem primário).
   Se quiser fixar: baixe 1 anim, na aba Network ache `export`/`monitor`, o id está na URL
   `.../characters/<ID>/...`.

> `mixamo_config.json` e a pasta `fbx/` estão no `.gitignore` — o token é privado e os FBX são binários grandes.

## 2. Baixar

```bash
python mixamo_cli.py --search "swim"             # só LISTA o que casa com o termo
python mixamo_cli.py --get "Swimming"            # baixa "Swimming" (sem skin) -> ./fbx/
python mixamo_cli.py --get "Idle,Running,Jump"   # várias de uma vez
python mixamo_cli.py --query "pistol" --max 10   # baixa até 10 resultados da busca
python mixamo_cli.py --get "Walking" --skin      # COM skin = malha + rig do personagem-base
python mixamo_cli.py --out ./fbx --fps 30 --get "Swimming"
```

- **`--skin`**: baixa o personagem (malha rigada) junto. Use **uma vez** pra ter a base; as
  animações em si baixe **sem** skin (só o clip, FBX bem menor).
- Saída padrão: `tools/mixamo/fbx/` (gitignored).

---

## 3. Integrar no jogo — leia isto antes

O jogo carrega **um FBX rigado** (`public/models/player.fbx` pro herói, `public/models/npc/*.fbx`
pros NPCs) com **vários clips assados dentro**, via `FBXLoader`, e mapeia os clips por nome.
A máquina de estados (`js/actors/anim-fsm.ts`, enum `AnimState`) toca cada clip/pose.

### ⚠️ O problema do esqueleto
- O rig atual é o **"HumanArmature"** (Quaternius): ossos `UpperArmL`, `LowerLegL`, `FootL`, `PalmR`, …
- O Mixamo entrega o esqueleto **"mixamorig"**: ossos `mixamorig:LeftArm`, `mixamorig:LeftUpLeg`, …

Os nomes são **diferentes**, e o código do jogo referencia os nomes do HumanArmature em vários
lugares (solda do pé, IK do joelho, todas as poses em `glb-poses.ts`, `AIM_POSE`, `vehicle-pose.ts`).
Então **um clip do Mixamo não cai direto** no rig atual — precisa de *retarget* (mapear ossos).

### Mapa de ossos (mixamorig → HumanArmature)
| Mixamo | Jogo | | Mixamo | Jogo |
|---|---|---|---|---|
| `mixamorig:Hips` | `Hips` | | `mixamorig:Neck` | `Neck` |
| `mixamorig:Spine` | `Abdomen` | | `mixamorig:Head` | `Head` |
| `mixamorig:Spine1` | `Torso` | | `mixamorig:LeftShoulder` | `ShoulderL` |
| `mixamorig:LeftArm` | `UpperArmL` | | `mixamorig:RightShoulder` | `ShoulderR` |
| `mixamorig:LeftForeArm` | `LowerArmL` | | `mixamorig:RightArm` | `UpperArmR` |
| `mixamorig:LeftHand` | `PalmL` | | `mixamorig:RightForeArm` | `LowerArmR` |
| `mixamorig:LeftUpLeg` | `UpperLegL` | | `mixamorig:RightHand` | `PalmR` |
| `mixamorig:LeftLeg` | `LowerLegL` | | `mixamorig:RightUpLeg` | `UpperLegR` |
| `mixamorig:LeftFoot` | `FootL` | | `mixamorig:RightLeg` | `LowerLegR` |
| | | | `mixamorig:RightFoot` | `FootR` |

### Caminho A — retarget no Blender e assar num FBX (recomendado p/ poucos clips)
Sem custo em runtime e visualmente o mais confiável.
1. Baixe a anim **sem** skin → FBX com esqueleto mixamorig + 1 clip.
2. No Blender: importe o personagem Quaternius do jogo + o clip do Mixamo, faça o **retarget**
   (addon *Rokoko* / *Auto-Rig Pro* / *Animation Retargeting*) usando o mapa acima.
3. Renomeie o clip para `HumanArmature|Man_<Nome>` e exporte **todos os clips num único FBX**
   (igual o `player.fbx` atual).
4. Substitua `public/models/player.fbx`.
5. Registre o clip no código (ver checklist abaixo).

### Caminho B — retarget em runtime, só código (sem Blender)
Three.js tem `SkeletonUtils.retargetClip(targetSkel, sourceSkel, clip, {names})`. Dá pra carregar
o FBX do Mixamo, pegar o `AnimationClip` e retargetar pro esqueleto HumanArmature com o mapa acima.
- ✅ Sem Blender, só dropar o FBX e registrar.
- ⚠️ mixamorig e HumanArmature têm **rest pose / orientação de osso diferentes**, então o retarget
  automático pode sair torto e precisar de ajuste. Bom pra testar; não garante limpo.
- **Posso implementar esse loader** se você quiser ir por aqui — me avise.

### Caminho C — trocar o pipeline todo pro mixamorig (maior)
Usar um personagem rigado pelo Mixamo e carregar cada anim como FBX separado (mesmo esqueleto →
clips aplicam direto; adicionar anim = dropar o FBX). **Mas** exige reescrever todo o código preso
aos nomes do HumanArmature (solda do pé, IK, `glb-poses.ts`, `vehicle-pose.ts`, `AIM_POSE`).
Refator grande — só vale se a ideia for migrar de vez pro ecossistema Mixamo.

---

## 4. Checklist — registrar um clip novo no código

Depois que o clip estiver no rig do jogo (Caminho A ou B), são 3 toques:

1. **`assets/models/characters/player-glb.ts`** → `CLIP_KEYS`: mapeie o nome do clip para uma
   chave limpa, ex.: `'HumanArmature|Man_Swimming': 'swim'`. (Se for one-shot, adicione em `ONE_SHOT`.)
   Pros NPCs, `assets/models/characters/npc-glb.ts` casa pelo **sufixo** (`SUFFIX`).
2. **`js/actors/anim-fsm.ts`** → `enum AnimState`: adicione o estado (ex.: já existe `Swim`).
3. **`js/actors/anim-fsm.ts`** → `STATE_TABLE`: aponte o estado pro clip
   (`{ clip: 'swim', legIK: true }`) ou pra uma pose. Pronto — o `/studio` já lista o novo estado.

> Lembrando: estados baseados em **clip** são fáceis (só os 3 passos). Estados baseados em **pose
> IK** (as de `glb-poses.ts`) são feitos sob medida pro rig HumanArmature — veja `tools/gen-glb-poses.ts`.
