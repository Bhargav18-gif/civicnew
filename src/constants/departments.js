/**
 * CivicConnect — Canonical Department Definitions & Metadata
 * 
 * Provides rich metadata, theming, SLAs, and icons for all 8 municipal departments.
 */

export const DEPARTMENTS = {
  roads: {
    id: "roads",
    name: "Roads & Infrastructure",
    shortName: "Roads",
    tagline: "Pavement integrity, pothole repairs, street resurfacing, and pedestrian walkways",
    color: "amber",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gradientClass: "from-amber-500/20 to-orange-500/5",
    accentColor: "#f59e0b",
    iconName: "Car",
    slaHours: { CRITICAL: 12, HIGH: 24, MEDIUM: 48, LOW: 72 },
    categories: ["Potholes", "Damaged Asphalt", "Footpath Collapse", "Speed Bumps", "Road Dividers", "Cave-in"]
  },
  water: {
    id: "water",
    name: "Water Supply",
    shortName: "Water",
    tagline: "Municipal water distribution, pipe leaks, quality testing, and supply continuity",
    color: "cyan",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    gradientClass: "from-cyan-500/20 to-blue-500/5",
    accentColor: "#06b6d4",
    iconName: "Droplets",
    slaHours: { CRITICAL: 8, HIGH: 18, MEDIUM: 36, LOW: 60 },
    categories: ["Main Pipeline Burst", "Low Pressure", "Contaminated Water", "Meter Leak", "Valve Failure"]
  },
  electricity: {
    id: "electricity",
    name: "Electricity & Lighting",
    shortName: "Electricity",
    tagline: "Grid stability, streetlight repair, transformer maintenance, and live wire hazards",
    color: "yellow",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    gradientClass: "from-yellow-500/20 to-amber-500/5",
    accentColor: "#eab308",
    iconName: "Zap",
    slaHours: { CRITICAL: 6, HIGH: 12, MEDIUM: 24, LOW: 48 },
    categories: ["Live Wire Hazard", "Streetlight Outage", "Transformer Sparking", "Power Blackout", "Pole Leaning"]
  },
  garbage: {
    id: "garbage",
    name: "Sanitation & Waste",
    shortName: "Sanitation",
    tagline: "Solid waste collection, illegal dumping removal, community bin clearance, and recycling",
    color: "emerald",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    gradientClass: "from-emerald-500/20 to-teal-500/5",
    accentColor: "#10b981",
    iconName: "Trash2",
    slaHours: { CRITICAL: 10, HIGH: 20, MEDIUM: 36, LOW: 72 },
    categories: ["Garbage Overflow", "Missed Doorstep Pickup", "Illegal Dumping", "Dead Animal Removal", "Littering"]
  },
  drainage: {
    id: "drainage",
    name: "Drainage & Sewage",
    shortName: "Drainage",
    tagline: "Sewage unblocking, storm drain maintenance, rainwater desilting, and manhole security",
    color: "teal",
    badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    gradientClass: "from-teal-500/20 to-cyan-500/5",
    accentColor: "#14b8a6",
    iconName: "Waves",
    slaHours: { CRITICAL: 8, HIGH: 18, MEDIUM: 36, LOW: 60 },
    categories: ["Open Manhole", "Blocked Storm Drain", "Sewage Overflow", "Stagnant Water", "Desilting Required"]
  },
  health: {
    id: "health",
    name: "Public Health",
    shortName: "Health",
    tagline: "Disease vector control, fogging operations, hygiene audits, and public health risks",
    color: "rose",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    gradientClass: "from-rose-500/20 to-pink-500/5",
    accentColor: "#f43f5e",
    iconName: "HeartPulse",
    slaHours: { CRITICAL: 12, HIGH: 24, MEDIUM: 48, LOW: 72 },
    categories: ["Mosquito Breeding Zone", "Stray Animal Aggression", "Food Stall Sanitation", "Chemical Spills"]
  },
  transport: {
    id: "transport",
    name: "Transport & Traffic",
    shortName: "Transport",
    tagline: "Traffic signals, road signage, public bus shelters, zebra crossings, and congestion points",
    color: "indigo",
    badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    gradientClass: "from-indigo-500/20 to-blue-500/5",
    accentColor: "#6366f1",
    iconName: "Bus",
    slaHours: { CRITICAL: 8, HIGH: 16, MEDIUM: 36, LOW: 60 },
    categories: ["Signal Failure", "Damaged Bus Stop", "Missing Stop Sign", "Traffic Choke Point", "Faded Zebra Crossing"]
  },
  public_safety: {
    id: "public_safety",
    name: "Public Safety",
    shortName: "Public Safety",
    tagline: "Encroachment clearance, dark corridor illumination, structural safety, and emergency response",
    color: "purple",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    gradientClass: "from-purple-500/20 to-violet-500/5",
    accentColor: "#a855f7",
    iconName: "ShieldAlert",
    slaHours: { CRITICAL: 4, HIGH: 12, MEDIUM: 24, LOW: 48 },
    categories: ["Footpath Encroachment", "Dark Unlit Corridor", "Unsafe Dilapidated Structure", "Illegal Hoarding"]
  }
};

export const DEPARTMENT_LIST = Object.values(DEPARTMENTS);

export function getDepartmentInfo(deptId) {
  if (!deptId) return DEPARTMENTS.roads;
  const key = String(deptId).toLowerCase().trim();
  return DEPARTMENTS[key] || {
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
    shortName: key.charAt(0).toUpperCase() + key.slice(1),
    tagline: "Municipal Operations Division",
    color: "cyan",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    gradientClass: "from-cyan-500/20 to-blue-500/5",
    accentColor: "#06b6d4",
    iconName: "Building2",
    slaHours: { CRITICAL: 12, HIGH: 24, MEDIUM: 48, LOW: 72 },
    categories: ["General Maintenance", "Inspection Required"]
  };
}
