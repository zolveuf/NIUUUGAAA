# Aktivera noreply@klasskraft.se - Steg för steg

## Steg 1: Verifiera e-postadressen i SendGrid

1. Gå till **SendGrid Dashboard**
2. Gå till **Settings → Sender Authentication → Single Sender Verification**
3. Hitta `noreply@klasskraft.se` i listan
4. Kontrollera status:
   - Om status är **"Pending"** eller **"Unverified"**:
     - SendGrid har skickat ett verifieringsmail till `noreply@klasskraft.se`
     - **VIKTIGT:** Du måste ha tillgång till denna e-postadress för att verifiera den
     - Om du inte har tillgång till e-postlådan, skapa en e-postadress som du HAR tillgång till (t.ex. `info@klasskraft.se`)
   - Om status är **"Verified"** (grön bock) → Gå till Steg 2

**OBS:** Om du inte har tillgång till `noreply@klasskraft.se` e-postlådan:
- Skapa istället `info@klasskraft.se` eller `kontakt@klasskraft.se` som du HAR tillgång till
- Eller konfigurera e-post forwarding i din domänregistrator så att `noreply@klasskraft.se` vidarebefordrar till en e-postadress du har tillgång till

## Steg 2: Konfigurera Domain Authentication (VIKTIGT!)

Detta är KRITISKT för att undvika "deferred" e-postmeddelanden:

1. Gå till **SendGrid Dashboard**
2. Gå till **Settings → Sender Authentication → Domain Authentication**
3. Klicka på **"Authenticate Your Domain"** eller **"Add Domain"**
4. Ange domänen: `klasskraft.se`
5. Följ SendGrids steg-för-steg guide:
   - SendGrid ger dig DNS-postar att lägga till
   - Du behöver lägga till dessa i din domänregistrator (t.ex. Loopia, One.com)
6. Lägg till DNS-postar i din domänregistrator:
   - **CNAME records** för DKIM
   - **TXT record** för SPF
   - **TXT record** för DMARC (valfritt men rekommenderat)
7. Vänta på verifiering (kan ta några minuter till timmar)
8. Kontrollera att statusen är **"Verified"** (grön bock)

**Varför detta är viktigt:**
- Utan Domain Authentication kommer Gmail fortfarande att throttla e-postmeddelanden
- Med Domain Authentication får du bättre leverans och undviker "deferred" problem

## Steg 3: Uppdatera FROM_EMAIL i Netlify

1. Gå till **Netlify Dashboard**
2. Gå till **Site settings → Environment variables**
3. Hitta `FROM_EMAIL` i listan
4. Klicka på **"Edit"** eller **"Update"**
5. Ändra värdet från `klasskraftuf@gmail.com` till `noreply@klasskraft.se`
6. Klicka på **"Save"** eller **"Update variable"**

**Kontrollera också:**
- `SITE_URL` ska vara `https://klasskraft.se` (om inte redan uppdaterat)
- `ADMIN_EMAIL` kan vara kvar som `martinpranjic32@gmail.com` eller ändras till `info@klasskraft.se`

## Steg 4: Redeploy Netlify Site

Efter att ha ändrat environment variables:

1. Gå till **Netlify Dashboard → Deploys**
2. Klicka på **"Trigger deploy"** → **"Deploy site"**
3. Eller gör en liten ändring i koden och commit för att trigga en ny deploy
4. Vänta tills deploy är klar

**Varför:** Environment variables laddas när funktionen körs, så en ny deploy säkerställer att nya värden används.

## Steg 5: Testa e-postmeddelanden

1. **Testa admin-godkännande e-post:**
   - Skapa en ny ansökan via webbplatsen
   - Kontrollera att admin får e-postmeddelandet
   - Kontrollera att `From:` adressen är `noreply@klasskraft.se`

2. **Testa order-e-post:**
   - Skicka en testbeställning
   - Kontrollera att e-postmeddelanden kommer från `noreply@klasskraft.se`

3. **Kontrollera SendGrid Activity:**
   - Gå till **SendGrid Dashboard → Activity**
   - Kontrollera att e-postmeddelanden levereras (inte "deferred")
   - Kontrollera att `From:` adressen är `noreply@klasskraft.se`

## Steg 6: Verifiera att allt fungerar

Kontrollera följande:

- [ ] `noreply@klasskraft.se` är verifierad i SendGrid (Single Sender Verification)
- [ ] `klasskraft.se` är verifierad i SendGrid (Domain Authentication)
- [ ] `FROM_EMAIL` är uppdaterad i Netlify till `noreply@klasskraft.se`
- [ ] Netlify site är redeployed
- [ ] Test-e-postmeddelanden kommer från `noreply@klasskraft.se`
- [ ] E-postmeddelanden levereras (inte "deferred") i SendGrid Activity

## Om du inte har tillgång till noreply@klasskraft.se e-postlådan

Om du inte kan verifiera `noreply@klasskraft.se` e-postlådan:

**Alternativ 1:** Använd en annan e-postadress
- Skapa `info@klasskraft.se` eller `kontakt@klasskraft.se` istället
- Verifiera den i SendGrid
- Uppdatera `FROM_EMAIL` i Netlify till den nya adressen

**Alternativ 2:** Konfigurera e-post forwarding
- Gå till din domänregistrator (t.ex. Loopia, One.com)
- Konfigurera e-post forwarding för `noreply@klasskraft.se`
- Vidarebefordra till en e-postadress du har tillgång till
- Verifiera i SendGrid med den vidarebefordrade adressen

## Viktiga noteringar

1. **Domain Authentication är KRITISKT** - utan detta kommer du fortfarande ha "deferred" problem
2. **E-postmeddelanden från `noreply@klasskraft.se` kan inte ta emot svar** - det är meningen (noreply = inga svar)
3. **För support-e-post, använd en annan adress** - t.ex. `info@klasskraft.se` eller `kontakt@klasskraft.se`
4. **Testa alltid efter ändringar** - skicka test-e-postmeddelanden och kontrollera SendGrid Activity

## Nästa steg efter detta

När `noreply@klasskraft.se` fungerar:
- E-postmeddelanden ska levereras snabbare
- Färre "deferred" e-postmeddelanden
- Bättre leverans till Gmail

Om du fortfarande har problem:
- Kontrollera SendGrid Activity för detaljerad status
- Kontrollera att Domain Authentication är verifierad
- Kontrollera Netlify Function logs för fel

