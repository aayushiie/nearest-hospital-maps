function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function findHospital(latitude, longitude, radius = 5000) {
    const query = `
        [out:json][timeout:15];
        (
        node["amenity"="hospital"](around:${radius},${latitude},${longitude});
        way["amenity"="hospital"](around:${radius},${latitude},${longitude});
        relation["amenity"="hospital"](around:${radius},${latitude},${longitude});

        node["healthcare"="hospital"](around:${radius},${latitude},${longitude});
        way["healthcare"="hospital"](around:${radius},${latitude},${longitude});
        relation["healthcare"="hospital"](around:${radius},${latitude},${longitude});
        );
        out center tags;
    `;

    try {
        const response = await fetch(
            // "https://overpass-api.de/api/interpreter", // external url
            // "/overpass-api/api/interpreter", // proxy url
            "https://openstreetmap.fr", // osm france public instance
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                    // "User-Agent": "EmergencyHospitalMaps/1.0 (https://emergency-hospital-maps.netlify.app)"
                },
                body: new URLSearchParams({ data: query })
            }
        );

        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Remove duplicates
        const uniqueHospitals = new Map();
        data.elements.forEach(element => {
            const lat = element.lat ?? element.center?.lat;
            const lon = element.lon ?? element.center?.lon;
            if (lat == null || lon == null)
                return;
            const key = `${element.tags?.name}-${lat.toFixed(5)}-${lon.toFixed(5)}`;

            if (!uniqueHospitals.has(key)) {
                uniqueHospitals.set(key, {
                    id: element.id,
                    name: element.tags?.name || "Unnamed Hospital",
                    latitude: lat,
                    longitude: lon,
                    emergency: element.tags?.emergency === "yes",
                    distance: calculateHaversine(
                        latitude,
                        longitude,
                        lat,
                        lon
                    )
                });
            }
        });

        const hospitals = [...uniqueHospitals.values()];

        // Emergency hospitals first, then nearest
        hospitals.sort((a, b) => {
            if (a.emergency !== b.emergency)
                return a.emergency ? -1 : 1;
            return a.distance - b.distance;
        });
        return hospitals.slice(0, 5);
    }
    catch (err) {
        console.error(err);
        return [];
    }

}

(async () => {
    const userLat = 6.5167; //lagos
    const userLon = 3.3850;
    // const userLat = 5.68951; //ghana
    // const userLon = -0.20914;

    const map = L.map("map").setView([userLat, userLon], 14);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors"
        }
    ).addTo(map);

    const icon = L.divIcon({

        className: "hospital-marker",
        html: "📍",
        iconSize: [40, 40]

    });

    L.marker([userLat, userLon], { icon })
        .addTo(map)
        .bindPopup("Current Location")
        .openPopup();

    const hospitals = await findHospital(userLat, userLon);

    console.log(hospitals);

    hospitals.forEach((hospital, index) => {

        const distance = (hospital.distance / 1000).toFixed(2);

        const googleQuery =
            `${hospital.name}`;

        const directionsUrl =
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}`;

        const emergencyText =
            hospital.emergency
                ? "Emergency Available"
                : "!Emergency status unknown";

        L.marker(
            [hospital.latitude, hospital.longitude],
            { icon }
        )
            .addTo(map)
            .bindPopup(`
                <div class="hospital-popup">
                    <b>#${index + 1} ${hospital.name}</b><br>
                    ${emergencyText}<br>
                    Distance: ${distance} km<br><br>

                    <a href="${directionsUrl}"
                       target="_blank"
                       rel="noopener noreferrer">
                       Directions
                    </a>
                </div>
            `);
    });
})();