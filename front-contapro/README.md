This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Docker

Build production image (standalone):

```bash
docker build \
  -t contapro-frontend:latest \
  --build-arg NEXT_PUBLIC_API_BASE="http://localhost:8080" \
  --build-arg NEXT_PUBLIC_LANDING_HOST="http://localhost:3000" \
  --build-arg NEXT_PUBLIC_APP_HOST="http://localhost:3000" \
  .
```

Run container:

```bash
docker run --rm -p 3000:3000 --name contapro-frontend contapro-frontend:latest
```

### EasyPanel

Configura el servicio Docker así:

- Imagen: `contapro-frontend:latest` (o la de tu registro)
- Puerto interno: `3000` (publica como necesites)
- Comando de inicio: deja el predeterminado de la imagen (no pongas nada) o usa `node server.js`
- Variables (opcional):
  - `NEXT_PUBLIC_API_BASE` (si quieres sobreescribir en build, usa `--build-arg`)
  - `PORT=3000`, `HOST=0.0.0.0`
- Healthcheck: `/` (ya incluido en Dockerfile con `curl`)

Si cambias el comando de inicio en EasyPanel, asegúrate de usar `node server.js` (con build `standalone`) o `npm run start -p 3000 -H 0.0.0.0` (si preferiste no usar `standalone`).

Environment variables at runtime:

- `PORT` (default `3000`)
- `HOST` (default `0.0.0.0`)
- `NEXT_TELEMETRY_DISABLED=1`
