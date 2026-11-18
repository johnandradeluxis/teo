# Operação e hospedagem

Não houve deploy remoto nem criação de Supabase. O servidor local foi iniciado; a prévia visual falhou. O backend provisório usa SQLite e exige disco persistente em um único servidor. Não use o filesystem efêmero de funções serverless para esse banco.

## Servidor pessoal

Use Node 24 sob usuário sem privilégios, diretório persistente e proxy HTTPS. Exemplos: `deploy/teo.service`, `deploy/Caddyfile` e `deploy/Dockerfile`. Eles ainda não foram implantados/testados.

```text
HOST=127.0.0.1
PORT=3000
APP_ORIGIN=https://teo.seu-dominio.com.br
COOKIE_SECURE=true
TEO_DATA_DIR=/var/lib/teo
PYTHON_BIN=/opt/pdf/bin/python
```

Substitua o domínio de exemplo. Não altere domínios de outros projetos. Não publique o diretório data como estático; PDFs são servidos por rotas autenticadas. Restrinja suas permissões ao operador do serviço e faça backups criptografados do diretório inteiro, incluindo a chave.

O Dockerfile depende de downloads apt/pip e não foi construído sem rede. A versão de PyMuPDF fixada deve ser conferida na instalação; o teste local usou a versão existente no computador.

## Recuperação de senha

O primeiro cadastro usa o código local `bootstrap-code.txt`. A senha é escolhida pelo usuário. Recuperação grava link de uma utilização, válido por 30 minutos, em `data/private-outbox/<id>.txt`; somente o operador deve entregá-lo ao titular por canal seguro. O uso revoga sessões anteriores. A entrega automática por e-mail ainda precisa ser integrada antes de oferecer autoatendimento público.

## Assinatura em VM própria

Siga o guia oficial de VM pessoal antes da transferência protegida da instalação. Tokens nunca devem ir para APK, logs, variáveis públicas ou chat. Hospedagem comercial para terceiros precisa confirmar elegibilidade; o fluxo pessoal não é autorização comercial irrestrita.

## Migração para a stack preferida

Ainda precisa ser implementada: Next.js/React/TypeScript com lockfile; Supabase Auth com vínculo das identidades; migrations PostgreSQL e RLS testadas com duas contas; Storage privado; pgvector com modelo/dimensão/versionamento definidos; transferência dos registros preservando IDs; revisão dos segredos e nova validação antes de alterar o backend Android.

Nenhuma migração remota foi executada ou presumida como concluída.
