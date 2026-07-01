function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

async function findHospital(latitude, longitude, radius = 5000) {
    const query = `[out:json][timeout:150];(node["amenity"="hospital"](around:${radius},${latitude},${longitude});way["amenity"="hospital"](around:${radius},${latitude},${longitude});relation["amenity"="hospital"](around:${radius},${latitude},${longitude}););out center;`;

    try {
        const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({ data: query })
            }
        );

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();

        const hospitals = data.elements
            .map(element => {
                const lat = element.lat ?? element.center?.lat;
                const lon = element.lon ?? element.center?.lon;

                if (lat == null || lon == null) return null;

                return {
                    id: element.id,
                    name: element.tags?.name || "Unnamed hospital",
                    latitude: lat,
                    longitude: lon,
                    distance: calculateHaversine(latitude, longitude, lat, lon)
                };
            })
            .filter(h => h !== null);

        hospitals.sort((x, y) => x.distance - y.distance);
        const nearestHospitals = hospitals.slice(0, 5);

        return nearestHospitals;

    } catch (err) {
        console.error("Error fetching data:", err);
        return [];
    }
}

(async () => {
    const userLat = 5.68951
    const userLon = -0.20914

    // mount leaflet map instance to dom
    const map = L.map('map').setView([userLat, userLon], 14);

    // add osm image layers to the map view
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // marker style
    const icon = L.divIcon({
        className: "hospital-marker",
        html: "📍",
        iconSize: [40, 40]
    });

    // marker: current location
    L.marker([userLat, userLon], { icon: icon })
        .addTo(map)
        .bindPopup("Current location")
        .openPopup();

    const topHospitals = await findHospital(userLat, userLon, 5000);
    console.log("Hospitals found:", topHospitals);


    topHospitals.forEach((hospital, index) => {
        const distanceInKm = (hospital.distance / 1000).toFixed(2);

        const directionsUrl = `https://www.google.com/maps/dir/${userLat},${userLon}/${hospital.latitude},${hospital.longitude}`;

        L.marker([hospital.latitude, hospital.longitude], { icon: icon })
            .addTo(map)
            .bindPopup(`
                <div class="hospital-popup">
                    <b>#${index + 1} ${hospital.name}</b><br>
                    Distance: ${distanceInKm} km
                    <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer">
                    Directions
                </a>
                </div>
            `);
    });
})();
