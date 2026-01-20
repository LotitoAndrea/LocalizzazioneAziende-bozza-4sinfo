// B2B Lead Locator - Main JavaScript Logic
// This script handles map initialization, geocoding, and company search via Overpass API

// --- GLOBAL VARIABLES ---
let map;
let currentMarker = null;
let searchCircle = null;
let companyMarkers = [];
let partnerMarkers = [];
let partnerCompanies = [];
let uploadedFile = null;
let clickOnMapMode = false; // Toggle for click-on-map mode

// --- 1. MAP INITIALIZATION ---
// Initialize map centered on ITIS Carlo Grassi, Turin
function initMap() {
    map = L.map('map').setView([45.111, 7.662], 17);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add click handler for placing points on map
    map.on('click', function(e) {
        if (clickOnMapMode) {
            placePointOnMap(e.latlng.lat, e.latlng.lng);
        }
    });

    console.log('Map initialized at ITIS Carlo Grassi, Turin');  
}

// --- 2. GEOCODING FUNCTION (Nominatim API) ---
async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'B2BLeadLocator/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            throw new Error('Address not found');
        }
        
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        throw error;
    }
}

// --- 3. OVERPASS API QUERY ---
async function searchCompanies(lat, lng, radiusMeters) {
    // Build Overpass query to find office, industrial, and craft businesses
    const query = `
        [out:json][timeout:25];
        (
            node["office"](around:${radiusMeters},${lat},${lng});
            way["office"](around:${radiusMeters},${lat},${lng});
            node["industrial"](around:${radiusMeters},${lat},${lng});
            way["industrial"](around:${radiusMeters},${lat},${lng});
            node["craft"](around:${radiusMeters},${lat},${lng});
            way["craft"](around:${radiusMeters},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
    `;

    const url = 'https://overpass-api.de/api/interpreter';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: query
        });
        
        if (!response.ok) {
            throw new Error('Overpass API request failed');
        }
        
        const data = await response.json();
        return processOverpassData(data);
    } catch (error) {
        console.error('Overpass API error:', error);
        throw error;
    }
}

// --- 4. PROCESS OVERPASS DATA ---
function processOverpassData(data) {
    const companies = [];
    const processedIds = new Set();

    data.elements.forEach(element => {
        // Skip if already processed or if it's just a node reference
        if (processedIds.has(element.id) || !element.tags) {
            return;
        }

        let lat, lng;

        // Get coordinates based on element type
        if (element.type === 'node') {
            lat = element.lat;
            lng = element.lon;
        } else if (element.type === 'way' && element.center) {
            lat = element.center.lat;
            lng = element.center.lon;
        } else {
            return; // Skip if we can't get coordinates
        }

        // Determine company type
        let type = 'Azienda';
        if (element.tags.office) {
            type = `Ufficio: ${element.tags.office}`;
        } else if (element.tags.industrial) {
            type = `Industriale: ${element.tags.industrial}`;
        } else if (element.tags.craft) {
            type = `Artigianato: ${element.tags.craft}`;
        }

        // Get company name
        const name = element.tags.name || 
                     element.tags['name:it'] || 
                     element.tags['operator'] || 
                     'Azienda senza nome';

        companies.push({
            id: element.id,
            name: name,
            type: type,
            lat: lat,
            lng: lng,
            tags: element.tags
        });

        processedIds.add(element.id);
    });

    return companies;
}

// --- 5. CLEAR PREVIOUS SEARCH RESULTS ---
function clearPreviousResults() {
    // Remove all company markers
    companyMarkers.forEach(marker => map.removeLayer(marker));
    companyMarkers = [];

    // Remove search circle
    if (searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }

    // Remove current marker
    if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null;
    }
}

