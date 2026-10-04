import * as THREE from 'three';

/**
 * Generate a high-contrast dark military satellite Earth texture
 * with continents, glowing coastlines, and urban city lights.
 */
export function createTacticalEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep Ocean Base
  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 0, width, height);

  // Helper to map lat (-90 to 90), lon (-180 to 180) to canvas (x, y)
  const mapPoint = (lat: number, lon: number): [number, number] => {
    const x = ((lon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  // 2. Simplified continent polygon approximations for crisp vector landmasses
  const LANDMASSES: [number, number][][] = [
    // North America
    [
      [70, -165], [72, -130], [68, -100], [60, -75], [50, -55], [45, -60],
      [30, -80], [25, -80], [20, -97], [15, -92], [9, -78], [15, -85],
      [22, -105], [32, -117], [38, -123], [48, -125], [60, -145], [65, -168]
    ],
    // South America
    [
      [12, -72], [10, -60], [-5, -35], [-15, -38], [-23, -43], [-35, -53],
      [-55, -68], [-50, -75], [-35, -72], [-18, -70], [-5, -80], [8, -77]
    ],
    // Europe
    [
      [71, 28], [60, 28], [55, 38], [45, 30], [40, 25], [36, -5],
      [43, -9], [48, -4], [54, 8], [58, 6], [62, 5], [70, 20]
    ],
    // United Kingdom & Ireland
    [
      [58, -3], [54, 0], [50, -1], [50, -5], [54, -3], [58, -6]
    ],
    // Africa
    [
      [37, 10], [32, 32], [28, 34], [12, 51], [2, 45], [-11, 40],
      [-25, 33], [-34, 18], [-34, 19], [-22, 14], [-5, 12], [4, 9],
      [5, -2], [15, -17], [28, -13], [35, -6]
    ],
    // Asia
    [
      [75, 40], [77, 105], [72, 140], [65, 170], [60, 162], [55, 130],
      [40, 120], [30, 122], [22, 114], [10, 106], [1, 104], [10, 100],
      [22, 90], [25, 80], [20, 70], [25, 60], [12, 45], [20, 40],
      [30, 48], [40, 50], [50, 60], [60, 70]
    ],
    // Australia
    [
      [-12, 132], [-15, 136], [-12, 142], [-22, 150], [-34, 151], [-38, 145],
      [-35, 135], [-32, 128], [-34, 115], [-22, 114], [-16, 124]
    ],
    // Japan
    [
      [45, 142], [42, 144], [35, 140], [33, 131], [35, 133], [40, 140]
    ],
    // Greenland
    [
      [83, -30], [80, -20], [70, -20], [60, -45], [65, -55], [76, -65], [82, -50]
    ],
    // Antarctica
    [
      [-65, -60], [-72, -10], [-68, 60], [-65, 100], [-66, 140], [-72, 170],
      [-78, -170], [-74, -100], [-64, -65]
    ]
  ];

  // Draw Landmass Polygons
  ctx.fillStyle = '#111726';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 6;

  LANDMASSES.forEach(polygon => {
    ctx.beginPath();
    polygon.forEach((pt, i) => {
      const [x, y] = mapPoint(pt[0], pt[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // 3. Glowing Urban City Lights (Night-Lights Clusters)
  ctx.shadowBlur = 4;
  ctx.shadowColor = '#fbbf24'; // Amber gold
  ctx.fillStyle = '#fde68a';

  const CITIES: [number, number, number][] = [
    // [lat, lon, size]
    // North America
    [40.7, -74.0, 3], [34.0, -118.2, 3], [41.8, -87.6, 2.5], [29.7, -95.3, 2.5],
    [37.7, -122.4, 2.5], [47.6, -122.3, 2], [25.7, -80.2, 2], [45.5, -73.5, 2],
    [19.4, -99.1, 3],
    // South America
    [-23.5, -46.6, 3], [-22.9, -43.1, 2.5], [-34.6, -58.3, 2.5], [-12.0, -77.0, 2],
    [4.7, -74.0, 2],
    // Europe
    [51.5, -0.1, 3.5], [48.8, 2.3, 3], [52.5, 13.4, 2.5], [41.9, 12.5, 2],
    [40.4, -3.7, 2.5], [55.7, 37.6, 3], [59.3, 18.0, 1.8], [41.0, 28.9, 2.5],
    // Asia & Middle East
    [35.6, 139.6, 4], [31.2, 121.4, 3.5], [39.9, 116.4, 3.5], [22.3, 114.1, 3],
    [1.3, 103.8, 3], [13.7, 100.5, 2.5], [28.6, 77.2, 3.5], [19.0, 72.8, 3],
    [25.2, 55.2, 2.5], [24.7, 46.6, 2], [32.0, 34.7, 2],
    // Australia
    [-33.8, 151.2, 2.5], [-37.8, 144.9, 2.5], [-27.4, 153.0, 1.8], [-31.9, 115.8, 1.8],
    // Africa
    [30.0, 31.2, 3], [-26.2, 28.0, 2.5], [-33.9, 18.4, 2], [6.5, 3.3, 2.5]
  ];

  CITIES.forEach(([lat, lon, r]) => {
    const [x, y] = mapPoint(lat, lon);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Secondary urban glow halo
    ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
  });

  // 4. Geodetic Coordinate Lines (Lat/Lon grid on the texture)
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = 1;

  for (let lat = -80; lat <= 80; lat += 20) {
    const [, y] = mapPoint(lat, 0);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let lon = -180; lon <= 180; lon += 30) {
    const [x] = mapPoint(0, lon);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 5. Equator Glow Line
  const [, eqY] = mapPoint(0, 0);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, eqY);
  ctx.lineTo(width, eqY);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
