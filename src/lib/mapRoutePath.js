/** Extract lat/lng path from Google DirectionsResult for custom polylines. */
export function getDirectionsPath(directions) {
  if (!directions?.routes?.[0]) return [];
  const route = directions.routes[0];
  if (route.overview_path?.length) {
    return route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
  }
  const path = [];
  route.legs?.forEach(leg => {
    leg.steps?.forEach(step => {
      step.path?.forEach(p => path.push({ lat: p.lat(), lng: p.lng() }));
    });
  });
  return path;
}
