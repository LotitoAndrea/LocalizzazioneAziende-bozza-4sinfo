// B2B Lead Locator - Main JavaScript Logic
// This script handles map initialization, geocoding, and company search via Overpass API

// --- GLOBAL VARIABLES ---
let map;
let currentMarker = null;
let searchCircle = null;
let companyMarkers = [];

// --- 1. MAP INITIALIZATION ---
// Initialize map centered on ITIS Carlo Grassi, Turin
function initMap() {
    map = L.map('map').setView([45.111, 7.662], 17);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

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
    
    if (companies.length === 0) {
        resultsList.innerHTML = '<p class="text-muted small">Nessuna azienda trovata nel raggio selezionato.</p>';
        return;
    }

    let html = `<div class="result-counter">${companies.length} aziende trovate</div>`;
    
    companies.forEach((company, index) => {
        html += `
            <div class="result-item" onclick="focusOnCompany(${index})">
                <strong>${company.name}</strong>
                <small>${company.type}</small>
            </div>
        `;
    });
    
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
        // Step A: Geocode the address
        console.log('Geocoding address:', address);
        const coords = await geocodeAddress(address);
        console.log('Coordinates found:', coords);

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

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Center map on user location
            map.setView([lat, lng], 14);

            // Clear previous markers
            clearPreviousResults();

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
            currentMarker.bindPopup('Sei qui!').openPopup();

            // Set input to indicate current location
            document.getElementById('addressInput').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

            // Reset button
            myLocationBtn.disabled = false;
            myLocationBtn.innerHTML = 'Usa la mia posizione';
        }, 
        (error) => {
            console.error('Geolocation error:', error);
            alert('Impossibile recuperare la tua posizione. Verifica i permessi del browser.');
            myLocationBtn.disabled = false;
            myLocationBtn.innerHTML = 'Usa la mia posizione';
        }
    );
}

// --- 11. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize map
    initMap();

    // Attach event listeners
    document.getElementById('searchBtn').addEventListener('click', cercaAziende);
    document.getElementById('myLocationBtn').addEventListener('click', usaMiaPosizione);

    // Allow Enter key to trigger search
    document.getElementById('addressInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            cercaAziende();
        }
    });

    console.log('B2B Lead Locator initialized successfully');
});
