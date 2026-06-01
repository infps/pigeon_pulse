import L from "leaflet";

// Teardrop pin as inline SVG — avoids leaflet's image-asset URL issues under the bundler.
function pinSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="38" viewBox="0 0 26 38">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 25 13 25s13-15.75 13-25C26 5.82 20.18 0 13 0z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="13" cy="13" r="5" fill="#fff"/>
  </svg>`;
}

export function pinIcon(fill: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: pinSvg(fill),
    iconSize: [26, 38],
    iconAnchor: [13, 38],
    popupAnchor: [0, -34],
  });
}

// Shared palette
export const BASE_ICON = () => pinIcon("#dc2626"); // event/base = red
export const ACTIVE_ICON = () => pinIcon("#16a34a"); // active station = green
export const INACTIVE_ICON = () => pinIcon("#9ca3af"); // inactive = gray
