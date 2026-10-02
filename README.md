# Burgundy · Gastos

App interna para anotar los gastos de la florería. Mobile first, se instala en el celu como una app.

- Mandás un audio ("50 rosas a 80 mil y el flete 12 mil") y queda anotado.
- Los gastos fijos (alquiler, luz, flores de los lunes y miércoles) se dictan o se pegan una vez y se anotan solos cuando llega su día: mensual, cada 15 días o semanal.
- Gráfico mes a mes (fijos vs variables) y ranking por categoría.
- Entrada con PIN de 4 dígitos.

Stack: Next.js 16, Supabase (base de datos), Vercel AI Gateway (audio a texto y extracción de gastos).

## 1. Supabase

1. Crear un proyecto nuevo en supabase.com (región `sa-east-1`, São Paulo, es la más cercana).
2. SQL Editor > correr en orden cada archivo de `supabase/migrations/` (`20260929000000_init.sql` y después `20261001000000_fijos_frecuencia.sql`).
3. Project Settings > API: copiar la **URL** y la **secret key** (`sb_secret_...`, o la `service_role` legacy).

La base queda cerrada: RLS activado sin políticas y permisos revocados a `anon`. Solo el servidor entra, con la secret key.

## 2. Vercel

1. Importar el repo en vercel.com (framework: Next.js, sin cambios).
2. Settings > Environment Variables:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SECRET_KEY` | secret key |
| `APP_PIN` | PIN de 4 dígitos |
| `SESSION_SECRET` | salida de `openssl rand -base64 32` |

3. Audio con IA (opcional): cargar una tarjeta en Vercel > AI Gateway y agregar `AI_ENABLED=true`. En Vercel se autentica solo (OIDC), no hace falta key. El plan gratuito trae USD 5 por mes y no incluye Claude: por eso el modelo que interpreta es `google/gemini-2.5-flash` (se cambia con `AI_PARSER_MODEL`). Sin IA, el micrófono abre la carga a mano y el texto dictado se interpreta con reglas.
4. Deploy.

## 3. Instalarla en el iPhone

1. Abrir la URL en **Safari** (no Chrome).
2. Botón compartir > **Agregar a pantalla de inicio**.
3. Queda el ícono "Burgundy" y abre a pantalla completa, sin barra de Safari.

La primera vez que grabe, iOS pide permiso de micrófono. En Android: Chrome > menú > Instalar app.

## Desarrollo local

```bash
cp .env.example .env.local   # completar
vercel link && vercel env pull .env.local   # trae el token del AI Gateway
npm run dev
```

Con Docker se puede usar un Supabase local: `supabase start` aplica la migración (puertos 554xx para no chocar con otros proyectos).
