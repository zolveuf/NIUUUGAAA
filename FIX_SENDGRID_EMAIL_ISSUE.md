# Fix SendGrid Email Issue - Gmail Rate Limiting

## Problem
SendGrid säger att e-postmeddelandet är "deferred" (skjuts upp) eftersom `From:` header inte är alignat med SPF eller DKIM.

**Felmeddelande:**
```
421 4.7.32 Your email has been rate limited because the From: header (RFC5322) 
in this message isn't aligned with either the authenticated SPF or DKIM 
organizational domain.
```

## Orsak
Du använder `klasskraftuf@gmail.com` som `FROM_EMAIL`, men denna adress är inte korrekt verifierad i SendGrid som en Single Sender.

## Lösning 1: Verifiera Gmail-adressen i SendGrid (Snabb fix)

### Steg 1: Verifiera Single Sender i SendGrid

1. Gå till **SendGrid Dashboard**
2. Gå till **Settings → Sender Authentication → Single Sender Verification**
3. Klicka på **"Create Sender"** eller **"Verify a Single Sender"**
4. Fyll i formuläret:
   - **From Email Address:** `klasskraftuf@gmail.com`
   - **From Name:** `KlassKraft UF` (eller vad du vill)
   - **Reply To:** `klasskraftuf@gmail.com` (samma adress)
   - **Company Address:** (din adress)
   - **City:** (din stad)
   - **State:** (din region)
   - **Country:** Sverige
   - **Zip Code:** (ditt postnummer)
5. Klicka på **"Create"**

### Steg 2: Verifiera e-postadressen

1. SendGrid skickar ett verifieringsmail till `klasskraftuf@gmail.com`
2. **VIKTIGT:** Gå till Gmail och öppna verifieringsmailet
3. Klicka på verifieringslänken i mailet
4. Vänta tills statusen i SendGrid ändras till **"Verified"** (grön bock)

### Steg 3: Kontrollera Netlify Environment Variables

1. Gå till **Netlify Dashboard → Site settings → Environment variables**
2. Kontrollera att `FROM_EMAIL` är satt till `klasskraftuf@gmail.com`
3. Om den inte är satt, lägg till den

### Steg 4: Testa igen

Efter verifiering, testa att skicka beställningar igen. E-postmeddelanden ska nu levereras korrekt.

## Lösning 2: Använd klasskraft.se domän (Rekommenderad - Långsiktig)

När du har konfigurerat `klasskraft.se` domänen (enligt planen), använd en e-postadress från den domänen istället.

### Steg 1: Konfigurera Domain Authentication i SendGrid

1. Gå till **SendGrid Dashboard → Settings → Sender Authentication → Domain Authentication**
2. Lägg till `klasskraft.se`
3. Följ SendGrids guide för DNS-postar
4. Lägg till DNS-postar i din domänregistrator
5. Verifiera domänen

### Steg 2: Skapa Single Sender från domänen

1. Gå till **Settings → Sender Authentication → Single Sender Verification**
2. Skapa ny sender: `noreply@klasskraft.se` eller `info@klasskraft.se`
3. Verifiera e-postadressen

### Steg 3: Uppdatera Netlify Environment Variables

1. Gå till **Netlify Dashboard → Site settings → Environment variables**
2. Ändra `FROM_EMAIL` från `klasskraftuf@gmail.com` till `noreply@klasskraft.se`

### Steg 4: Uppdatera koden

Alla e-postadresser i koden kommer automatiskt att använda `FROM_EMAIL` environment variable, så ingen kodändring behövs.

## Varför detta händer

Gmail (och andra e-postleverantörer) kräver att `From:` adressen matchar en verifierad domän eller Single Sender i SendGrid. Detta är en säkerhetsåtgärd för att förhindra spam och phishing.

När du använder en Gmail-adress som `FROM_EMAIL`:
- Den MÅSTE vara verifierad som Single Sender i SendGrid
- Annars kommer Gmail att rate-limit eller blockera e-postmeddelanden

När du använder en e-postadress från din egen domän (t.ex. `noreply@klasskraft.se`):
- Du måste konfigurera Domain Authentication i SendGrid
- Detta ger bättre leverans och ser mer professionellt ut

## Rekommendation

**Kort sikt:** Verifiera `klasskraftuf@gmail.com` som Single Sender (Lösning 1)

**Lång sikt:** Konfigurera `klasskraft.se` domänen och använd `noreply@klasskraft.se` (Lösning 2)

## Checklista för snabb fix

- [ ] Gå till SendGrid → Single Sender Verification
- [ ] Skapa/verifiera `klasskraftuf@gmail.com` som Single Sender
- [ ] Klicka på verifieringslänken i Gmail
- [ ] Vänta tills statusen är "Verified" i SendGrid
- [ ] Kontrollera att `FROM_EMAIL` är satt i Netlify Environment Variables
- [ ] Testa att skicka beställningar igen
- [ ] Kontrollera SendGrid Activity för att se att e-postmeddelanden levereras

## Ytterligare tips

1. **Kontrollera SendGrid Activity:** Gå till SendGrid Dashboard → Activity för att se status på alla e-postmeddelanden
2. **Spam-mapp:** Även efter verifiering kan vissa e-postmeddelanden hamna i spam. Detta förbättras med Domain Authentication.
3. **Rate limiting:** Efter verifiering kan det ta några minuter innan rate limiting tas bort.

