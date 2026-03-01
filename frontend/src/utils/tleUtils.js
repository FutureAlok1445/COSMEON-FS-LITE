import * as satellite from 'satellite.js';

/**
 * Propagates a TLE to a specific date/time.
 * @param {string} line1 
 * @param {string} line2 
 * @param {Date} date 
 * @returns {object|null}
 */
export function propagateTLE(line1, line2, date = new Date()) {
    try {
        const satrec = satellite.twoline2satrec(line1, line2);
        const positionAndVelocity = satellite.propagate(satrec, date);
        const gmst = satellite.gstime(date);

        if (positionAndVelocity && positionAndVelocity.position && positionAndVelocity.velocity) {
            const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

            const longitude = satellite.degreesLong(positionGd.longitude);
            const latitude = satellite.degreesLat(positionGd.latitude);
            const height = positionGd.height;

            // Calculate velocity magnitude (km/s)
            const v = positionAndVelocity.velocity;
            const velocity = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

            // Double check for NaN before returning
            if (isNaN(latitude) || isNaN(longitude) || isNaN(height) || isNaN(velocity)) {
                return null;
            }

            return {
                lat: latitude,
                lng: longitude,
                alt: height,
                vel: velocity,
                time: date
            };
        }
    } catch (error) {
        console.error("TLE Propagation Error:", error);
    }
    return null;
}

/**
 * Computes the full orbit path (points) for a satellite.
 * @param {string} line1 
 * @param {string} line2 
 * @param {number} points - Number of points to calculate (default 180).
 * @param {number} intervalMinutes - Interval between points (default 1 min).
 * @returns {Array}
 */
export function getOrbitPath(line1, line2, points = 180, intervalMinutes = 0.5) {
    const path = [];
    const now = new Date();

    // Start from 45 min ago to 45 min in the future for a 90 min orbit visualization
    const startTime = new Date(now.getTime() - (points / 2) * intervalMinutes * 60 * 1000);

    for (let i = 0; i < points; i++) {
        const time = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
        const pos = propagateTLE(line1, line2, time);
        if (pos) {
            path.push(pos);
        }
    }

    return path;
}
