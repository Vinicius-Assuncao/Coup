// Cartas e artes (copiadas do game.js). Usado pelo modo multiplayer.
const ROLE_NAMES={duque:'Duque',assassino:'Assassino',capitao:'Capitão',condessa:'Condessa',embaixador:'Embaixador',inquisidor:'Inquisidor'};
const ART={
  duque:'<path d="M26 62 L26 32 L43 46 L55 22 L67 46 L84 32 L84 62Z" fill="#e0a420" stroke="#7a4f08" stroke-width="2" stroke-linejoin="round"/><rect x="26" y="62" width="58" height="8" fill="#b07a10"/><circle cx="55" cy="46" r="3" fill="#b5487f"/><circle cx="36" cy="52" r="2.5" fill="#fff"/><circle cx="74" cy="52" r="2.5" fill="#fff"/>',
  assassino:'<path d="M55 6 L63 52 L55 58 L47 52Z" fill="#c9d1dc" stroke="#3f4a5a" stroke-width="2" stroke-linejoin="round"/><path d="M55 8 L55 54" stroke="#fff" stroke-width="1.5" opacity=".7"/><rect x="34" y="52" width="42" height="6" rx="3" fill="#3f4a5a"/><rect x="51" y="58" width="8" height="16" rx="2" fill="#2a313c"/><circle cx="55" cy="78" r="3" fill="#e0a420"/>',
  capitao:'<path d="M55 10 L82 20 L80 44 Q76 62 55 72 Q34 62 30 44 L28 20Z" fill="#2f7fb3" stroke="#1d4f72" stroke-width="2.5" stroke-linejoin="round"/><path d="M55 20 L55 62" stroke="#dbe9f5" stroke-width="4"/><path d="M40 36 L70 36" stroke="#dbe9f5" stroke-width="4"/><circle cx="55" cy="36" r="4" fill="#e0a420"/>',
  condessa:'<path d="M28 80 Q28 36 55 32 Q82 36 82 80Z" fill="#b9372f" stroke="#6e1f19" stroke-width="2"/><circle cx="55" cy="46" r="12" fill="#f5d0b0" stroke="#7a2e24" stroke-width="1.5"/><path d="M38 40 Q40 22 55 20 Q70 22 72 40" fill="none" stroke="#e0a420" stroke-width="3.5" stroke-linecap="round"/><circle cx="51" cy="46" r="1.6" fill="#3b2a3a"/><circle cx="59" cy="46" r="1.6" fill="#3b2a3a"/><path d="M51 52 Q55 55 59 52" stroke="#b9372f" stroke-width="1.6" fill="none"/>',
  embaixador:'<rect x="32" y="14" width="46" height="50" rx="5" fill="#fdf6e3" stroke="#1f7a50" stroke-width="2.5"/><circle cx="32" cy="39" r="6" fill="#2e9e6a" stroke="#1f7a50" stroke-width="2"/><circle cx="78" cy="39" r="6" fill="#2e9e6a" stroke="#1f7a50" stroke-width="2"/><path d="M41 28 H69 M41 38 H69 M41 48 H60" stroke="#2e9e6a" stroke-width="3.5" stroke-linecap="round"/><path d="M48 66 L55 78 L62 66" fill="#2e9e6a"/>',
  inquisidor:'<path d="M14 42 Q55 6 96 42 Q55 78 14 42Z" fill="#fff8d8" stroke="#a87900" stroke-width="3"/><circle cx="55" cy="42" r="17" fill="#e5b72e" stroke="#a87900" stroke-width="2.5"/><circle cx="55" cy="42" r="7" fill="#5b4300"/><circle cx="60" cy="37" r="3" fill="#fff"/>'
};
const CARD_INFO={
  duque:{c:'#b5487f',bg:'#f8e3ee',e:'Taxas: pega 3 moedas. Bloqueia Ajuda Externa.'},
  assassino:{c:'#3f4a5a',bg:'#e3e8ef',e:'Assassinar: paga 3 e tira 1 influência do alvo.'},
  capitao:{c:'#2f7fb3',bg:'#dcebf6',e:'Extorquir: rouba 2 moedas. Bloqueia Extorsão.'},
  condessa:{c:'#b9372f',bg:'#f7dcd8',e:'Bloqueia Assassinato.'},
  embaixador:{c:'#2e9e6a',bg:'#d9f0e4',e:'Trocar: pega 2 cartas da Corte e troca com as suas.'},
  inquisidor:{c:'#d6a514',bg:'#fff1bd',e:'Trocar ou Investigar.'}
};
const BACK=`<div class="cd back"><svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice"><defs><pattern id="pt" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M8 0L16 8L8 16L0 8Z" fill="none" stroke="#c9a85c" stroke-width="1.2"/></pattern></defs><rect width="100" height="150" fill="url(#pt)"/><circle cx="50" cy="75" r="22" fill="#3b2a3a" stroke="#e0b04a" stroke-width="3"/><text x="50" y="83" text-anchor="middle" font-size="24" fill="#e0b04a" font-family="Cinzel,serif" font-weight="700">C</text></svg></div>`;
