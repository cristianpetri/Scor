# Scor – Manager turneu de volei

Aplicație web în PHP pentru organizarea și monitorizarea unui turneu de volei cu interfață separată pentru vizitatori și administratori.

## 🎯 Funcționalități principale

### Pentru Vizitatori (Acces Public)
- **📋 Meciuri**: Vizualizarea programului complet al meciurilor
- **⚡ Meci Live**: Urmărirea în timp real a meciurilor în desfășurare
- **🏆 Clasament**: Tabel de clasament actualizat automat cu statistici detaliate
- **📊 Statistici**: Istoricul complet al meciurilor și statistici pe echipe
- **📤 Export & Share**: Descărcare JPG și partajare WhatsApp pentru clasament și statistici

### Pentru Administratori (Acces Autentificat)
- **🎨 Configurare Aplicație**: Personalizare titlu turneu
- **👥 Gestionare Echipe**: Adăugare și ștergere echipe participante
- **🎮 Configurare Meciuri**: Generare automată program (Best of 3 sau Best of 5)
- **📋 Gestionare Program**: Reordonare meciuri prin drag & drop
- **⚡ Control Live**: Marcarea punctelor în timp real pentru meciuri active
- **↩️ Corectare**: Anulare ultim punct în caz de greșeală

## 📁 Structura proiectului

```
├── ajax.php              # Endpoint AJAX pentru operațiuni CRUD
├── config.php            # Conexiune bază de date și autentificare
├── database.sql          # Script creare bază de date
├── functions.php         # Logica de business
├── index.php             # Interfața principală
├── script.js             # JavaScript refactorizat (5 părți)
├── styles.css            # Stilizare interfață
└── README.md             # Documentație
```

## 🔧 Cerințe Tehnice

- **PHP**: 8.0+ cu extensiile `pdo` și `pdo_mysql`
- **Server Web**: Apache/Nginx cu suport PHP
- **Bază de date**: MySQL 5.7+ / MariaDB 10+
- **Browser**: Suport modern pentru HTML5 Canvas și Web Share API

## 📦 Instalare Locală

### 1. Configurare Bază de Date

```sql
CREATE DATABASE volei_turneu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Import Structură

```bash
mysql -u utilizator -p volei_turneu < database.sql
```

### 3. Configurare Conexiune

Editează `config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'utilizator_tau');
define('DB_PASS', 'parola_ta');
define('DB_NAME', 'volei_turneu');
```

### 4. Acces Aplicație

Accesează: `http://localhost/Scor`

**Cont implicit administrator:**
- Utilizator: `admin`
- Parolă: `admin123`

## 🌐 Deployment pe Hosting

### 1. Pregătire Bază de Date

- Creează baza de date în cPanel/Plesk
- Importă `database.sql` prin phpMyAdmin
- Notează credențialele (host, user, pass, database)

### 2. Configurare Fișiere

Editează `config.php` cu datele de la hosting:

```php
define('DB_HOST', 'localhost');        // sau IP furnizat
define('DB_USER', 'user_hosting');
define('DB_PASS', 'parola_hosting');
define('DB_NAME', 'nume_baza_date');
```

### 3. Upload Fișiere

- Încarcă toate fișierele în `public_html/` sau subdirector
- Păstrează structura originală de foldere
- Verifică permisiuni: 644 pentru fișiere, 755 pentru directoare

### 4. Verificare Funcționalitate

1. Accesează domeniul în browser
2. Autentifică-te cu `admin` / `admin123`
3. Testează adăugarea unei echipe
4. Generează meciuri de probă

## 🔐 Securitate

### Schimbare Parolă Administrator

1. Generează hash nou:
```php
<?php
echo password_hash('parola_noua', PASSWORD_DEFAULT);
?>
```

2. Actualizează în baza de date:
```sql
UPDATE users 
SET password_hash = 'hash_generat_mai_sus' 
WHERE username = 'admin';
```

### Recomandări

