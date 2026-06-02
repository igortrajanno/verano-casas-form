# Verano Casas - Formulario de Captura

Formulario estatico para captura de leads de casas em condominio da Verano.

## Arquivos principais

- `index.html`: estrutura do formulario e carregamento opcional do Pixel.
- `style.css`: layout responsivo.
- `script.js`: perguntas, validacao, WhatsApp, Supabase e eventos de lead.
- `config.js`: configuracoes publicas do cliente.
- `supabase/functions/capture-lead/index.ts`: Edge Function para salvar lead e enviar evento Lead para a API de Conversoes.

## Configuracoes pendentes por cliente

No `config.js`, trocar:

- `organizationId`: id da organizacao no CRM/Supabase.
- `whatsappNumber`: numero que recebera o resumo do lead.
- `pixelId`: ID do Pixel da Meta.
- `leadCaptureEndpoint`: endpoint da Edge Function ou API propria.

O token da API de Conversoes nunca deve ficar no `config.js`. Ele precisa ficar no backend, como secret/env da Edge Function ou da VPS.

## Cuidados para deploy

- O EasyPanel/VPS serve apenas o site estatico via `Dockerfile`.
- A Edge Function nao roda dentro desse container do site. Ela precisa ser configurada separadamente na Supabase/self-hosted Supabase.
- A tabela usada por este formulario e `lead_captures`.
- O `organizationId` atual e da Verano: `9a921f04-680f-420e-893b-6c4f6508d07d`.
- A Edge Function foi feita para ser idempotente: se receber o mesmo `organization_id` + `fb_lead_id`, ela atualiza o registro existente antes de tentar criar outro.
- O token da API de Conversoes nunca deve ficar no frontend.

## Fluxo atual

1. Visitante responde o formulario.
2. Ao sair da etapa de contato, o site salva um lead parcial em `lead_captures`.
3. Ao finalizar o formulario, o site atualiza o mesmo registro para `capturado`.
4. Pixel dispara `Lead` no navegador com o mesmo `eventID` do lead.
5. Botao abre o WhatsApp com mensagem pronta.
6. Quando a API de Conversoes for ativada, o backend/Edge Function deve enviar o mesmo `event_id` para deduplicar com o Pixel.
