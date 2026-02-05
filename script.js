let map = L.map('map').setView([20.5937, 78.9629], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const userIcon = L.icon({
  iconUrl: 'assets/user.png',
  iconSize: [30, 30]
});
const driverIcon = L.icon({
  iconUrl: 'assets/driver.png',
  iconSize: [30, 30]
});

let userMarker = null;
let destinationMarker = null;
let driverMarkers = [];
let driverToUserLine = null;
let userToDestLine = null;
let clickStep = 0;

let graphData = { nodes: {}, graph: {} };
const TRAVEL_SPEED_MPS = 11.11; // Approximately 40 km/h in meters per second

// Load graph data on startup
async function init() {
    graphData = await loadGraphData();
    console.log("Graph and nodes loaded for Dijkstra.");
}
init();

// 📍 Map click to set user & destination
map.on('click', function(e) {
  if (clickStep === 0) {
    setUserLocation(e.latlng);
    clickStep = 1;
  } else if (clickStep === 1) {
    setDestination(e.latlng);
    clickStep = 0;
  }
});

function useMyLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const latlng = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      map.setView(latlng, 15);
      setUserLocation(latlng);
    });
  } else {
    alert("Geolocation not supported");
  }
}

function setUserLocation(latlng) {
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker(latlng, { icon: userIcon }).addTo(map).bindPopup("User Location").openPopup();
  generateDrivers(latlng);
}

function setDestination(latlng) {
  if (destinationMarker) map.removeLayer(destinationMarker);
  destinationMarker = L.marker(latlng, { icon: userIcon }).addTo(map).bindPopup("Destination").openPopup();

  if (userMarker) {
    findNearestDriverAndDrawRoutes();
  }
}

function generateDrivers(userLatlng) {
  driverMarkers.forEach(marker => map.removeLayer(marker));
  driverMarkers = [];

  for (let i = 0; i < 5; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.01;
    const offsetLng = (Math.random() - 0.5) * 0.01;
    const driverLatlng = {
      lat: userLatlng.lat + offsetLat,
      lng: userLatlng.lng + offsetLng
    };
    const marker = L.marker(driverLatlng, { icon: driverIcon }).addTo(map).bindPopup(`Driver ${i + 1}`);
    driverMarkers.push(marker);
  }
}

async function findNearestDriverAndDrawRoutes() {
  if (!userMarker || !destinationMarker || driverMarkers.length === 0) return;

  const userLatLng = userMarker.getLatLng();
  const destLatLng = destinationMarker.getLatLng();
  const { nodes, graph } = graphData;

  // Find nearest graph nodes for user and destination
  const userNodeId = findNearestNode(userLatLng.lat, userLatLng.lng, nodes);
  const destNodeId = findNearestNode(destLatLng.lat, destLatLng.lng, nodes);

  if (!userNodeId || !destNodeId) {
      alert("Could not find nearest graph nodes for user or destination. Try a different location.");
      return;
  }

  let nearestDriver = null;
  let minDistance = Infinity; // Distance in meters from driver to user along the road network
  let driverToUserPath = null;
  let driverToUserTravelTime = 0;

  for (const marker of driverMarkers) {
    const driverLatLng = marker.getLatLng();
    const driverNodeId = findNearestNode(driverLatLng.lat, driverLatLng.lng, nodes);

    if (driverNodeId) {
        const path = dijkstra(graph, driverNodeId, userNodeId);
        if (path && path.length > 1) {
            let pathDistance = calculatePathDistance(path, nodes, graph);
            if (pathDistance < minDistance) {
                minDistance = pathDistance;
                nearestDriver = marker;
                driverToUserPath = path;
                driverToUserTravelTime = pathDistance / TRAVEL_SPEED_MPS; // in seconds
            }
        }
    }
  }

  if (nearestDriver && driverToUserPath) {
    // Reset all driver icons
    driverMarkers.forEach(marker => {
        marker.setIcon(L.icon({ iconUrl: 'assets/driver.png', iconSize: [30, 30] }));
    });

    nearestDriver.setIcon(
      L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',
        iconSize: [35, 35]
      })
    );
    nearestDriver.bindPopup("Driver Assigned!").openPopup();

    if (driverToUserLine) map.removeLayer(driverToUserLine);
    driverToUserLine = drawPathOnMap(driverToUserPath, nodes, 'orange'); // driver to user

    const userToDestPath = dijkstra(graph, userNodeId, destNodeId);
    let userToDestTravelTime = 0;
    if (userToDestPath && userToDestPath.length > 1) {
        if (userToDestLine) map.removeLayer(userToDestLine);
        userToDestLine = drawPathOnMap(userToDestPath, nodes, 'green');   // user to destination
        userToDestTravelTime = calculatePathDistance(userToDestPath, nodes, graph) / TRAVEL_SPEED_MPS;
    } else {
        alert("Could not find a route from user to destination.");
        if (userToDestLine) map.removeLayer(userToDestLine);
        userToDestLine = null;
    }

    const totalTimeMin = ((driverToUserTravelTime + userToDestTravelTime) / 60).toFixed(1);
    alert(`🚖 Driver will reach you in ${(driverToUserTravelTime / 60).toFixed(1)} mins.\n🛣 Total travel time to destination: ${totalTimeMin} mins.`);
  } else {
      alert("No driver could be assigned or no valid route found.");
  }
}

// 🧭 Draw route using the calculated path and return polyline
function drawPathOnMap(path, nodes, color = 'blue') {
  if (!path || path.length < 2) return null;

  const latlngs = path.map(id => {
    const [lat, lon] = nodes[id];
    return [lat, lon];
  });

  const polyline = L.polyline(latlngs, { color: color, weight: 4 }).addTo(map);
  map.fitBounds(polyline.getBounds());
  return polyline;
}

// Calculate the total distance of a path in meters
function calculatePathDistance(path, nodes, graph) {
    let totalDistance = 0;
    if (!path || path.length < 2) return 0;

    for (let i = 0; i < path.length - 1; i++) {
        const currentNodeId = path[i];
        const nextNodeId = path[i + 1];

        const neighbors = graph[currentNodeId];
        if (neighbors) {
            for (const [neighborId, cost] of neighbors) {
                if (neighborId === nextNodeId) {
                    totalDistance += cost;
                    break;
                }
            }
        }
    }
    return totalDistance;
}

// Haversine distance for finding nearest node (approximation for initial node selection)
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres
    return d;
}

// Function to find the nearest node in the graph
function findNearestNode(lat, lon, nodes) {
  let nearestId = null;
  let minDist = Infinity;

  for (const [id, [nLat, nLon]] of Object.entries(nodes)) {
    const dist = haversineDistance(lat, lon, nLat, nLon);
    if (dist < minDist) {
      minDist = dist;
      nearestId = id;
    }
  }
  return nearestId;
}