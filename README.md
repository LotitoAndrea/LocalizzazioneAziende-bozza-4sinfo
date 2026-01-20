# 📍 B2B Lead Locator

**Applicazione web per la localizzazione di aziende B2B** sviluppata con Bootstrap 5 e Leaflet.js.

Un tool interattivo che permette di cercare aziende (uffici, industrie, artigiani) in un determinato raggio da un indirizzo specificato, utilizzando le API OpenStreetMap.

---

## 🎯 Funzionalità Principali

- **Ricerca per indirizzo**: Inserisci qualsiasi indirizzo e trova aziende nei dintorni
- **Raggio personalizzabile**: Scegli tra 1, 5, 10 o 20 km di distanza
- **Geolocalizzazione**: Usa la tua posizione corrente come punto di partenza
- **Mappa interattiva**: Visualizza le aziende trovate su mappa con marker cliccabili
- **Lista risultati**: Elenco dettagliato nella sidebar con nome e tipo di azienda
- **Completamente gratuito**: Usa solo API open source (Nominatim e Overpass)

---

## 🚀 Come Utilizzare l'Applicazione

### 1. **Avvio del Progetto**

Puoi aprire l'applicazione in diversi modi:

#### Opzione A: Apertura diretta
- Fai doppio click su `index.html`
- Il file si aprirà nel browser predefinito

#### Opzione B: Con Live Server (consigliato per sviluppo)
- Apri il progetto in VS Code
- Clicca con il tasto destro su `index.html`
- Seleziona "Open with Live Server"
- L'app si aprirà su `http://127.0.0.1:5500`

#### Opzione C: Con server Python
```bash
python -m http.server 8000
```
Poi apri `http://localhost:8000` nel browser

---

### 2. **Ricerca di Aziende**

1. **Inserisci un indirizzo** nel campo "Punto di partenza"
   - Esempio: `Via Roma, Torino`
   - Esempio: `Piazza Castello, Torino`
   - Esempio: `Corso Francia, Torino`

2. **Seleziona il raggio di ricerca** (default: 5 km)
   - 1 km per ricerche molto localizzate
   - 5 km per aree urbane medie
   - 10-20 km per aree più ampie

3. **Clicca su "Cerca Aziende"**
   - Il sistema geocodificherà l'indirizzo
   - Cercherà aziende nel raggio specificato
   - Mostrerà i risultati sulla mappa e nella lista

4. **Interagisci con i risultati**
   - Clicca sui marker sulla mappa per vedere i dettagli
   - Clicca sugli elementi della lista per centrare il marker corrispondente
   - Esplora la mappa liberamente con zoom e pan

---

### 3. **Usa la Tua Posizione**

- Clicca su **"Usa la mia posizione"**
- Autorizza il browser a usare la geolocalizzazione
- La mappa si centrerà sulla tua posizione corrente
- Potrai poi cercare aziende nei dintorni

---

## 🏗️ Struttura del Progetto

```
LocalizzazioneAziende-bozza-4sinfo/
│
├── index.html          # Struttura HTML e importazione librerie
├── style.css           # Stili personalizzati dell'applicazione
├── script.js           # Logica JavaScript e chiamate API
└── README.md           # Documentazione (questo file)
```

### Descrizione dei File

#### **index.html**
- Contiene la struttura HTML dell'applicazione
- Include Bootstrap 5 per il layout responsive
- Include Leaflet.js per la mappa interattiva
- Struttura a due colonne: sidebar (menu) e mappa

#### **style.css**
- Stili personalizzati per layout e componenti
- Design responsive per mobile e desktop
- Animazioni e transizioni per migliorare l'UX
- Personalizzazione dei popup della mappa

#### **script.js**
- Inizializzazione della mappa (centrata su ITIS Carlo Grassi, Torino)
- Geocoding tramite API Nominatim
- Ricerca aziende tramite API Overpass
- Gestione dei marker e della visualizzazione
- Event listeners e gestione errori

---

## 🔧 Come Funziona Tecnicamente

### **Step 1: Geocoding (Conversione Indirizzo → Coordinate)**

Quando l'utente inserisce un indirizzo e clicca "Cerca Aziende":

