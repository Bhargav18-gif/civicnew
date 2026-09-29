/**
 * Real Duplicate Detection Service (Supabase edition)
 * Evaluates candidates based on:
 * 1. Category match
 * 2. Geo-spatial Haversine distance (configured radius, e.g. 500 meters)
 * 3. Temporal window (e.g. within last 14 days)
 * 4. Lexical token overlap (Jaccard similarity on non-stopword tokens)
 *
 * Uses Supabase PostgreSQL via db.js instead of Firestore.
 */

'use strict';

const { findNearbyComplaints } = require('./db');

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateTextSimilarity(text1 = '', text2 = '') {
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'for', 'to', 'near', 'by']);
  const tokenize = str => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }
  const union = new Set([...tokens1, ...tokens2]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find a near-duplicate complaint using Supabase.
 * The `_db` parameter is kept for backward-compatibility but is ignored.
 */
async function findDuplicateCandidate(_db, {
  category,
  description = '',
  lat = null,
  lng = null,
  radiusKm = 0.5,
  maxDays = 14,
  duplicateThreshold = 0.75
}) {
  try {
    // Query Supabase for nearby complaints in the same category
    const candidates = await findNearbyComplaints({ category, latitude: lat, longitude: lng, radiusKm });

    if (!candidates || candidates.length === 0) {
      return { isDuplicate: false, duplicateScore: 0, matchedComplaintId: null, reason: null };
    }

    // Filter by time window
    const cutoffDate = new Date(Date.now() - maxDays * 24 * 3600 * 1000);
    const recentCandidates = candidates.filter(c => new Date(c.created_at) >= cutoffDate);

    let bestMatch = null;
    let highestScore = 0;

    for (const candidate of recentCandidates) {
      const otherDesc = candidate.description || '';
      const distance = calculateHaversineDistanceKm(lat, lng, candidate.latitude, candidate.longitude);
      const isNearby = distance <= radiusKm;
      const textSim = calculateTextSimilarity(description, otherDesc);

      let score = textSim;
      if (lat != null && candidate.latitude != null) {
        const geoFactor = isNearby ? Math.max(0, 1 - (distance / radiusKm)) : 0;
        score = (textSim * 0.6) + (geoFactor * 0.4);
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = {
          id:             candidate.id,
          referenceId:    candidate.reference_id,
          distanceKm:     distance === Infinity ? null : distance,
          textSimilarity: textSim,
          score
        };
      }
    }

    if (highestScore >= duplicateThreshold && bestMatch) {
      return {
        isDuplicate:        true,
        duplicateScore:     Number(highestScore.toFixed(3)),
        matchedComplaintId: bestMatch.referenceId,
        reason:             `Matched ${Math.round(highestScore * 100)}% similarity with active complaint ${bestMatch.referenceId}${bestMatch.distanceKm != null ? ` within ${Math.round(bestMatch.distanceKm * 1000)}m` : ''}.`
      };
    }

    return {
      isDuplicate:        false,
      duplicateScore:     Number(highestScore.toFixed(3)),
      matchedComplaintId: bestMatch?.referenceId || null,
      reason:             'No duplicate candidate met configured threshold.'
    };
  } catch (err) {
    console.warn('[DUPLICATE DETECTION]', err.message);
    return { isDuplicate: false, duplicateScore: 0, matchedComplaintId: null, reason: null };
  }
}

module.exports = {
  findDuplicateCandidate,
  calculateHaversineDistanceKm,
  calculateTextSimilarity
};
