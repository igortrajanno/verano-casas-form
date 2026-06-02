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

## Fluxo

1. Visitante responde o formulario.
2. Site monta o resumo.
3. Site tenta salvar o lead em segundo plano.
4. Pixel dispara `Lead` no navegador com `eventID`.
5. Edge Function salva o lead e envia o mesmo `event_id` para a API de Conversoes.
6. Botao abre o WhatsApp com mensagem pronta.
