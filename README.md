# Scor – Manager turneu de volei

Aplicație web în PHP pentru organizarea și monitorizarea unui turneu de volei: înregistrarea echipelor, generarea programului de meciuri, urmărirea scorurilor live și statistici automate.

## Funcționalități principale
- Adăugare și ștergere rapidă a echipelor participante.
- Generare automată a programului (fiecare cu fiecare) pentru formatele *best of 3* sau *best of 5*.
- Urmărire live a punctelor și seturilor, inclusiv istoric detaliat al fiecărui punct.
- Clasament general cu actualizare automată a statisticilor (victorii, seturi/puncte câștigate/pierdute).
- Export rapid al clasamentului în format imagine (folosind `html2canvas`).

## Structura proiectului
```
├── ajax.php        # Endpoint AJAX pentru operațiile CRUD și actualizări în timp real
├── config.php      # Conexiune la baza de date (PDO) și utilitare comune
├── database.sql    # Scriptul de creare a bazei de date și a tabelelor
├── functions.php   # Logica de business (echipe, meciuri, statistici)
├── index.php       # Interfața principală a aplicației
├── script.js       # Funcționalități front-end și integrarea cu endpoint-urile AJAX
└── styles.css      # Stilizarea interfeței
```

## Cerințe
- PHP 8.0 sau mai nou, cu extensiile `pdo` și `pdo_mysql` activate.
- Server web (Apache/Nginx) configurat cu suport PHP.
- MySQL 5.7+ / MariaDB 10+.
- Composer **nu** este necesar (nu există dependențe externe PHP).

## Instalare locală
1. Clonează proiectul sau copiază fișierele în directorul tău web (`htdocs`, `public_html` etc.).
2. Creează baza de date:
   ```sql
   CREATE DATABASE volei_turneu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Importă structura și datele inițiale din `database.sql`:
   ```bash
   mysql -u <utilizator> -p volei_turneu < database.sql
   ```
4. Actualizează credențialele din `config.php` dacă nu folosești `root` fără parolă.
5. Accesează aplicația din browser (de ex. `http://localhost/Scor`).

## Ghid de găzduire (shared hosting / producție)
1. **Pregătirea bazei de date**
   - Creează baza de date în panoul de control al hostingului.
   - Importă fișierul `database.sql` folosind phpMyAdmin sau CLI (`mysql`).

2. **Actualizarea configurației**
   - Deschide `config.php` și înlocuiește constantele `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` cu datele furnizate de provider.
   - Dacă hostingul tău oferă un prefix pentru tabele, actualizează scriptul SQL înainte de import.

3. **Încărcarea fișierelor**
   - Încarcă toate fișierele din proiect în directorul public al domeniului/subdomeniului (ex. `public_html/`), păstrând structura originală.
   - Asigură-te că directorul conține și `database.sql` doar dacă ai nevoie ulterior; nu este obligatoriu pe server.

4. **Setări suplimentare**
   - Pentru Apache: nu este necesară o configurație specială; fișierele `.php` vor fi servite nativ.
   - Pentru Nginx + PHP-FPM: configurează un `server` block ce trimite fișierele `.php` către PHP-FPM.
   - Verifică permisiunile de fișiere (în general 644 pentru fișiere și 755 pentru directoare).

5. **Verificări finale**
   - Accesează domeniul și adaugă câteva echipe pentru a verifica conexiunea la baza de date.
   - Dacă apar erori, consultă log-urile de server sau activează afișarea erorilor în `php.ini` (temporar) pentru depanare.

## Recomandări de securitate
- Setează o parolă puternică pentru utilizatorul bazei de date și limitează-i privilegiile la baza creată.
- Ia în considerare protejarea accesului la aplicație cu autentificare dacă nu este destinată publicului larg.
- Realizează periodic backup pentru baza de date (`mysqldump`) și fișiere.

## Dezvoltare și contribuții
Pull request-urile și sugestiile sunt binevenite. Înainte de a propune modificări majore, deschide un issue pentru discuții.
