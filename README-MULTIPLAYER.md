# Coup online: passo a passo

## 1. Criar o projeto no Supabase
1. Crie um projeto em https://supabase.com (plano gratuito basta).
2. Em **Authentication > Sign In / Providers**, ative **Allow anonymous sign-ins**.
3. Em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e execute.

## 2. Configurar o front-end
Abra `mp-config.js` e preencha:
- `url`: em **Project Settings > API > Project URL**
- `anonKey`: em **Project Settings > API > anon public**

A chave `anon` pode ficar pública. A segurança vem do banco (RLS) e da Edge Function, não de esconder a chave.

## 3. Publicar a Edge Function
Instale a CLI (https://supabase.com/docs/guides/cli) e rode, na raiz do repositório:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF   # ref aparece na URL do dashboard
supabase functions deploy coup
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são fornecidos automaticamente às funções.

## 4. Publicar no GitHub Pages
Copie para o repositório: `multiplayer.html`, `mp.js`, `mp-style.css`, `mp-config.js`, `cards.js`, `index.html` (substitua o existente) e a pasta `supabase/`. Faça commit e push. O jogo abre em `https://SEU-USUARIO.github.io/Coup/multiplayer.html`.

## 5. Testar
1. Abra o link em duas janelas (ou uma anônima).
2. Janela 1: digite o nome e clique em **Criar sala**. Anote o código de 4 letras.
3. Janela 2: digite o nome, o código e clique em **Entrar na sala**.
4. Janela 1: **Iniciar partida** (mínimo 2 jogadores).

## Regras implementadas
- Até 8 humanos, sem bots.
- 2 minutos por decisão. Se o prazo estourar, o servidor aplica a ação padrão: Renda (ou Golpe, se tiver 10+ moedas), não desafiar/bloquear, escolher a primeira carta, manter as primeiras cartas na troca.
- Cartas ocultas nunca vão para o navegador: só a sua mão é enviada, pela função `get`.
- Desafios e bloqueios são resolvidos em paralelo: todos respondem ao mesmo tempo.

## Limitações conhecidas
- Não há reconexão automática se a aba for fechada no meio de uma partida. Ao abrir de novo no mesmo navegador, o código salvo é reutilizado.
- Não há botão de sair no meio da partida (sair só limpa a sala salva no navegador).
- Os popups e animações da versão local ainda não foram portados para o modo online: a mesa mostra o estado e o log, mas sem as animações de carta e moeda.
- O código não foi testado em execução real. Espere ajustes na primeira rodada e veja os logs em **Edge Functions > coup > Logs** no dashboard.
