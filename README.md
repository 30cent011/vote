# Vote Market

This project is a dynamic prediction market app built with Express and live server-sent events (SSE).

## Features
- Five live market pages: Unit 6, Unit 7, Unit 6 vs Unit 7, Who is the dumbest, and Who gets touched by Big Daniel first
- Realtime vote sync using SSE
- Mobile-friendly layout with the existing repository assets
- Ready for deployment on Railway or Render using `npm start`

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000`

## Deploy to Render
Use the included `render.yaml` or create a new Node web service with the command:
```bash
npm install
npm start
```

## Pages
- `index.html` — market overview
- `market.html?market=unit6`
- `market.html?market=unit7`
- `market.html?market=unit6-vs-7`
- `market.html?market=dumbest`
- `market.html?market=big-daniel`
- `results.html?market=<marketId>` — live results page