```javascript
// Chiamata all'API Nominatim di OpenStreetMap
const url = `https://nominatim.openstreetmap.org/search?format=json&q=${indirizzo}`;
```

L'API restituisce le coordinate (latitudine e longitudine) dell'indirizzo.

---

### **Step 2: Ricerca Aziende (API Overpass)**

Con le coordinate ottenute, viene effettuata una query all'API Overpass:

```javascript
// Query Overpass per cercare aziende nel raggio specificato
const query = `
  [out:json][timeout:25];
  (
    node["office"](around:${raggio},${lat},${lng});
    way["office"](around:${raggio},${lat},${lng});
    node["industrial"](around:${raggio},${lat},${lng});
    way["industrial"](around:${raggio},${lat},${lng});
    node["craft"](around:${raggio},${lat},${lng});
    way["craft"](around:${raggio},${lat},${lng});
  );
  out body;
`;
```

Questa query cerca:
- **office**: Uffici e studi professionali
- **industrial**: Aziende industriali e manifatturiere
- **craft**: Artigiani e laboratori

---

### **Step 3: Visualizzazione Risultati**

I dati ricevuti vengono processati e visualizzati:

1. **Mappa**:
   - Marker rosso per il punto di ricerca
   - Cerchio blu per il raggio di ricerca
   - Marker per ogni azienda trovata
   - Popup con nome e tipo azienda

2. **Sidebar**:
   - Contatore risultati
   - Lista cliccabile di tutte le aziende
   - Ogni elemento mostra nome e tipo

---

## 🌐 API Utilizzate

### **1. Nominatim API (Geocoding)**
- **URL**: `https://nominatim.openstreetmap.org/search`
- **Scopo**: Convertire indirizzi in coordinate geografiche
- **Gratuita**: Sì, con fair use policy
- **Documentazione**: [https://nominatim.org/release-docs/latest/api/Search/](https://nominatim.org/release-docs/latest/api/Search/)

### **2. Overpass API (Ricerca POI)**
- **URL**: `https://overpass-api.de/api/interpreter`
- **Scopo**: Cercare punti di interesse (aziende) nel database OpenStreetMap
- **Gratuita**: Sì, open source
- **Documentazione**: [https://wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API)

### **3. OpenStreetMap Tiles**
- **URL**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Scopo**: Visualizzazione della mappa
- **Gratuita**: Sì
- **Documentazione**: [https://wiki.openstreetmap.org/wiki/Tiles](https://wiki.openstreetmap.org/wiki/Tiles)

---

## 📦 Dipendenze

### **Bootstrap 5.3.0**
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
```
- Framework CSS per layout responsive e componenti UI

### **Leaflet.js 1.9.4**
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```
- Libreria JavaScript per mappe interattive

---

## 🎨 Caratteristiche Design

- **Layout Responsive**: Si adatta a desktop, tablet e mobile
- **Sidebar Scorrevole**: Lista risultati con scroll indipendente
- **Animazioni Fluide**: Hover effects e transizioni smooth
- **Loading States**: Feedback visivo durante le ricerche
- **Error Handling**: Messaggi chiari in caso di problemi

---

## 🔍 Esempi di Indirizzi da Testare (Torino)

- `Via Roma, Torino` - Centro città
- `Corso Francia, Torino` - Zona commerciale
- `Lingotto, Torino` - Ex area industriale
- `Via Nizza, Torino` - Area uffici
- `Piazza Castello, Torino` - Centro storico
- `Via Buniva, Torino` - Zona ITIS Carlo Grassi

---

## 🛠️ Tecnologie Utilizzate

- **HTML5** - Struttura semantica
- **CSS3** - Styling moderno con Flexbox
- **JavaScript ES6+** - Logica applicativa con async/await
- **Bootstrap 5** - Framework CSS
- **Leaflet.js** - Libreria mappe
- **OpenStreetMap** - Dati geografici e tiles
- **Nominatim API** - Geocoding
- **Overpass API** - Query POI

---

## 📝 Note Importanti

### **Limiti API Gratuite**
- Le API gratuite hanno limiti di rate (richieste al secondo)
- Evita richieste massive in breve tempo
- Usa con fair use policy

### **Qualità Dati**
- I dati provengono da OpenStreetMap (crowd-sourced)
- La completezza varia in base alla zona geografica
- Alcune aziende potrebbero non essere presenti nel database

### **Browser Supportati**
- Chrome/Edge (versioni recenti)
- Firefox (versioni recenti)
- Safari (versioni recenti)
- **Richiede connessione internet** per API e tiles

---

## 🎓 Progetto Didattico

Questo progetto è stato sviluppato come strumento didattico per:
- Imparare l'integrazione di API REST
- Gestire mappe interattive con Leaflet.js
- Praticare JavaScript asincrono (async/await)
- Creare applicazioni web responsive
- Strutturare codice in file separati (HTML, CSS, JS)

---

## 📍 Configurazione Iniziale

La mappa è inizializzata con queste coordinate:
- **Posizione**: ITIS Carlo Grassi, Torino
- **Latitudine**: 45.1051
- **Longitudine**: 7.6385
- **Zoom**: 15

Puoi modificare queste impostazioni in `script.js` nella funzione `initMap()`.

---

## 🐛 Risoluzione Problemi

### La mappa non si carica
- Verifica la connessione internet
- Controlla la console del browser (F12) per errori
- Assicurati che i file CSS e JS siano correttamente linkati

### Nessuna azienda trovata
- Prova ad aumentare il raggio di ricerca
- Verifica che l'indirizzo sia corretto
- Alcune zone potrebbero avere pochi dati OpenStreetMap

### Errore di geocoding
- Controlla l'ortografia dell'indirizzo
- Aggiungi più dettagli (città, provincia)
- Prova con coordinate dirette (es: "45.1051, 7.6385")

---

## 📄 Licenza

Progetto didattico open source.  
Le API utilizzate sono fornite da OpenStreetMap e relative community.

---

## 👨‍💻 Autore

Progetto sviluppato per il corso di Informatica - ITIS Carlo Grassi, Torino

---

**Buona ricerca di lead B2B! 🚀**