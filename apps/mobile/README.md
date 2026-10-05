# Kairon Mobile

App Expo (SDK 56) do Kairon Dashboard, com tarefas e eventos do dia, calendário, pipeline de leads e push notifications. Compartilha cliente Supabase, APIs e cálculos com o web através do workspace `@kairon/core`.

```bash
# na raiz do monorepo
npm install
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
npm run mobile                                 # expo start
npm run mobile:ios                             # build nativo (Xcode)
```

- Usa `expo-dev-client`: rode em um development build, não no Expo Go.
- O `postinstall` aplica `scripts/patch-expo-modules-jsi.js` (compatibilidade com o Xcode 26).
- Antes de mexer em APIs do Expo, consulte https://docs.expo.dev/versions/v56.0.0/.

Documentação completa: [docs/mobile.md](../../docs/mobile.md).
