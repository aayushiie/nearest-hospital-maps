import haversine from 'haversine-distance'

async function findHospital(latitude, longitude, radius = 5000) {
    const query = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radius},${latitude},${longitude});way["amenity"="hospital"](around:${radius},${latitude},${longitude});relation["amenity"="hospital"](around:${radius},${latitude},${longitude}););out center;`;

    try {
        const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "HospitalFinderApp/1.0" 
                },
                body: new URLSearchParams({ data: query })
            }
        )

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`)
        }

        const data = await response.json()

        const hospitals = data.elements
            .map(element => {
                const lat = element.lat ?? element.center?.lat
                const lon = element.lon ?? element.center?.lon

                if (lat == null || lon == null) return null;

                const a = { latitude: latitude, longitude: longitude }
                const b = { latitude: lat, longitude: lon }

                return {
                    id: element.id,
                    name: element.tags?.name || "Unnamed hospital",
                    latitude: lat,
                    longitude: lon,
                    distance: haversine(a, b)
                }
            })
            .filter(h => h !== null); 

        hospitals.sort((x, y) => x.distance - y.distance)

        return hospitals

    } catch (err) {
        console.error(err)
        return [];
    }
}

(async () => {
    const hospitals = await findHospital(6.465, 3.406, 5000);
    console.log(`Found ${hospitals.length} hospitals.`);

    if (hospitals.length > 0) {
        console.log("Nearest Hospital:")
        console.log(hospitals[0])
        console.log("All hospitals:")
        console.log(hospitals)
    }
})();
