# Teo

Seu assistente de preparação teológica e pastoral.

Primeira implementação executável com autenticação, persistência SQLite, interface responsiva e integração oficial de IA por assinatura preparada. **Não representa conclusão integral do Prompt Master.** Veja [docs/STATUS.md](docs/STATUS.md).

## Iniciar

Requisito: Node.js 24+. O núcleo não precisa baixar dependências npm.

```powershell
cd caminho\para\teo
npm start
```

Abra **http://127.0.0.1:3000** nesse computador.

1. Abra `data/bootstrap-code.txt`, gerado na primeira execução.
2. Crie a primeira conta com seu nome, e-mail, senha própria de pelo menos 12 caracteres e o código. A conta será administradora e estudante; o código é removido após o cadastro.
3. Complete o onboarding.
4. Na administração, crie módulos e envie seus PDFs autorizados. Processe, confira e valide a extração.
5. Crie ou importe perguntas; aprove e publique cada uma.
6. Crie aulas com fontes reais e atividades essenciais. Envie para revisão, inicie a revisão, aprove e publique.
7. Faça o diagnóstico quando houver questões publicadas nos quatro eixos.

Não há senha padrão, usuário fictício ou texto doutrinário atribuído indevidamente a autores. O currículo contém somente a estrutura inicial solicitada, a conferir com a edição de Langston efetivamente disponibilizada.

## Conectar a assinatura ChatGPT

Após criar a conta Teo, execute em outro terminal, no mesmo diretório:

```powershell
npm run ai:connect
```

Abra o endereço exibido no navegador **desse mesmo computador** e autorize o uso da franquia. O callback usa `127.0.0.1:1455`. Depois, em Administração → Inteligência artificial, consulte o catálogo, selecione um modelo, salve e teste.

O fluxo usa OAuth oficial para uso pessoal/local, com PKCE, state, nonce e verificação de identidade. **Não foi autorizado nem testado com sua conta.** Depende de elegibilidade e acesso à internet. Não há captura de cookies, armazenamento da senha ChatGPT nem fallback automático para API paga. Veja [docs/IA.md](docs/IA.md).

## PDFs e testes

O ambiente atual possui Python e PyMuPDF. A extração de um PDF textual de duas páginas foi testada. Em outro computador:

```powershell
python -m pip install pymupdf==1.26.7
```

OCR requer Tesseract e idiomas `por` e `eng`; a tentativa está implementada, mas não foi validada em documento digitalizado. Páginas sem texto geram avisos. Documentos não fundamentam respostas antes da conferência administrativa.

```powershell
npm test
npm run check
```

Os 30 testes atuais passaram. Usam bancos e documentos temporários descartáveis; não preenchem o banco real. Os testes de API executam o handler HTTP em memória porque o sandbox bloqueia conexões loopback do executor. Não substituem testes de navegador ou Android.

O banco usa a migration SQLite versionada `server/migrations/001-initial.sql`. A ficha para futura calibração humana está em [docs/AVALIACAO-HUMANA.md](docs/AVALIACAO-HUMANA.md); ela ainda não contém respostas aprovadas por um revisor.

## Android e hospedagem

Veja [docs/ANDROID.md](docs/ANDROID.md) e [docs/DEPLOY.md](docs/DEPLOY.md). Há configuração Capacitor, pacote, ícones, splash e script de preparação. **Não há APK gerado nem projeto nativo materializado**, pois os pacotes Capacitor não estão disponíveis neste executor sem acesso ao npm. Não houve implantação remota ou criação de Supabase.

## Organização do código

| Caminho | Responsabilidade |
| --- | --- |
| `server/index.mjs` | API, autorização e casos de uso |
| `server/domain.mjs` | Planejamento, avaliações, revisão e elegibilidade |
| `server/database.mjs` | SQLite e criptografia |
| `server/auth.mjs` | Senhas, sessões e propriedade dos registros |
| `server/ai.mjs` | Provedores, uso, cache, streaming e fontes |
| `scripts/chatgpt-connect.mjs` | OAuth oficial por assinatura |
| `scripts/extract_pdf.py` | Extração por página e tentativa de OCR |
| `public/` | Interface e PWA |
| `mobile/` | Preparação Capacitor |
| `tests/` | Testes de regras, segurança, API e PDF |

## Dados e privacidade

O servidor escuta somente em loopback por padrão. Senhas usam scrypt com salt; sessões usam cookies HttpOnly/SameSite; mutações exigem CSRF. Jornada privada e credenciais de IA usam AES-256-GCM. A chave fica em `data/encryption.key`, fora do código.

Faça backup criptografado de **data inteiro**, incluindo a chave, e restrinja suas permissões NTFS/Unix ao operador. Perder a chave impede recuperar os campos cifrados. Não distribua esse diretório. O pacote de código exclui dados, credenciais e código de instalação.

Recuperação de senha usa link único na caixa privada do servidor; e-mail automático ainda não integrado. Cadastros públicos ficam desativados por padrão.
