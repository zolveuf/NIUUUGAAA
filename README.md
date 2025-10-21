# Kakservice Website

En responsiv, mobilanpassad webbplats inspirerad av Kakservice med Supabase och SendGrid-integration.

## 🚀 Funktioner

- **Responsiv design** - Fungerar på alla enheter
- **Modern UI** - Apple-inspirerad design med smooth animationer
- **Formulärhantering** - Supabase för databas, SendGrid för e-post
- **Mobilanpassad navigation** - Hamburger-meny med fullskärms-panel
- **Universal CSS** - Konsekvent styling med CSS-variabler

## 📁 Projektstruktur

```
├── index.html              # Huvudsida
├── börja-sälja.html        # Ansökningssida
├── config.js               # API-nycklar och konfiguration
├── package.json            # Dependencies
├── supabase-schema.sql     # Databasschema
├── api/
│   └── submit-application.js # API-endpoint för formulär
└── assets/
    ├── css/
    │   └── styles.css      # Alla stilar
    └── js/
        └── main.js         # JavaScript-funktionalitet
```

## ⚙️ Installation

### 1. Klona repot
```bash
git clone <your-repo-url>
cd kakservice-website
```

### 2. Installera dependencies
```bash
npm install
```

### 3. Konfigurera API-nycklar

Redigera `config.js` och ersätt med dina riktiga värden:

```javascript
const CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-supabase-anon-key',
  
  // SendGrid Configuration
  SENDGRID_API_KEY: 'your-sendgrid-api-key',
  FROM_EMAIL: 'noreply@yourdomain.com',
  ADMIN_EMAIL: 'admin@yourdomain.com',
  
  // Application Settings
  APP_NAME: 'Kakservice',
  COMPANY_NAME: 'Klass Kraft UF'
};
```

### 4. Sätt upp Supabase

1. Skapa ett nytt projekt på [supabase.com](https://supabase.com)
2. Kör SQL-koden från `supabase-schema.sql` i SQL Editor
3. Kopiera URL och anon key till `config.js`

### 5. Sätt upp SendGrid

1. Skapa konto på [sendgrid.com](https://sendgrid.com)
2. Skapa en API-nyckel
3. Verifiera din sender e-postadress
4. Lägg till API-nyckeln i `config.js`

## 🚀 Deployment

### Netlify (Rekommenderat)

1. **Pusha till GitHub**
```bash
git add .
git commit -m "Add Supabase and SendGrid integration"
git push origin main
```

2. **Deploya på Netlify**
   - Gå till [netlify.com](https://netlify.com)
   - "New site from Git" → Välj GitHub → Välj repo
   - Build settings: Lämna tomt (static site)
   - Deploy!

3. **Sätt miljövariabler på Netlify**
   - Site settings → Environment variables
   - Lägg till alla värden från `config.js`

### Vercel (Alternativ)

1. **Installera Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploya**
```bash
vercel
```

3. **Sätt miljövariabler**
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SENDGRID_API_KEY
vercel env add FROM_EMAIL
vercel env add ADMIN_EMAIL
```

## 📧 E-postmallar

Systemet skickar automatiskt:

- **Bekräftelse till användare** - Bekräftar att ansökan mottagits
- **Notifiering till admin** - Med all ansökningsdata

## 🗄️ Databas

Tabellen `applications` innehåller:
- Personlig information (namn, e-post, telefon)
- Organisationsinformation (namn, typ, antal deltagare)
- Ansökningsdetaljer (mål, tidsram)
- Status och metadata

## 🎨 Anpassning

### Färger
Redigera CSS-variabler i `assets/css/styles.css`:
```css
:root {
  --color-primary: #0ea5e9;
  --color-secondary: #f59e0b;
  /* ... */
}
```

### Innehåll
- **Huvudsida**: Redigera `index.html`
- **Ansökningssida**: Redigera `börja-sälja.html`
- **Formulärfält**: Lägg till/ta bort i HTML och uppdatera API

## 🔧 Utveckling

Starta lokal server:
```bash
npm run dev
```

## 📱 Responsiv design

- **Mobile-first** approach
- **Breakpoints**: 400px, 768px
- **Touch-friendly** navigation
- **Optimized forms** för små skärmar

## 👨‍💻 Utvecklare

**Martin Pranjic** - [LinkedIn](https://www.linkedin.com/in/martin-pranjic-99a278310/)

## 📄 Licens

MIT License - Se LICENSE fil för detaljer.
