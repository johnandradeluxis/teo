# Estado verificável do Teo

Esta entrega contém código executável. **Não é a conclusão integral, uma auditoria de segurança nem uma validação doutrinária.**

## Arquitetura provisória

A gravação no Windows voltou a funcionar após a atualização das permissões da sessão. O executor, porém, não acessa `registry.npmjs.org`, e Next.js/Capacitor não estão em cache utilizável.

Foi comunicada a adoção temporária de Node.js 24, SQLite nativo e interface JavaScript modular sem dependências npm. **Next.js, React, TypeScript, Tailwind, shadcn/ui, Supabase Auth, RLS e pgvector não estão implementados.** A migração permanece trabalho futuro, e não uma integração supostamente concluída.

O banco mantém entidades separadas com IDs, proprietário, timestamps, índices e histórico. Atributos usam JSON por registro. O controle de propriedade está na API; SQLite não tem RLS. A estrutura não é indicada para múltiplos servidores concorrentes sem migração.

## Funcionalidades

| Área | Implementado | Pendência ou limite |
| --- | --- | --- |
| Identidade e navegação | Marca própria; cinco áreas; responsividade; claro/escuro; estados reais | Prévia visual falhou; navegador e Android sem validação visual |
| Autenticação | Código local para primeiro administrador; login; logout; sessões; scrypt; CSRF; cadastro público controlado | Sem Supabase Auth; recuperação por caixa privada, sem entrega por e-mail |
| Onboarding | Perfil, formação, nível, rotina, dias, objetivo, data e tradição inicial Batista | Outras tradições ainda não configuráveis |
| Diagnóstico | Seleção equilibrada dos quatro eixos; correção; perfil e persistência | Requer banco publicado; nenhum banco real foi fornecido |
| Currículo | Eixos, disciplinas, módulos e aulas editáveis; tópicos, referências e atividades | Organização de Langston depende da edição autorizada fornecida |
| Leitura | Ajuste de fonte; modo leitura; posição; favoritos; notas com trecho; TTS do navegador | Destaques inline e editor de notas mais completo ainda pendentes |
| Estudo | Heartbeat, pausa de inatividade, conclusão por leitura/interação/atividade, domínio separado | Não constitui prova de atenção; visibilidade/interação informadas pelo cliente |
| Conteúdo híbrido | Status completos; revisão, aprovação e publicação separadas; versões; auditoria; lote de aulas | Outros tipos independentes, como flashcards e resumos, ainda pendentes |
| Biblioteca | Upload PDF; metadados; leitura; páginas; fragmentos; validação; acesso privado/compartilhado | Substituição versionada do arquivo, capítulos automáticos e referências cruzadas pendentes |
| OCR | Tentativa real por PyMuPDF/Tesseract e avisos | Não testado em digitalizados; tabelas sem extração estrutural específica |
| Recuperação | Busca textual; embeddings Ollama opcionais; ranking semântico por cosseno | Embeddings não conectados; sem pgvector |
| Assistente | Fontes autorizadas, contexto de aula, histórico e citações com metadados do servidor; recusa sem fontes | IA real não testada; ID válido não garante fidelidade semântica da resposta |
| Assinatura | OAuth oficial, PKCE/state/nonce, JWKS/RS256, cifragem, renovação e catálogo de modelos | Ainda sem autorização pessoal ou inferência real; elegibilidade a confirmar |
| Provedores | Ollama e APIs compatíveis; chave cifrada; consumo; cache e limites | Não testados externamente; nenhum fallback pago automático |
| Avaliações | Objetiva, V/F, associação em JSON, discursiva; pesos 40/35/25 e exceções; tentativas | Associação tem interface técnica; notas discursivas exigem IA/fontes; calibração humana pendente |
| Revisões | D+1/D+3/D+7/D+14 com ajuste pelo desempenho | Modelo inicial simples por disciplina |
| Plano | Carga publicada, sessões, semanas, lacunas, distribuição e recálculo por domínio | Velocidade individual observada ainda não incorporada; estimativa parcial |
| Banco real | Importação preserva texto e origem; aprovação separada | Banco real ainda não fornecido; não foi inventado |
| Simulação | Liberação por critérios; uma pergunta por vez; tempo; seleção equilibrada; respostas e relatório por área | Perguntas complementares automáticas e dificuldade dinâmica ainda pendentes; notas exigem IA |
| Jornada privada | Testemunho, chamado, cronologia, autosave, exportação, exclusão e criptografia | Uso pela IA exige habilitação e escolha explícita; nenhum dado pessoal foi enviado |
| Dashboard | Indicadores do banco; distingue estudo, conclusão e domínio | Banco real começa vazio intencionalmente |
| Segurança | Propriedade por conta; administração; CSRF; CSP; validação; rate limit; auditoria; exportação/exclusão | Sem MFA, RLS ou auditoria externa; rate limit em memória; TLS depende da hospedagem |
| PWA | Manifest, PNG/SVG, standalone e página offline | Sem cache/sincronização de dados privados; instalação não testada |
| Android | Pacote e configuração Capacitor; ícones/splash; script para HTTPS | SDK/Gradle existem, mas faltam pacotes Capacitor; projeto nativo e APK não gerados |
| Hospedagem | Exemplos Docker, systemd e Caddy | Não implantados; organização Supabase e servidor remoto não escolhidos |

## Validação

`npm test`: 30 testes passaram na sessão, incluindo autenticação, isolamento, CSRF, cifragem, revisão, proteção de fontes publicadas, diagnóstico, conclusão de estudo, simulação, recuperação e persistência. O teste PDF verificou páginas reais.

Os testes de API usam o handler HTTP por transporte em memória: conexões loopback do executor são bloqueadas. Não foram feitos testes E2E visuais, inferência com a assinatura, avaliação teológica humana, OCR digitalizado, deploy ou instalação APK. Nenhum desses itens foi presumido como aprovado.

## Dependências para continuar

1. O idealizador cria a conta e escolhe sua própria senha.
2. Autoriza oficialmente a assinatura no navegador do próprio computador.
3. Carrega PDFs autorizados e o banco real de perguntas.
4. O ambiente passa a acessar npm para restabelecer a stack preferida e materializar Capacitor.
5. São escolhidos organização e servidor remoto antes da implantação.
6. As lacunas desta matriz são implementadas e os fluxos passam por validação Android e doutrinária.
