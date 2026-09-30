import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, Compass, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { calculateDistanceMeters, formatDistance, getDeviceLocation, getDirectionsUrl } from "../../utils/geo.js";

// Fix Leaflet's default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Red marker for Complaint Location
const complaintIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom Blue marker for Engineer Location
const engineerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function ComplaintLocationMap({
  latitude,
  longitude,
  address,
  complaintTitle,
  referenceId,
  onConfirmArrival,
  currentGps,
  setCurrentGps
}) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [distance, setDistance] = useState(null);

  const hasCoords = Boolean(latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude)));
  const compLat = Number(latitude);
  const compLng = Number(longitude);

  // Recalculate distance whenever GPS or complaint coords change
  useEffect(() => {
    if (currentGps && hasCoords) {
      const dist = calculateDistanceMeters(currentGps.latitude, currentGps.longitude, compLat, compLng);
      setDistance(dist);
    }
  }, [currentGps, hasCoords, compLat, compLng]);

  // Handle GPS location fetch / arrival confirmation
  async function handleGetLocation() {
    setGpsLoading(true);
    setGpsError("");
    try {
      const loc = await getDeviceLocation();
      setCurrentGps?.(loc);
      if (hasCoords) {
        const dist = calculateDistanceMeters(loc.latitude, loc.longitude, compLat, compLng);
        setDistance(dist);
        onConfirmArrival?.(loc, dist);
      } else {
        onConfirmArrival?.(loc, null);
      }
    } catch (err) {
      console.warn("GPS request error:", err.message);
      setGpsError(err.message || "Failed to retrieve GPS position.");
    } finally {
      setGpsLoading(false);
    }
  }

  const directionsUrl = getDirectionsUrl(hasCoords ? compLat : null, hasCoords ? compLng : null, address);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin size={14} className="text-teal-400" />
          <span>Section C — Location / GPS & Navigation</span>
        </label>

        {hasCoords && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Navigation size={13} />
            <span>GET DIRECTIONS</span>
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Address & GPS Metadata Box */}
      <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Reported Address</span>
          <p className="text-sm font-medium text-white">{address || "Location specified via GPS coordinates"}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-white/5 text-xs font-mono">
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Latitude</span>
            <span className="text-slate-200">{hasCoords ? compLat.toFixed(5) : "Unavailable"}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Longitude</span>
            <span className="text-slate-200">{hasCoords ? compLng.toFixed(5) : "Unavailable"}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Distance from Site</span>
            <span className="text-teal-300 font-bold">
              {distance !== null ? formatDistance(distance) : "Not Measured"}
            </span>
          </div>
        </div>

        {/* GPS Confirmation Status & Arrival Action */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5 flex-wrap">
          <div className="flex items-center gap-2">
            {currentGps ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 size={15} />
                <span>GPS Location Captured (±{currentGps.accuracy}m)</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Compass size={14} className="text-slate-400" />
                <span>Field arrival not yet GPS-confirmed</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={gpsLoading}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={gpsLoading ? "animate-spin text-teal-400" : ""} />
            <span>{currentGps ? "Refresh GPS Position" : "Confirm GPS Arrival"}</span>
          </button>
        </div>

        {gpsError && (
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-1.5">
            <AlertCircle size={13} className="shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}
      </div>

      {/* Interactive Leaflet Map */}
      {hasCoords ? (
        <div className="h-64 sm:h-72 rounded-2xl overflow-hidden border border-white/10 relative z-0 shadow-lg">
          <MapContainer
            center={[compLat, compLng]}
            zoom={15}
            scrollWheelZoom={false}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Complaint Location Marker */}
            <Marker position={[compLat, compLng]} icon={complaintIcon}>
              <Popup>
                <div className="text-xs">
                  <strong className="text-slate-900 block font-bold">{referenceId || "Complaint Site"}</strong>
                  <p className="text-slate-700">{complaintTitle || address}</p>
                </div>
              </Popup>
            </Marker>

            {/* Engineer Location Marker if available */}
            {currentGps && (
              <>
                <Marker position={[currentGps.latitude, currentGps.longitude]} icon={engineerIcon}>
                  <Popup>
                    <div className="text-xs font-medium text-slate-800">
                      <strong>Your Current Location</strong>
                      <p>Accuracy: ±{currentGps.accuracy}m</p>
                    </div>
                  </Popup>
                </Marker>
                {currentGps.accuracy && (
                  <Circle
                    center={[currentGps.latitude, currentGps.longitude]}
                    radius={currentGps.accuracy}
                    pathOptions={{ fillColor: '#0ea5e9', color: '#0284c7', fillOpacity: 0.2 }}
                  />
                )}
              </>
            )}
          </MapContainer>
        </div>
      ) : (
        <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center bg-black/20 text-slate-400 space-y-1">
          <MapPin size={24} className="mx-auto text-slate-600 mb-1" />
          <p className="text-xs font-semibold text-slate-300">Location coordinates unavailable</p>
          <p className="text-[11px] text-slate-500">Please navigate using the reported street address above.</p>
        </div>
      )}
    </div>
  );
}