- ✅ Folosește parole puternice (min. 12 caractere)
- ✅ Limitează privilegiile utilizatorului bazei de date
- ✅ Activează HTTPS pentru transmitere securizată
- ✅ Creează backup regulat al bazei de date
- ✅ Monitorizează log-urile pentru activitate suspectă

## 🎮 Ghid de Utilizare

### Pentru Vizitatori

1. **Vizualizare Meciuri**: Click pe tab-ul "📋 Meciuri"
2. **Urmărire Live**: Click "📊 Detalii" pe meci → Vezi scorul live
3. **Verificare Clasament**: Tab "🏆 Clasament" → Export/Share disponibil
4. **Statistici**: Tab "📊 Statistici" → Istoric complet meciuri

### Pentru Administratori

#### Configurare Inițială

1. **Autentificare**: Click "🔐 Autentificare Admin" → Introdu credențiale
2. **Personalizare**: Tab "⚙️ Administrare" → Modifică titlul aplicației
3. **Adăugare Echipe**: Introdu nume → Click "➕ Adaugă"
4. **Generare Program**: Selectează format (Best of 3/5) → "🎮 Generează Meciuri"

#### Gestionare Meciuri Live

1. **Start Meci**: În secțiunea "Gestionare Meciuri" → Click "▶️ Pornește"
2. **Marcare Puncte**: Apare panoul de control → Click "+ Punct" pentru echipa care marchează
3. **Corectare**: Click "↩️ Anulează ultimul punct" dacă e necesar
4. **Finalizare Automată**: Meciul se încheie automat la atingerea seturilor necesare

#### Reordonare Program

- Click săgeți ⬆️⬇️ lângă meciurile în status "Programat"
- Ordinea se salvează automat

## 🎨 Personalizare

### Schimbare Titlu Aplicație

1. Autentificare ca admin
2. Tab "⚙️ Administrare"
3. Secțiunea "🎨 Configurare Aplicație"
4. Introdu titlu nou → Click "💾 Salvează"

### Modificare Culori (styles.css)

```css
:root {
    --team1-color-light: #bfdbfe;    /* Echipa 1 - albastru deschis */
    --team1-color-mid: #93c5fd;
    --team1-color-strong: #3b82f6;
    
    --team2-color-light: #fecaca;    /* Echipa 2 - roșu deschis */
    --team2-color-mid: #fda4af;
    --team2-color-strong: #f87171;
}
```

## 📊 Calcul Clasament

Clasamentul se calculează conform următoarelor criterii (în ordine):

1. **Puncte Clasament**: Victorie = 2 puncte, Înfrângere = 1 punct
2. **Raport Seturi**: Seturi câștigate ÷ Seturi pierdute
3. **Raport Puncte**: Puncte câștigate ÷ Puncte pierdute
4. **Diferență Seturi**: Seturi câștigate - Seturi pierdute
5. **Diferență Puncte**: Puncte câștigate - Puncte pierdute
6. **Ordine Alfabetică**: Nume echipă (A-Z)

## 🔄 Structură Modificată

### Separarea Interfețelor

**Înainte**: Un singur view "Setup" pentru admin, meciuri vizibile pentru toți
**Acum**: 
- **View-uri publice**: Meciuri, Meci Live, Clasament, Statistici
- **View admin**: Panou dedicat "⚙️ Administrare" (vizibil doar după autentificare)

### Beneficii

✅ **Experiență mai bună pentru vizitatori**: Interfață simplificată, fără elemente confuze
✅ **Control mai bun pentru admin**: Toate funcțiile într-un singur panou centralizat
✅ **Securitate îmbunătățită**: Acțiuni critice doar după autentificare verificată
✅ **Responsive**: Optimizat pentru mobile și desktop

## 🛠️ Rezolvare Probleme

### Probleme de Autentificare

**Simptom**: Nu apar opțiunile de admin după autentificare

**Soluție**:

1. Verifică existența utilizatorului:
```sql
SELECT id, username, role FROM users WHERE username = 'admin';
```

