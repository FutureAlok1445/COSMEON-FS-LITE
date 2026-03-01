import * as THREE from 'three';

/**
 * Converts geographic coordinates (lat, lng, alt) to Cartesian 3D coordinates.
 * @param {number} lat - Latitude in degrees.
 * @param {number} lng - Longitude in degrees.
 * @param {number} alt - Altitude in km.
 * @param {number} earthRadius - Normalized radius of Earth in three-js units (default: 1).
 * @returns {THREE.Vector3}
 */
export function geoToCartesian(lat, lng, alt, earthRadius = 2.5) {
    // We use 2.5 as a base radius to make the globe look substantial in the scene
    const R = earthRadius + (alt / 6371) * earthRadius;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    return new THREE.Vector3(
        -R * Math.sin(phi) * Math.cos(theta),
        R * Math.cos(phi),
        R * Math.sin(phi) * Math.sin(theta)
    );
}
