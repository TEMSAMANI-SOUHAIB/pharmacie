
let map;
let userLatLng;
let directionsService;
let directionsRenderer;

let mapIsOpen = false;    // pour le rideau de la carte
let listIsOpen = false;   // pour le rideau de la liste

// Tableau global où l’on stocke toutes les pharmacies récupérées (jusqu'à 60)
let allPharmacies = [];

// Icônes pour les modes (itinéraire)
const icons = {
    WALKING:  "pieton.png",
    BICYCLING:"bike.png",
    DRIVING:  "car.avif",
    TRANSIT:  "commun.png"
};

// Icônes pour marqueurs de pharmacies
const iconDarkGreen = "https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_greenD.png";
const iconGreen     = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";

/* === 1) Initialisation de la carte === */
function initMap() {
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLatLng = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                };
                initMapWithCenter(userLatLng);

                // Marqueur bleu = user
                new google.maps.Marker({
                    position: userLatLng,
                    map,
                    icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" },
                    title: "Ma position"
                });

                // On lance la Nearby Search avec pagination
                doNearbySearch(userLatLng);
            },
            (err) => {
                console.warn("Géolocalisation refusée ou indisponible :", err);
                initMapDefault();
            }
        );
    } else {
        console.warn("Géolocalisation non supportée par ce navigateur.");
        initMapDefault();
    }
}

function initMapWithCenter(centerLatLng) {
    map = new google.maps.Map(document.getElementById("map"), {
        center: centerLatLng,
        zoom: 14
    });
    directionsRenderer.setMap(map);
}

function initMapDefault() {
    const defaultLatLng = { lat: 48.8566, lng: 2.3522 }; // Paris
    initMapWithCenter(defaultLatLng);
}

/* === 2) Nearby Search avec pagination === */


function doNearbySearch(location) {
    allPharmacies = []; // on réinitialise

    const service = new google.maps.places.PlacesService(map);
    const request = {
        location: location,
        radius: 10000,      // 10 km par ex.
        type: ["pharmacy"]
    };

    service.nearbySearch(request, (results, status, pagination) => {
        handleNearbySearchCallback(results, status, pagination);
    });
}


function handleNearbySearchCallback(results, status, pagination) {
    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        // Fusionne les résultats
        allPharmacies = allPharmacies.concat(results);

        // Vérifie s’il y a une page suivante
        if (pagination && pagination.hasNextPage) {
            // On doit attendre ~2 secondes avant de nextPage, sinon INVALID_REQUEST
            setTimeout(() => {
                pagination.nextPage();
            }, 2000);
        } else {
            // Plus de pages => on a récupéré tous les résultats
            console.log("Nb total de pharmacies récupérées =", allPharmacies.length);

            // Trier d’abord : ouvertes (open_now) en premier
            allPharmacies.sort((a, b) => {
                const openA = isOpen(a) ? 1 : 0;
                const openB = isOpen(b) ? 1 : 0;
                return openB - openA; // descend
            });

            // Crée les marqueurs / infoWindows
            allPharmacies.forEach((place) => {
                createPharmacyMarker(place);
            });

            // Affiche la liste
            displayPharmacyList(allPharmacies);
        }
    } else {
        console.error("Nearby Search error or no results:", status);
    }
}

function isOpen(place) {
    return (
        place.opening_hours &&
        typeof place.opening_hours.open_now === "boolean" &&
        place.opening_hours.open_now
    );
}




function createPharmacyMarker(place) {
    if (!place.geometry || !place.geometry.location) return;

    const open = isOpen(place);
    const position = place.geometry.location;

    const marker = new google.maps.Marker({
        position,
        map,
        icon: { url: open ? iconDarkGreen : iconGreen },
        title: place.name || "Pharmacie sans nom"
    });

    const addr = place.vicinity || place.formatted_address || "Adresse inconnue";
    const name = place.name || "Pharmacie sans nom";
    const status = open ? "Ouvert" : "Fermé";

    // Ajout du second bouton "Voir sur Google Maps"
    const content = `
    <div style="font-size:14px;">
      <strong>${name}</strong><br/>
      <em>${addr}</em><br/>
      Statut : ${status}<br/><br/>
      
      <!-- Bouton 1 : Itinéraire -->
      <button class="blue-btn" onclick="computeRoute(${position.lat()}, ${position.lng()})">
        Itinéraire
      </button>

      <!-- Bouton 2 : Voir sur Google Maps -->
      <button class="blue-btn" style="margin-left:8px;"
        onclick="openInGoogleMaps(${position.lat()}, ${position.lng()})">
        Voir sur Google Maps
      </button>
    </div>
  `;
    const infoW = new google.maps.InfoWindow({ content });

    marker.addListener("click", () => {
        infoW.open(map, marker);
    });
}


function openInGoogleMaps(lat, lng) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, "_blank");
}



