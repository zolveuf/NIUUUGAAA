# E-post Debug Checklist

## Problem: E-post skickas inte till KlassKraft UF eller organisationen

### Steg 1: Kontrollera Netlify Environment Variables

Gå till: **Netlify Dashboard → Site settings → Environment variables**

Kontrollera att följande variabler finns och är korrekta:

- [ ] `SENDGRID_API_KEY` - Måste vara en giltig SendGrid API-nyckel (börjar med `SG.`)
- [ ] `FROM_EMAIL` - Måste vara en verifierad e-postadress i SendGrid (t.ex. `klasskraftuf@gmail.com`)
- [ ] `ADMIN_EMAIL` - Dit admin-e-post ska skickas (t.ex. `klasskraftuf@gmail.com`)
- [ ] `SITE_URL` - Din webbplats URL

**Viktigt:** 
- API-nyckeln måste vara komplett (börjar med `SG.` och är ca 70 tecken lång)
- FROM_EMAIL måste vara verifierad i SendGrid (se steg 2)

### Steg 2: Kontrollera SendGrid Configuration

Gå till: **SendGrid Dashboard → Settings → Sender Authentication**

#### A. Single Sender Verification
- [ ] `FROM_EMAIL` (t.ex. `klasskraftuf@gmail.com`) måste vara verifierad
- [ ] Klicka på "Verify Single Sender" om den inte är verifierad
- [ ] Kontrollera att status är "Verified" (grön bock)

#### B. API Keys
- [ ] Gå till **Settings → API Keys**
- [ ] Kontrollera att API-nyckeln som används i Netlify finns och är aktiv
- [ ] API-nyckeln måste ha "Mail Send" permissions

### Steg 3: Kontrollera Netlify Function Logs

Gå till: **Netlify Dashboard → Functions → submit-application → Logs**

Efter att någon försökt skicka alla beställningar, leta efter:

#### ✅ Om det fungerar, ser du:
```
✅ SendGrid configuration validated
   API Key: Present (SG.xxxxx...)
   FROM_EMAIL: klasskraftuf@gmail.com
   ADMIN_EMAIL: klasskraftuf@gmail.com
✅ Email sent successfully to KlassKraft UF (admin)
✅ Email sent successfully to organization (seller)
```

#### ❌ Om det inte fungerar, leta efter:
```
❌ CRITICAL ERROR: SENDGRID_API_KEY is not set
❌ CRITICAL ERROR sending email to KlassKraft UF (admin)
Error message: [felmeddelande här]
```

### Steg 4: Vanliga fel och lösningar

#### Fel 1: "SENDGRID_API_KEY is not set"
**Lösning:** 
- Gå till Netlify → Environment variables
- Lägg till `SENDGRID_API_KEY` med din SendGrid API-nyckel
- Redeploy site

#### Fel 2: "The from address does not match a verified Sender Identity"
**Lösning:**
- Gå till SendGrid → Settings → Sender Authentication
- Verifiera `FROM_EMAIL` adressen
- Vänta tills verifieringen är klar (kan ta några minuter)

#### Fel 3: "Forbidden" eller "401 Unauthorized"
**Lösning:**
- Kontrollera att API-nyckeln är korrekt i Netlify
- Kontrollera att API-nyckeln inte har utgått
- Skapa en ny API-nyckel i SendGrid om nödvändigt

#### Fel 4: E-post skickas men hamnar i spam
**Lösning:**
- Verifiera FROM_EMAIL i SendGrid
- Överväg att konfigurera Domain Authentication (för klasskraft.se)
- Be mottagaren kontrollera spam-mappen

### Steg 5: Testa manuellt

1. **Testa SendGrid API-nyckel:**
   - Gå till SendGrid Dashboard
   - Skapa en test-e-post via SendGrid UI
   - Om detta fungerar, är problemet i koden
   - Om detta inte fungerar, är problemet i SendGrid-konfigurationen

2. **Kontrollera Netlify Function:**
   - Gå till Netlify → Functions → submit-application
   - Klicka på "Test" eller "Invoke"
   - Kontrollera logs för felmeddelanden

### Steg 6: Debug Information att samla in

Om problemet kvarstår, samla in följande information:

1. **Från Netlify Logs:**
   - Kopiera alla loggar från senaste "send all orders" försöket
   - Leta efter rader med "❌" eller "ERROR"

2. **Från SendGrid:**
   - Gå till **Activity** i SendGrid Dashboard
   - Kontrollera om e-postmeddelanden visas där (även om de misslyckades)
   - Ta skärmdumpar av eventuella fel

3. **Environment Variables:**
   - Kontrollera att alla variabler är satta (utan att visa värdena)
   - Kontrollera att de är satta för rätt environment (Production/Deploy preview)

### Snabbfix Checklist

Om e-post inte skickas, gå igenom denna lista:

- [ ] `SENDGRID_API_KEY` finns i Netlify Environment Variables
- [ ] `FROM_EMAIL` finns i Netlify Environment Variables
- [ ] `FROM_EMAIL` är verifierad i SendGrid
- [ ] API-nyckeln börjar med `SG.` och är ca 70 tecken
- [ ] API-nyckeln har "Mail Send" permissions
- [ ] Netlify site är redeployed efter att variabler ändrats
- [ ] Kontrollera Netlify Function logs för felmeddelanden

### Kontakta Support

Om inget av ovanstående fungerar, samla in:
1. Netlify Function logs (från senaste försöket)
2. SendGrid Activity log
3. Screenshot av Netlify Environment Variables (dölj värdena)
4. Screenshot av SendGrid Sender Verification status