2. Dacă lipsește, creează-l:
```sql
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2y$12$scN8jdYV.KqV9T1hI0TNY.v7zq2rIS/OXHOpoJSbkGYGhUS46kPcW', 'admin');
```

3. Verifică rolul:
```sql
UPDATE users SET role = 'admin' WHERE username = 'admin';
```

4. Șterge cache browser și încearcă din nou

### Probleme cu Live Match

**Simptom**: Timerul nu se actualizează

**Soluție**: Verifică dacă JavaScript este activat în browser

**Simptom**: Punctele nu se înregistrează

**Soluție**: 
1. Verifică consola browser pentru erori
2. Asigură-te că ești autentificat ca admin
3. Verifică dacă meciul este în status "live"

### Probleme cu Export/Share

**Simptom**: Export JPG nu funcționează

**Soluție**: 
1. Verifică dacă biblioteca html2canvas se încarcă corect
2. Dezactivează blocările de pop-up în browser
3. Încearcă din modul incognito

**Simptom**: WhatsApp share nu funcționează

**Soluție**:
1. Pe desktop: Va deschide WhatsApp Web cu mesaj text
2. Pe mobile: Verifică dacă aplicația WhatsApp este instalată
3. Fallback: Se va folosi text share dacă imaginea nu poate fi partajată

## 📱 Caracteristici Mobile

- ✅ Design 100% responsive
- ✅ Touch-friendly pentru butoane și control live
- ✅ Optimizat pentru ecrane mici (timeline puncte adaptiv)
- ✅ Share nativ pe mobile (Web Share API)
- ✅ Instalabil ca PWA (Progressive Web App) - opțional

## 🚀 Funcționalități Viitoare (Opțional)

- [ ] Export PDF pentru clasament și statistici
- [ ] Notificări push pentru meciuri live
- [ ] Sistem de utilizatori multipli cu roluri personalizate
- [ ] Istoricul turneelor anterioare
- [ ] Grafice interactive pentru statistici
- [ ] API REST pentru integrări externe
- [ ] Mod spectator cu auto-refresh
- [ ] Suport multi-turneu (gestionare simultană)

## 🤝 Contribuții

Pull request-urile sunt binevenite! Pentru modificări majore:

1. Deschide mai întâi un issue pentru discuție
2. Fork repository-ul
3. Creează branch pentru feature (`git checkout -b feature/NovaFunctionalitate`)
4. Commit modificările (`git commit -m 'Adaugă NovaFunctionalitate'`)
5. Push la branch (`git push origin feature/NovaFunctionalitate`)
6. Deschide Pull Request

## 📄 Licență

Acest proiect este open-source și disponibil sub licența MIT.

## 🆘 Suport

Pentru probleme sau întrebări:

1. **Issues GitHub**: Deschide un issue cu detalii complete
2. **Documentație**: Consultă acest README
3. **Code comments**: Verifică comentariile din cod pentru clarificări

## 📝 Changelog

### v2.0.0 (2025-01-08)
- ✨ Separare completă interfață vizitatori vs administratori
- ✨ Panou dedicat administrare cu toate funcțiile centralizate
- ✨ Control live simplificat pentru meciuri în desfășurare
- ✨ Îmbunătățiri UI/UX pentru ambele tipuri de utilizatori
- 🔒 Securitate sporită cu verificări riguroase de rol
- 📱 Optimizări responsive pentru mobile

### v1.0.0 (Initial)
- 🎉 Versiune inițială cu funcționalități de bază
- 👥 Gestionare echipe
- 🎮 Generare automată meciuri
- ⚡ Urmărire live
- 🏆 Clasament automat
- 📊 Statistici detaliate

## 🙏 Mulțumiri

- html2canvas pentru capturi de ecran
- Comunitatea PHP pentru best practices
- Toți contributori și utilizatori pentru feedback

---

**Dezvoltat cu ❤️ pentru pasionații de volei**