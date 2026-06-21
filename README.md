# Ons Huishouden — platform

Eén platform voor huishoudtools, beveiligd met een wachtwoord dat je deelt met je huisgenoot. Werkt op iPhone (Safari en Chrome) via "Voeg toe aan beginscherm".

## Tools

- **Boodschappen** — gedeelde, gecategoriseerde boodschappenlijst met favorieten en winkelmodus.
- **Budget** — huishouduitgaven, budgetten per maand/kwartaal/jaar, spaardoelen, taken, Rabobank CSV-import en maandafsluiting. Bedragen en namen zijn voorbeelddata bij eerste gebruik; pas "Partner 1/2" en inkomens aan via het tandwiel-icoon.

Beide tools delen geen data met elkaar — elke tool heeft zijn eigen opslag binnen hetzelfde huishouden.

### Wat in deze versie nog niet zit

De budget-tool had oorspronkelijk een bonnetje-scanfunctie en AI-gegenereerde budgetadviezen. Die zijn voorlopig weggelaten omdat ze een eigen Anthropic API-key nodig hebben die veilig server-side moet worden aangeroepen (nooit vanuit de browser). Zeg het als je deze functies later wilt toevoegen — dat vraagt een kleine, losse uitbreiding.

## Hoe de beveiliging werkt

- Bij de **eerste keer openen** van de app vraagt het platform om een huishoudnaam en wachtwoord. Dit wachtwoord wordt **gehasht** opgeslagen (nooit in leesbare vorm).
- Daarna moet iedereen die de site bezoekt dit wachtwoord invullen om verder te komen.
- Na inloggen blijft een sessie-cookie geldig tot je zelf op "Uitloggen" klikt.
- Dit beschermt tegen willekeurige bezoekers die de URL ooit te zien krijgen, maar is geen bankniveau-beveiliging. Gebruik een wachtwoord dat je niet elders hergebruikt.

## Deployen op Vercel

1. Maak een nieuwe **GitHub-repository** aan en upload deze map.
2. Ga naar [vercel.com/new](https://vercel.com/new) en importeer die repository.
3. Voeg in het Vercel-dashboard een **Redis-database** toe via Storage → Marketplace → Upstash Redis. Dit zet automatisch de juiste environment variables (`UPSTASH_REDIS_REST_URL` en `UPSTASH_REDIS_REST_TOKEN`) klaar.
4. Klik **Deploy**.
5. Open de gegenereerde URL — je krijgt automatisch het instelscherm om het huishoudwachtwoord te kiezen.
6. Open daarna dezelfde URL op de telefoon van je huisgenoot, log in met hetzelfde wachtwoord.
7. Kies in Safari "Voeg toe aan beginscherm" via het deel-icoon.

## Nieuwe tools toevoegen

Maak een nieuw bestand aan in `pages/`. Voeg de tool toe aan de lijst `TOOLS` in `pages/index.js` zodat er een tegel voor verschijnt. De middleware beschermt elke nieuwe pagina automatisch met dezelfde login.

## Lokaal draaien (optioneel)

```bash
npm install
npm run dev
```

Zet hiervoor wel eerst een `.env.local` bestand klaar met:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Let op: het sessie-cookie heeft de vlag `Secure`, wat betekent dat browsers het alleen accepteren over HTTPS. Lokaal via `http://localhost` werkt inloggen daardoor niet betrouwbaar — test de inlogflow op de echte, gedeployde Vercel-URL (die altijd HTTPS gebruikt).

