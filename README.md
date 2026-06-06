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

## Google Maps

The itinerary map uses the Google Maps JavaScript API. Configure:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=...
```

El Map ID debe tener un estilo asociado en Google Maps Platform que oculte:

- `Administrative > Labels`
- `Points of interest > Labels`
- `Transit > Labels`
- `Road > Labels > Icons`

Esto deja visibles las calles y los marcadores propios del itinerario, sin
mostrar nombres de ciudades, barrios o lugares ajenos. Los estilos JSON
configurados desde JavaScript no reemplazan el estilo cloud de un Map ID.

Enable billing and Maps JavaScript API, then restrict the browser key to the
application's HTTP referrers. Without these variables, the itinerary keeps
working and shows a configuration placeholder in the map tab.

## Demo trip

`supabase/seed.sql` creates an idempotent Madrid trip for
`guidoadleredu@gmail.com` using deterministic UUIDs. Apply the migrations,
run the seed, and execute `supabase/tests/trip_itinerary_rls.sql` with an
administrative database connection to verify owner and non-owner RLS behavior.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
