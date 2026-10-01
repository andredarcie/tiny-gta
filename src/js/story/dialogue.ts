import type {CineLine,Voice} from '@/story/cutscene.ts';

// ============================================================================
// THE STORY'S DIALOGUE — every line spoken in the story's cut-scenes, as plain data
// (no THREE, no DOM), so the dubbing tool can read it (tools/voice/export-lines.ts →
// `npm run voice`). Each line carries a `speaker` id; its recorded voice clip, when one
// has been generated, lives in src/assets/audio/voice/ (see js/story/voices.ts) and the
// cut-scene plays it instead of the synth blips (`voice` stays as the fallback).
// Brazilian Portuguese on purpose (user request) — the rest of the game is English.
// ============================================================================

export const BOSS: Voice={freq:78,type:'sawtooth',phone:true};
export const YOU: Voice={freq:150,type:'square'};
export const PADRE: Voice={freq:112,type:'triangle'};
const boss=(text: string): CineLine=>({who:'O CHEFÃO',speaker:'boss',text,voice:BOSS,by:'npc'});
const you=(text: string): CineLine=>({who:'VOCÊ',speaker:'you',text,voice:YOU,by:'player'});
const padre=(text: string): CineLine=>({who:'PADRE ANSELMO',speaker:'priest',text,voice:PADRE,by:'npc'});
const crowd=(text: string): CineLine=>({who:'O POVO',speaker:'crowd',text,voice:{freq:210,type:'square'},by:'npc'});

export const CALL1: CineLine[]=[
  boss('Bem-vindo à Cidade do Pecado, meu amigo.'),
  boss('Coisas grandes acontecem nessa cidade. E você... você vai fazer coisas grandes. NÓS vamos fazer coisas grandes juntos.'),
  you('Quem tá falando?'),
  boss('Não importa quem eu sou. Importa o que você tá disposto a fazer.'),
  boss('Todo mundo que trabalha pra mim passa por um teste antes. Pode chamar de prova de admissão.'),
  boss('Lá na zona rural, depois da montanha, perto da estrada de Pine Hollow, tem um acampamento no meio do mato. Umas barracas, uma fogueira e seis caipiras armados.'),
  boss('Acaba com eles. Com os seis. Como você vai fazer isso é problema seu.'),
  boss('Deixei uns brinquedinhos em volta do acampamento pra você. Quando terminar, volta pra esse orelhão. Eu ligo.'),
];
export const CALL2: CineLine[]=[
  you('Tá feito. O acampamento tá limpo. Os seis.'),
  boss('...Você fez O QUÊ?'),
  boss('Você acha que isso aqui é videogame?! Você entrou naquele mato e matou seis pessoas a sangue frio!'),
  boss('Só porque uma voz num orelhão mandou? Podia ser qualquer um! Podia ser um trote!'),
  boss('Você acha que pode sair tirando a vida das pessoas assim?'),
  boss('...'),
  boss('Relaxa. Você passou no teste. Era exatamente isso que eu queria ver.'),
  boss('Mas aquelas pessoas tinham família. Eu quero que elas sejam respeitadas.'),
  boss('Volta lá no acampamento. Tem uma pá do lado da lenha. Seis corpos, seis covas. Faz direito.'),
  you('Você tá falando sério.'),
  boss('Sério como um defunto. Vai cavar.'),
];
// after the time skip, sitting on the summit with a cigarette
export const MONOLOGUE: CineLine[]=[
  you('Ufa... Foi um trabalho puxado. Trabalho pesado mesmo.'),
  you('Seis covas, seis cruzes. Mas finalmente a gente respeitou aquela gente.'),
  you('Agora é voltar lá no orelhão e avisar o chefão.'),
];
export const CALL3: CineLine[]=[
  you('Pronto, chefe. Os seis tão enterrados. Cada um na sua cova, com cruz e tudo.'),
  boss('Eu sei. Eu tenho olhos em todo canto dessa cidade.'),
  boss('Você fez o serviço sujo e ainda limpou a sujeira. Isso é raro hoje em dia.'),
  boss('Gostei de você. A partir de hoje, você trabalha pra mim.'),
  boss('Fica de olho nos orelhões. Quando um deles tocar... é pra você.'),
];
export const CALL4: CineLine[]=[
  boss('Temos um problema. Um problemão.'),
  boss('Aconteceu um desastre absurdo lá no mato. Nas covas que você cavou.'),
  you('Que desastre? Eles tão enterrados.'),
  boss('ESTAVAM. A terra se abriu. Os seis caipiras levantaram... como zumbis.'),
  boss('Tão indo pra vila de Pine Hollow, atacando e matando quem aparece pela frente.'),
  you('Zumbis. Você só pode tá de brincadeira.'),
  boss('Eu tenho cara de quem brinca? Vai lá e mata eles de novo. E dessa vez, mira na cabeça.'),
];
export const CALL5: CineLine[]=[
  you('Pronto. Os seis tão no chão. De novo.'),
  boss('Não é tão simples. Esses corpos tão amaldiçoados. Enquanto ficarem lá, vão levantar de novo.'),
  boss('Vai até a vila, depois da montanha. Tem um padre na porta da igreja.'),
  boss('Ele entende desse tipo de coisa. Eu não mexo com isso.'),
];
export const PRIEST_TALK: CineLine[]=[
  padre('Eu sei por que você veio, meu filho. Os mortos do mato não descansam.'),
  you('Disseram que os corpos tão amaldiçoados. Como eu acabo com isso?'),
  padre('Nenhuma bala mata o que já está morto. Pra livrar aquele lugar dos demônios, você precisa abraçar o caminho da submissão total.'),
  padre('Se ajoelhar e rezar todos os dias. Entregar tudo.'),
  padre('O mal que você vai resolver ali é pela cidade inteira. Você vai ser um herói, meu filho. Vão te considerar um Jesus Cristo.'),
  you('...Um Jesus Cristo. Tá bom, padre.'),
  padre('Tome esta água benta. Jogue um pouco sobre cada corpo, e o fogo do céu vai levá-los embora.'),
];
export const BLESSING: CineLine[]=[
  padre('Você voltou, meu filho. Eu senti quando o mal deixou aquele mato.'),
  crowd('SALVADOR! SALVADOR!'),
  padre('Olhe à sua volta. Essa gente ajoelhada é a prova. Você livrou Pine Hollow dos demônios.'),
  you('Eu só joguei um pouco de água, padre.'),
  crowd('ABENÇOADO SEJA! NOSSO HERÓI!'),
  padre('A fé move montanhas, meu filho. E você moveu uma vila inteira. Vá em paz.'),
];

/** The story's scenes by name — the dubbing tool can voice one scene at a time
 *  (`npm run voice -- --scene call1`). */
export const SCENES: Record<string,CineLine[]>={call1:CALL1,call2:CALL2,monologue:MONOLOGUE,call3:CALL3,
  call4:CALL4,call5:CALL5,priest:PRIEST_TALK,blessing:BLESSING};
/** Every dubbed line of the story, for the dubbing tool. */
export const ALL_LINES: CineLine[]=Object.values(SCENES).flat();