// --- 6. VISUALIZE RESULTS ON MAP ---
function visualizeResults(companies, centerLat, centerLng, radiusMeters) {
    // Clear previous results
    clearPreviousResults();

    // Center map on search location
    map.setView([centerLat, centerLng], 13);

    // Add center marker
    currentMarker = L.marker([centerLat, centerLng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
    currentMarker.bindPopup('<strong>Punto di ricerca</strong>').openPopup();

    // Draw search radius circle (blue)
    searchCircle = L.circle([centerLat, centerLng], {
        color: '#0d6efd',
        fillColor: '#0d6efd',
        fillOpacity: 0.1,
        radius: radiusMeters
    }).addTo(map);

    // Add markers for each company
    companies.forEach(company => {
        const marker = L.marker([company.lat, company.lng]).addTo(map);
        
        // Create popup content
        const popupContent = `
            <div>
                <div class="popup-company-name">${company.name}</div>
                <div class="popup-company-type">${company.type}</div>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        companyMarkers.push(marker);
    });

    // Fit map to show all markers
    if (companies.length > 0) {
        const group = L.featureGroup([searchCircle, ...companyMarkers]);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// --- 7. UPDATE RESULTS LIST IN SIDEBAR ---
function updateResultsList(companies) {
    const resultsList = document.getElementById('results-list');
    let html = '';
    
    // Show partner companies first
    if (partnerCompanies.length > 0) {
        html += `<h6 class="mt-3 mb-2" style="color: #28a745; font-weight: 600;">🤝 Aziende Associate (${partnerCompanies.length})</h6>`;
        
        partnerCompanies.forEach((company, index) => {
            html += `
                <div class="result-item partner-company" onclick="focusOnPartner(${index})">
                    <strong>${company.nome}</strong>
                    <small>${company.via}, ${company.citta}</small>
                </div>
            `;
        });
    }
    
    // Show Overpass companies
    if (companies.length > 0) {
        if (partnerCompanies.length > 0) {
            html += `<h6 class="mt-3 mb-2" style="color: #0d6efd; font-weight: 600;">🔍 Altre Aziende Trovate (${companies.length})</h6>`;
        } else {
            html += `<div class="result-counter">${companies.length} aziende trovate</div>`;
        }
        
        companies.forEach((company, index) => {
            html += `
                <div class="result-item" onclick="focusOnCompany(${index})">
                    <strong>${company.name}</strong>
                    <small>${company.type}</small>
                </div>
            `;
        });
    }
    
    // Show empty state
    if (companies.length === 0 && partnerCompanies.length === 0) {
        html = '<p class="text-muted small">I risultati appariranno qui...</p>';
    } else if (companies.length === 0 && partnerCompanies.length > 0) {
        html += '<p class="text-muted small mt-3">Cerca aziende per visualizzare altri risultati.</p>';
    }
    
    resultsList.innerHTML = html;
}

// --- 8. FOCUS ON COMPANY MARKER ---
function focusOnCompany(index) {
    if (index >= 0 && index < companyMarkers.length) {
        const marker = companyMarkers[index];
        map.setView(marker.getLatLng(), 17);
        marker.openPopup();
    }
}

// --- 9. MAIN SEARCH FUNCTION ---
async function cercaAziende() {
    const addressInput = document.getElementById('addressInput');
    const radiusInput = document.getElementById('radiusInput');
    const searchBtn = document.getElementById('searchBtn');
    
    const address = addressInput.value.trim();
    const radius = parseInt(radiusInput.value);

    // Validation
    if (address === '') {
        alert('Inserisci un indirizzo per iniziare la ricerca!');
        return;
    }

    // Set loading state
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ricerca in corso...';

    try {
        let coords;
        
        // Check if we have a marker placed on the map with stored coordinates
        if (currentMarker && currentMarker.searchCoords) {
            coords = currentMarker.searchCoords;
            console.log('Using map-clicked coordinates:', coords);
        } else {
            // Step A: Geocode the address
            console.log('Geocoding address:', address);
            coords = await geocodeAddress(address);
            console.log('Coordinates found:', coords);
        }

        // Step B: Search for companies
        console.log('Searching companies within', radius, 'meters');
        const companies = await searchCompanies(coords.lat, coords.lng, radius);
        console.log('Companies found:', companies.length);

        // Step C: Visualize results
        visualizeResults(companies, coords.lat, coords.lng, radius);
        updateResultsList(companies);

        // Show success message
        if (companies.length > 0) {
            console.log(`Search completed: ${companies.length} companies found`);
        } else {
            alert('Nessuna azienda trovata nel raggio selezionato. Prova ad aumentare il raggio di ricerca.');
        }

    } catch (error) {
        console.error('Search error:', error);
        alert('Errore durante la ricerca: ' + error.message + '\n\nVerifica l\'indirizzo e riprova.');
    } finally {
        // Reset button state
        searchBtn.disabled = false;
        searchBtn.innerHTML = 'Cerca Aziende';
    }
}

// --- 10. USE CURRENT LOCATION ---
function usaMiaPosizione() {
    if (!navigator.geolocation) {
        alert('Il tuo browser non supporta la geolocalizzazione');
        return;
    }

    const myLocationBtn = document.getElementById('myLocationBtn');
    myLocationBtn.disabled = true;
    myLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Rilevamento...';

    // Request high-accuracy positioning with timeout
    const options = {
        enableHighAccuracy: true,  // Use GPS instead of IP-based location
        timeout: 10000,            // Wait up to 10 seconds
        maximumAge: 0              // Don't use cached position
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            console.log('📍 Position detected:', {
                lat: lat,
                lng: lng,
                accuracy: accuracy + ' meters',
                timestamp: new Date(position.timestamp).toLocaleString()
            });
            
            // Warn if accuracy is low (might be IP-based)
            if (accuracy > 1000) {
                console.warn('⚠️ Low accuracy detected (' + Math.round(accuracy) + 'm). This might be IP-based geolocation.');
                if (!confirm(`Posizione rilevata con bassa precisione (±${Math.round(accuracy/1000)}km).\n\nPotrebbe essere basata sul tuo provider internet invece che GPS.\nVuoi comunque usarla?`)) {
                    myLocationBtn.disabled = false;
                    myLocationBtn.innerHTML = 'Usa la mia posizione';
                    return;
                }
            }
            
            // Clear previous markers
            clearPreviousResults();
            
            // Center map on user location
            map.setView([lat, lng], 15);

            // Add marker at user location
            currentMarker = L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map);
            
            const popupText = `<strong>Sei qui!</strong><br><small>Precisione: ±${Math.round(accuracy)}m</small>`;
            currentMarker.bindPopup(popupText).openPopup();
            
            console.log('✓ User location marker created successfully');

            // Set input to indicate current location
            document.getElementById('addressInput').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

            // Reset button
            myLocationBtn.disabled = false;
            myLocationBtn.innerHTML = 'Usa la mia posizione';
        }, 
        (error) => {
            console.error('❌ Geolocation error:', error);
            
            let errorMessage = 'Impossibile recuperare la tua posizione.\n\n';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Hai negato il permesso di geolocalizzazione.\n\nPer risolvere:\n- Clicca sull\'icona del lucchetto/informazioni nella barra degli indirizzi\n- Consenti l\'accesso alla posizione\n- Ricarica la pagina';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Posizione non disponibile. Verifica che il GPS sia attivo.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Timeout nel rilevamento della posizione. Riprova.';
                    break;
                default:
                    errorMessage += 'Errore sconosciuto: ' + error.message;
            }
            
            alert(errorMessage);
            myLocationBtn.disabled = false;
            myLocationBtn.innerHTML = 'Usa la mia posizione';
        },
        options  // Pass options for high accuracy
    );
}

// --- 11. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize map
    initMap();

    // Attach event listeners
    document.getElementById('searchBtn').addEventListener('click', cercaAziende);
    document.getElementById('myLocationBtn').addEventListener('click', usaMiaPosizione);
    document.getElementById('clickOnMapBtn').addEventListener('click', toggleClickOnMapMode);
    
    // Excel upload event listeners
    document.getElementById('excelUpload').addEventListener('change', handleFileSelect);
    document.getElementById('processExcelBtn').addEventListener('click', processExcelFile);
    document.getElementById('clearPartnersBtn').addEventListener('click', clearPartnerCompanies);

    // Allow Enter key to trigger search
    document.getElementById('addressInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            cercaAziende();
        }
    });

    console.log('B2B Lead Locator initialized successfully');
});

// --- 12. EXCEL UPLOAD FUNCTIONS ---

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    uploadedFile = file;
    
    if (file) {
        document.getElementById('processExcelBtn').disabled = false;
        console.log('File selected:', file.name);
    } else {
        document.getElementById('processExcelBtn').disabled = true;
    }
}

// Process Excel file
async function processExcelFile() {
    if (!uploadedFile) {
        alert('Seleziona prima un file Excel!');
        return;
    }

    const processBtn = document.getElementById('processExcelBtn');
    const processText = document.getElementById('processExcelText');
    const statusDiv = document.getElementById('excel-status');
    
    // Set loading state
    processBtn.disabled = true;
    processText.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Lettura file...';
    statusDiv.style.display = 'block';
    statusDiv.className = 'alert alert-info';
    statusDiv.textContent = 'Lettura del file Excel in corso...';

    try {
        // Read file
        const data = await readExcelFile(uploadedFile);
        console.log('Excel data:', data);

        // Validate data
        if (data.length === 0) {
            throw new Error('Il file Excel è vuoto o non contiene dati validi.');
        }

        // Check for required columns
        const firstRow = data[0];
        const hasVia = 'via' in firstRow || 'Via' in firstRow || 'indirizzo' in firstRow || 'Indirizzo' in firstRow;
        const hasCitta = 'città' in firstRow || 'Città' in firstRow || 'citta' in firstRow || 'city' in firstRow || 'City' in firstRow;
        const hasCap = 'cap' in firstRow || 'CAP' in firstRow || 'Cap' in firstRow || 'codice_postale' in firstRow;

        if (!hasVia || !hasCitta) {
            throw new Error('Il file Excel deve contenere le colonne "via" e "città" (o varianti simili).');
        }
        
        // Warn if CAP is missing
        if (!hasCap) {
            console.warn('⚠️ Colonna CAP non trovata. La geocodifica potrebbe essere meno precisa.');
        }

        statusDiv.textContent = `File letto correttamente: ${data.length} aziende trovate. Inizio geocodifica...`;
        processText.textContent = 'Geocodifica in corso...';

        // Geocode companies
        const geocodedCompanies = await geocodePartnerCompanies(data);
        
        // Store partner companies
        partnerCompanies = geocodedCompanies.filter(c => !c.error);
        
        // Display on map
        displayPartnerCompanies();
        
        // Update results list
        updateResultsList([]);

        // Show success
        const successCount = partnerCompanies.length;
        const failCount = geocodedCompanies.filter(c => c.error).length;
        
        statusDiv.className = 'alert alert-success';
        statusDiv.textContent = `✓ ${successCount} aziende associate caricate con successo!${failCount > 0 ? ` (${failCount} indirizzi non geocodificati)` : ''}`;
        
        // Show clear button
        document.getElementById('clearPartnersBtn').style.display = 'block';
        
        // Fit map to show all partner companies
        if (partnerMarkers.length > 0) {
            const group = L.featureGroup(partnerMarkers);
            map.fitBounds(group.getBounds().pad(0.1));
        }

    } catch (error) {
        console.error('Excel processing error:', error);
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = `Errore: ${error.message}`;
    } finally {
        processBtn.disabled = false;
        processText.textContent = 'Elabora File';
    }
}

// Read Excel file using SheetJS
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                resolve(jsonData);
            } catch (error) {
                reject(new Error('Errore nella lettura del file Excel: ' + error.message));
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Errore nella lettura del file.'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Geocode partner companies with rate limiting
async function geocodePartnerCompanies(companies) {
    const results = [];
    const statusDiv = document.getElementById('excel-status');
    let skippedCount = 0;
    
    for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        
        // Normalize column names
        const via = company.via || company.Via || company.indirizzo || company.Indirizzo || '';
        const citta = company.città || company.Città || company.citta || company.city || company.City || '';
        const cap = company.cap || company.CAP || company.Cap || company.codice_postale || '';
        const provincia = company.provincia || company.Provincia || company.prov || company.Prov || company.PR || '';
        const regione = company.regione || company.Regione || company.region || company.Region || '';
        const nome = company.nome || company.Nome || company.ragione_sociale || company['Ragione Sociale'] || `Azienda ${i + 1}`;
        
        // Check if coordinates already exist
        const existingLat = company.lat || company.Lat || company.LAT || company.latitudine || company.Latitudine || 
                           company.latitude || company.Latitude || null;
        const existingLng = company.lng || company.Lng || company.LNG || company.lon || company.Lon || company.LON ||
                           company.longitudine || company.Longitudine || company.longitude || company.Longitude || null;
        
        // If valid coordinates exist, use them directly (skip geocoding)
        if (existingLat && existingLng && !isNaN(existingLat) && !isNaN(existingLng)) {
            const lat = parseFloat(existingLat);
            const lng = parseFloat(existingLng);
            
            // Validate coordinates are reasonable (Italy is roughly 35-47 lat, 6-19 lng)
            if (lat >= 35 && lat <= 47 && lng >= 6 && lng <= 19) {
                results.push({
                    nome: nome,
                    via: via,
                    citta: citta,
                    cap: cap,
                    provincia: provincia,
                    lat: lat,
                    lng: lng,
                    address: `${via}, ${cap} ${citta}`,
                    error: false,
                    usedExistingCoords: true
                });
                
                skippedCount++;
                statusDiv.textContent = `Elaborazione in corso... (${i + 1}/${companies.length}) - ${nome} [coordinate esistenti]`;
                console.log(`✓ Used existing coordinates: ${nome} at ${lat}, ${lng}`);
                
                // Small delay even when skipping geocoding
                if (i < companies.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                continue;
            }
        }
        
        // Build address with all available information for better geocoding
        // Priority: via, civico, CAP, città, provincia, regione, country
        let addressParts = [];
        
        if (via) addressParts.push(via);
        if (cap) addressParts.push(cap);
        if (citta) addressParts.push(citta);
        if (provincia) addressParts.push(`(${provincia.toUpperCase()})`);
        if (regione && !provincia) addressParts.push(regione);
        addressParts.push('Italy');
        
        const address = addressParts.join(', ');
        
        // Update progress
        statusDiv.textContent = `Geocodifica in corso... (${i + 1}/${companies.length}) - ${nome}`;
        
        try {
            const coords = await geocodeAddress(address);
            results.push({
                nome: nome,
                via: via,
                citta: citta,
                cap: cap,
                provincia: provincia,
                lat: coords.lat,
                lng: coords.lng,
                address: address,
                error: false,
                usedExistingCoords: false
            });
            
            console.log(`✓ Geocoded: ${nome} at ${address}`);
            
            // Delay to respect Nominatim rate limits (1 request per second)
            if (i < companies.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1100));
            }
            
        } catch (error) {
            console.warn(`✗ Failed to geocode: ${address} - ${error.message}`);
            results.push({
                nome: nome,
                via: via,
                citta: citta,
                cap: cap,
                provincia: provincia,
                address: address,
                error: true,
                errorMessage: error.message
            });
        }
    }
    
    // Log summary
    if (skippedCount > 0) {
        console.log(`📊 Geocoding summary: ${skippedCount} companies used existing coordinates, ${companies.length - skippedCount} were geocoded.`);
    }
    
    return results;
}

// Display partner companies on map
function displayPartnerCompanies() {
    // Clear existing partner markers
    partnerMarkers.forEach(marker => map.removeLayer(marker));
    partnerMarkers = [];
    
    // Create green icon for partner companies
    const greenIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    // Add markers for each partner company
    partnerCompanies.forEach((company, index) => {
        const marker = L.marker([company.lat, company.lng], { icon: greenIcon }).addTo(map);
        
        // Create popup content with "Associated" badge
        const popupContent = `
            <div>
                <div class="popup-company-name">${company.nome}</div>
                <div class="popup-company-type">${company.via}, ${company.citta}</div>
                <div style="margin-top: 8px; padding: 4px 8px; background-color: #28a745; color: white; border-radius: 4px; font-size: 0.85em; text-align: center;">
                    🤝 Associata a ITIS Carlo Grassi
                </div>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        partnerMarkers.push(marker);
    });
    
    console.log(`Displayed ${partnerMarkers.length} partner company markers`);
}

// Clear partner companies
function clearPartnerCompanies() {
    if (!confirm('Vuoi rimuovere tutte le aziende associate dalla mappa?')) {
        return;
    }
    
    // Clear markers
    partnerMarkers.forEach(marker => map.removeLayer(marker));
    partnerMarkers = [];
    partnerCompanies = [];
    
    // Clear file input
    document.getElementById('excelUpload').value = '';
    document.getElementById('processExcelBtn').disabled = true;
    uploadedFile = null;
    
    // Hide status and clear button
    document.getElementById('excel-status').style.display = 'none';
    document.getElementById('clearPartnersBtn').style.display = 'none';
    
    // Update results list
    updateResultsList([]);
    
    console.log('Partner companies cleared');
}

// --- 13. ENHANCED FOCUS ON COMPANY ---
function focusOnCompany(index) {
    if (index >= 0 && index < companyMarkers.length) {
        const marker = companyMarkers[index];
        map.setView(marker.getLatLng(), 17);
        marker.openPopup();
    }
}

function focusOnPartner(index) {
    if (index >= 0 && index < partnerMarkers.length) {
        const marker = partnerMarkers[index];
        map.setView(marker.getLatLng(), 17);
        marker.openPopup();
    }
}

// --- 14. CLICK ON MAP FUNCTIONALITY ---
// Toggle click-on-map mode
function toggleClickOnMapMode() {
    const btn = document.getElementById('clickOnMapBtn');
    const hint = document.getElementById('clickOnMapHint');
    
    clickOnMapMode = !clickOnMapMode;
    
    if (clickOnMapMode) {
        btn.classList.remove('btn-outline-info');
        btn.classList.add('btn-info');
        btn.innerHTML = '🎯 Modalità Selezione Attiva';
        hint.style.display = 'block';
        hint.style.setProperty('display', 'block', 'important');
        
        // Change cursor on map
        document.getElementById('map').style.cursor = 'crosshair';
    } else {
        btn.classList.remove('btn-info');
        btn.classList.add('btn-outline-info');
        btn.innerHTML = '📍 Segna sulla Mappa';
        hint.style.display = 'none';
        hint.style.setProperty('display', 'none', 'important');
        
        // Reset cursor
        document.getElementById('map').style.cursor = '';
    }
}

// Place a point on the map when clicked
function placePointOnMap(lat, lng) {
    // Clear previous marker
    if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null;
    }
    
    // Clear previous search circle
    if (searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }
    
    // Create purple marker for user-placed point
    currentMarker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
    
    currentMarker.bindPopup('<strong>📍 Punto selezionato</strong><br><small>Clicca "Cerca Aziende" per trovare le aziende vicine</small>').openPopup();
    
    // Update address input with coordinates
    document.getElementById('addressInput').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Store coordinates for direct search (bypass geocoding)
    currentMarker.searchCoords = { lat: lat, lng: lng };
    
    console.log('Point placed on map:', { lat, lng });
    
    // Disable click mode after placing (optional - can be toggled)
    toggleClickOnMapMode();
}