function displayPharmacyList(places) {
    const listDiv = document.getElementById("pharmacy-list");
    if (!listDiv) return;

    listDiv.innerHTML = "";

    places.forEach((p) => {
        const open = isOpen(p);
        const addr = p.vicinity || p.formatted_address || "Adresse inconnue";
        const name = p.name || "Pharmacie sans nom";
        const status = open ? "Ouvert" : "Fermé";
        const lat = p.geometry.location.lat();
        const lng = p.geometry.location.lng();

        const itemHtml = `
      <div class="pharmacy-item">
        <h3>${name}</h3>
        <p><strong>Adresse :</strong> ${addr}</p>
        <p><strong>Statut :</strong> ${status}</p>

        <!-- Bouton pour calculer l'itinéraire -->
        <button class="blue-btn" onclick="computeRoute(${lat}, ${lng})">Itinéraire</button>
        
        <!-- Bouton pour ouvrir Google Maps -->
        <button class="blue-btn" style="margin-left:8px;"
          onclick="openInGoogleMaps(${lat}, ${lng})">
          Google Maps
        </button>
      </div>
    `;
        listDiv.innerHTML += itemHtml;
    });
}


function computeRoute(destLat, destLng) {
    if (!userLatLng) {
        alert("Position utilisateur inconnue, impossible de calculer l'itinéraire.");
        return;
    }

    const modeSelect = document.getElementById("travelModeSelect");
    const selectedMode = modeSelect ? modeSelect.value : "DRIVING";

    const request = {
        origin: userLatLng,
        destination: { lat: destLat, lng: destLng },
        travelMode: selectedMode
    };

    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            showRouteDetails(result); // affichage horizontal des étapes
        } else {
            console.error("Erreur de Directions :", status);
            alert("Impossible de calculer l'itinéraire.");
        }
    });
}

/**
 * Montre les étapes sous forme de cartes horizontales dans #routeInfo
 */
function showRouteDetails(directionResult) {
    const routeDiv = document.getElementById("routeInfo");
    if (!routeDiv) return;

    const leg = directionResult.routes[0].legs[0];
    let html = "";

    // Résumé
    if (leg.distance && leg.duration) {
        html += `
      <div class="summary">
        <p><strong>Distance totale :</strong> ${leg.distance.text}</p>
        <p><strong>Durée totale :</strong> ${leg.duration.text}</p>
      </div>
    `;
    }

    // Liste horizontale
    html += `<ul class="steps-list">`;

    leg.steps.forEach((step, index) => {
        const stepNum = index + 1;
        const travelMode = step.travel_mode;
        const modeIcon = icons[travelMode] || icons.DRIVING;

        // Classes CSS
        let stepClass = "step other";
        if (travelMode === "WALKING")  stepClass = "step walking";
        if (travelMode === "TRANSIT")  stepClass = "step transit";

        // Titre
        let stepTitle = travelMode;
        if (travelMode === "WALKING")  stepTitle = "Marche";
        else if (travelMode === "TRANSIT") stepTitle = "Transports";

        // Détails
        let stepContent = "";
        if (travelMode === "TRANSIT" && step.transit) {
            const tr = step.transit;
            const vehicleType = tr.line?.vehicle?.type || "Transport";
            const lineName = tr.line?.short_name || tr.line?.name || "Ligne ?";
            const depStop = tr.departure_stop?.name || "Inconnu";
            const arrStop = tr.arrival_stop?.name || "Inconnu";
            const headsign = tr.headsign || "";

            stepContent = `
        <p>
          <strong>De :</strong> ${depStop}<br/>
          <strong>À :</strong> ${arrStop}<br/>
          <strong>Direction :</strong> ${headsign}<br/>
          <strong>Ligne :</strong> ${vehicleType} ${lineName}
        </p>
        <p>Distance : ${step.distance.text}<br/>
           Durée : ${step.duration.text}</p>
      `;
        } else {
            // Marche, voiture, vélo...
            stepContent = `
        <p>Distance : ${step.distance.text}<br/>
           Durée : ${step.duration.text}</p>
      `;
        }

        html += `
      <li class="${stepClass}">
        <div class="step-header">
          <span class="step-title">
            <img class="step-icon" src="${modeIcon}" alt="${travelMode}"/>
            Étape ${stepNum} : ${stepTitle}
          </span>
        </div>
        <div class="step-content">
          ${stepContent}
        </div>
      </li>
    `;
    });

    html += `</ul>`;
    routeDiv.innerHTML = html;
}

/* === 6) Effacer l’itinéraire === */
function clearRoute() {
    directionsRenderer.setDirections({ routes: [] });
    const routeDiv = document.getElementById("routeInfo");
    if (routeDiv) routeDiv.innerHTML = "";
}

/* === 7) Rideaux (carte + liste) === */
function toggleMap() {
    const curtain = document.getElementById("map-curtain");
    if (!curtain) return;

    if (!mapIsOpen) {
        // Ouvrir -> height fixée (ex: 520px)
        curtain.style.height = "520px";
        mapIsOpen = true;
    } else {
        // Fermer
        curtain.style.height = "0";
        mapIsOpen = false;
    }
}

function toggleList() {
    const curtain = document.getElementById("list-curtain");
    if (!curtain) return;

    if (!listIsOpen) {
        // Ouvrir -> par exemple 400px
        curtain.style.height = "400px";
        listIsOpen = true;
    } else {
        // Fermer
        curtain.style.height = "0";
        listIsOpen = false;
    }
}
