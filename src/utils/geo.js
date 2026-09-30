/**
 * CivicConnect — Geo & GPS Distance Utilities
 */

/**
 * Calculates accurate geodesic distance between two coordinate pairs in meters using Haversine formula.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
      lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
    return null;
  }

  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) {
    return null;
  }

  const R = 6371e3; // Earth radius in meters
  const φ1 = nLat1 * Math.PI / 180;
  const φ2 = nLat2 * Math.PI / 180;
  const Δφ = (nLat2 - nLat1) * Math.PI / 180;
  const Δλ = (nLon2 - nLon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats distance in meters to a human-readable string (e.g., "120 m", "1.5 km").
 */
export function formatDistance(meters) {
  if (meters === null || meters === undefined || isNaN(meters)) {
    return null;
  }
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Requests device GPS position via HTML5 Geolocation API with timeout & accuracy options.
 */
export function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser or device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy || 0),
          timestamp: new Date().toISOString()
        });
      },
      (error) => {
        let msg = "Could not retrieve GPS location.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission was denied. Please allow location access in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "GPS signal is currently unavailable.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Location request timed out. Please retry.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  });
}

/**
 * Generates an intent / Google Maps directions URL for mobile or desktop.
 */
export function getDirectionsUrl(lat, lng, address = "") {
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return "https://www.google.com/maps";
}
