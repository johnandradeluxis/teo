# Uso da assinatura para IA

A prioridade é usar a franquia da assinatura ChatGPT mediante autorização oficial. Não há troca automática para API paga. A documentação consultada descreve Sign in with ChatGPT com autorização separada para inferência em clientes pessoais/locais elegíveis. Isso **não** torna qualquer chave de API gratuita no Plus.

O fluxo está escrito, mas não conectado à conta do idealizador e não testado com inferência real. A disponibilidade concreta exige autorização e elegibilidade.

| Alternativa | Custo e limites | Autenticação | Viabilidade e recomendação |
| --- | --- | --- | --- |
| Assinatura via OAuth oficial | Consome a franquia compartilhada; não é ilimitada; limites da conta/provedor | OAuth oficial com consentimento separado de uso da franquia | Prioridade pessoal/local. Tutor, geração e avaliação são compatíveis com RAG próprio. Não pressupor autorização para serviço comercial remoto |
| OpenAI API comum | Tarifas ou créditos próprios; não presumir inclusão no Plus | Chave no servidor | Alternativa somente por escolha explícita; nenhum fallback automático |
| Gemini com cota gratuita | Alguns modelos têm faixa gratuita; cotas e condições por modelo/projeto | Chave | Pode servir para testes, mas revise tratamento dos dados antes de enviar jornada privada |
| Ollama local | Sem cobrança por chamada local; há custo de hardware/energia | API local protegida | Útil para embeddings e testes; qualidade/latência dependem de modelo e equipamento |
| Modelo pequeno no Android | Sem tarifa de tokens local; consumo de memória/bateria | Runtime e modelo licenciado | Não implementado. Exige benchmark e avaliação da licença; não escolhido como avaliador principal |

Não há medição de qualidade teológica sem fontes e respostas revisadas por pessoa. Pesos abertos não significam licença irrestrita.

## Conectar

1. Crie a conta administradora do Teo.
2. Execute `npm run ai:connect` no próprio computador.
3. Abra a URL exibida e autorize na OpenAI. O callback local usa `127.0.0.1:1455`.
4. A aplicação valida state, PKCE, nonce, assinatura e identidade, e exige o escopo de uso da assinatura.
5. Tokens ficam cifrados no servidor, fora da interface, do código e do APK.
6. No painel, consulte os modelos da conta, escolha um, salve e teste.

Inferência usa Responses com `store:false`, `stream:true` e confirmação `response.completed`. O limite de saída e a temperatura configurados para APIs comuns não são enviados no fluxo da assinatura, conforme as limitações documentadas. Contagens e tamanho de contexto são controlados pelo Teo; a franquia continua sob controle do provedor.

Para VM pessoal, siga o procedimento oficial de autorização local e transferência protegida. Como os tokens são cifrados com a chave da instalação, a transferência atual exige mover o diretório de dados protegido como unidade, ou desenvolver uma ferramenta segura de migração. Não cole tokens no chat. Serviço pago/remoto para terceiros precisa conferir o enquadramento e eventual aprovação da integração.

## Referências oficiais

- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms
- https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
- https://ai.google.dev/gemini-api/docs/pricing
- https://docs.ollama.com/api/introduction
