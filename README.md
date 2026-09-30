# Burgundy · Gastos

App interna para anotar los gastos de la florería. Mobile first, se instala en el celu como una app.

- Mandás un audio ("50 rosas a 80 mil y el flete 12 mil") y queda anotado.
- Los gastos fijos (luz, gas, alquiler) se cargan una vez y se anotan solos cada mes.
- Gráfico mes a mes (fijos vs variables) y ranking por categoría.
- Entrada con PIN de 4 dígitos.

Stack: Next.js 16, Supabase (base de datos), Vercel AI Gateway (audio a texto y extracción de gastos).

## 1. Supabase

1. Crear un proyecto nuevo en supabase.com (región `sa-east-1`, São Paulo, es la más cercana).
2. SQL Editor > pegar todo `supabase/migrations/20260929000000_init.sql` > Run.
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

3. AI Gateway: en el proyecto de Vercel, pestaña AI Gateway, habilitarlo. En Vercel se autentica solo (OIDC), no hace falta key. Tiene costo por uso, un audio corto cuesta centavos de dólar.
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
