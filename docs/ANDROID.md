# Android

**Nenhum APK foi gerado.** SDK e Gradle existem, mas o executor não acessa o registro npm e não tem Capacitor em cache. O diretório nativo será materializado pelo CLI oficial quando as dependências estiverem disponíveis.

Configuração preparada: pacote `br.app.teo.preparacao`, nome Teo, origem HTTPS sem credenciais, identidade, ícones e splash. O script retorna falha explícita se não puder concluir a preparação.

## Gerar no Windows

Requisitos: backend Teo publicado com HTTPS válido; Node 24+; JDK/Android Studio compatíveis com Capacitor 8; SDK; rede para npm, Google e Maven. Configure `APP_ORIGIN` no domínio real e `COOKIE_SECURE=true` no servidor.

Na raiz do Teo:

```powershell
Set-Location .\mobile
npm install
Set-Location ..
$env:TEO_REMOTE_URL = 'https://teo.seu-dominio.com.br'
npm run android:prepare
Set-Location .\mobile\android
.\gradlew.bat assembleDebug
```

O primeiro install produzirá o lockfile móvel; preserve-o e use `npm ci` depois. As versões Capacitor estão fixadas em 8.0.0. O install não foi executado com sucesso nesta sessão.

Após uma compilação real bem-sucedida, o arquivo esperado é `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. **Esse arquivo ainda não existe.** Para instalar, a partir de `mobile/android`:

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Alternativa: `npm run open` em `mobile`, após preparar, para abrir o projeto no Android Studio.

Teste login, onboarding, suspensão/retomada, PDF, TTS, fonte, acessibilidade, sessão expirada, rede instável, logout e separação de contas. Não marque a versão como validada antes desses testes.

O APK usa o mesmo backend HTTPS e cookies do domínio; credenciais de IA ficam no servidor. Esta versão depende de rede para dados privados e não promete sincronização offline.

## Atualizações

Publique e valide o backend, repita `npm run android:prepare`, incremente `versionCode` e `versionName` em `mobile/android/app/build.gradle`, compile e instale com `adb install -r`. Distribuição de release exige keystore protegida e a mesma assinatura para atualizações. O APK de debug serve apenas para testes.
