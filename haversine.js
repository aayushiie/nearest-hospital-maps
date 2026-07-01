import haversine from 'haversine-distance'

const a = { latitude: 37.8136, longitude: 144.9631 }
const b = { latitude: 33.8650, longitude: 151.2094 }

console.log(haversine(a, b))

