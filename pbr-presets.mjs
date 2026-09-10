export const presetCategories = {
metals: [
{ id: 'gold', name: 'Gold' },
{ id: 'goldRose', name: 'Rose Gold' },
{ id: 'silver', name: 'Silver' },
{ id: 'chrome', name: 'Chrome' },
{ id: 'copper', name: 'Copper' },
{ id: 'copperOxidized', name: 'Copper (Oxidized)' },
{ id: 'iron', name: 'Iron' },
{ id: 'ironRust', name: 'Iron (Rust)' },
{ id: 'aluminum', name: 'Aluminum' },
{ id: 'aluminumOxidized', name: 'Aluminum (Oxidized)' },
{ id: 'aluminumAnodized', name: 'Aluminum (Anodized)' },
{ id: 'titanium', name: 'Titanium' },
{ id: 'brushedMetal', name: 'Brushed Metal' },
{ id: 'brass', name: 'Brass' },
{ id: 'bronze', name: 'Bronze' }
],
nonmetals: [
{ id: 'plastic', name: 'Plastic (Red)' },
{ id: 'plasticWhite', name: 'Plastic (White)' },
{ id: 'plasticBlack', name: 'Plastic (Black)' },
{ id: 'rubber', name: 'Rubber' },
{ id: 'wood', name: 'Wood' },
{ id: 'woodPolished', name: 'Wood (Polished)' },
{ id: 'leather', name: 'Leather' },
{ id: 'ceramic', name: 'Ceramic' },
{ id: 'glass', name: 'Glass' },
{ id: 'fabric', name: 'Fabric' },
{ id: 'velvet', name: 'Velvet' },
{ id: 'skin', name: 'Skin' }
],
special: [
{ id: 'carPaint', name: 'Car Paint (Red)' },
{ id: 'carPaintBlue', name: 'Car Paint (Blue)' },
{ id: 'carPaintBlack', name: 'Car Paint (Black)' },
{ id: 'pearl', name: 'Pearl' },
{ id: 'iridescent', name: 'Iridescent' },
{ id: 'holographic', name: 'Holographic' },
{ id: 'soapBubble', name: 'Soap Bubble' },
{ id: 'oilSlick', name: 'Oil Slick' },
{ id: 'cdSurface', name: 'CD Surface' },
{ id: 'bismuth', name: 'Bismuth' },
{ id: 'silk', name: 'Silk' },
{ id: 'satin', name: 'Satin' }
]
};

// Presets definition
export const presets = {
// Metals
gold: {
color: '#ffd700', metallic: 1.0, roughness: 0.2, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
goldRose: {
color: '#e8b4b8', metallic: 1.0, roughness: 0.25, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
silver: {
color: '#c0c0c0', metallic: 1.0, roughness: 0.15, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
chrome: {
color: '#e0e0e0', metallic: 1.0, roughness: 0.05, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
copper: {
color: '#b87333', metallic: 1.0, roughness: 0.3, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
copperOxidized: {
color: '#4a8c7a', metallic: 0.7, roughness: 0.6, specular: 0.4,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
iron: {
color: '#4a4a4a', metallic: 1.0, roughness: 0.5, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
ironRust: {
color: '#8b4513', metallic: 0.3, roughness: 0.8, specular: 0.3,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
aluminum: {
color: '#d6d6d6', metallic: 1.0, roughness: 0.4, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
aluminumOxidized: {
color: '#a8a8a8', metallic: 0.8, roughness: 0.55, specular: 0.4,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
aluminumAnodized: {
color: '#4169e1', metallic: 0.9, roughness: 0.3, specular: 0.5,
clearcoat: 0.3, clearcoatRoughness: 0.1, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
titanium: {
color: '#878681', metallic: 1.0, roughness: 0.4, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
brushedMetal: {
color: '#b0b0b0', metallic: 1.0, roughness: 0.35, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
brass: {
color: '#b5a642', metallic: 1.0, roughness: 0.25, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
bronze: {
color: '#cd7f32', metallic: 1.0, roughness: 0.35, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},

// Non-metals
plastic: {
color: '#cc3333', metallic: 0, roughness: 0.3, specular: 0.5,
clearcoat: 0.5, clearcoatRoughness: 0.1, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
plasticWhite: {
color: '#f0f0f0', metallic: 0, roughness: 0.35, specular: 0.5,
clearcoat: 0.3, clearcoatRoughness: 0.1, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
plasticBlack: {
color: '#1a1a1a', metallic: 0, roughness: 0.25, specular: 0.5,
clearcoat: 0.6, clearcoatRoughness: 0.05, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
rubber: {
color: '#262626', metallic: 0, roughness: 0.9, specular: 0.5,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
wood: {
color: '#6b3310', metallic: 0, roughness: 0.7, specular: 0.5,
clearcoat: 0.1, clearcoatRoughness: 0.2, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
woodPolished: {
color: '#8b4513', metallic: 0, roughness: 0.3, specular: 0.5,
clearcoat: 0.8, clearcoatRoughness: 0.05, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
leather: {
color: '#3d2314', metallic: 0, roughness: 0.6, specular: 0.4,
clearcoat: 0.1, clearcoatRoughness: 0.3, sheen: 0.3, sheenRoughness: 0.8, iridescence: 0, iridescenceIOR: 1.3
},
ceramic: {
color: '#f5f5f5', metallic: 0, roughness: 0.1, specular: 0.6,
clearcoat: 0.8, clearcoatRoughness: 0.02, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
glass: {
color: '#e0f0ff', metallic: 0, roughness: 0.05, specular: 0.9,
clearcoat: 1.0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.5
},
fabric: {
color: '#6b7b8c', metallic: 0, roughness: 0.8, specular: 0.3,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0.5, sheenRoughness: 0.5, iridescence: 0, iridescenceIOR: 1.3
},
velvet: {
color: '#8b0000', metallic: 0, roughness: 0.9, specular: 0.2,
clearcoat: 0, clearcoatRoughness: 0, sheen: 1.0, sheenRoughness: 0.3, iridescence: 0, iridescenceIOR: 1.3
},
skin: {
color: '#e0ac69', metallic: 0, roughness: 0.5, specular: 0.4,
clearcoat: 0.1, clearcoatRoughness: 0.3, sheen: 0.2, sheenRoughness: 0.6, iridescence: 0, iridescenceIOR: 1.3
},

// Special effects
carPaint: {
color: '#cc0000', metallic: 0, roughness: 0.1, specular: 0.5,
clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
carPaintBlue: {
color: '#0044cc', metallic: 0, roughness: 0.1, specular: 0.5,
clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
carPaintBlack: {
color: '#0a0a0a', metallic: 0, roughness: 0.05, specular: 0.5,
clearcoat: 1.0, clearcoatRoughness: 0.02, sheen: 0, sheenRoughness: 1, iridescence: 0, iridescenceIOR: 1.3
},
pearl: {
color: '#f5e6d3', metallic: 0, roughness: 0.25, specular: 0.6,
clearcoat: 0.8, clearcoatRoughness: 0.1, sheen: 0.5, sheenRoughness: 0.5, iridescence: 0.5, iridescenceIOR: 1.5
},
iridescent: {
color: '#c0c0ff', metallic: 0.3, roughness: 0.2, specular: 0.5,
clearcoat: 0.5, clearcoatRoughness: 0.1, sheen: 0.3, sheenRoughness: 0.5, iridescence: 1.0, iridescenceIOR: 1.8
},
holographic: {
color: '#e0e0e0', metallic: 0.5, roughness: 0.1, specular: 0.7,
clearcoat: 1.0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 1.0, iridescenceIOR: 2.2
},
soapBubble: {
color: '#f0f8ff', metallic: 0, roughness: 0.02, specular: 0.9,
clearcoat: 1.0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 1.0, iridescenceIOR: 1.33
},
oilSlick: {
color: '#1a1a2e', metallic: 0.1, roughness: 0.05, specular: 0.7,
clearcoat: 1.0, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 1.0, iridescenceIOR: 1.5
},
cdSurface: {
color: '#c0c0c0', metallic: 0.8, roughness: 0.05, specular: 0.8,
clearcoat: 0.5, clearcoatRoughness: 0, sheen: 0, sheenRoughness: 1, iridescence: 1.0, iridescenceIOR: 2.0
},
bismuth: {
color: '#8b7d6b', metallic: 0.9, roughness: 0.2, specular: 0.6,
clearcoat: 0.3, clearcoatRoughness: 0.1, sheen: 0, sheenRoughness: 1, iridescence: 1.0, iridescenceIOR: 2.333
},
silk: {
color: '#f5deb3', metallic: 0, roughness: 0.4, specular: 0.4,
clearcoat: 0, clearcoatRoughness: 0, sheen: 0.8, sheenRoughness: 0.4, iridescence: 0.2, iridescenceIOR: 1.3
},
satin: {
color: '#b8b8d0', metallic: 0, roughness: 0.35, specular: 0.4,
clearcoat: 0.2, clearcoatRoughness: 0.15, sheen: 0.6, sheenRoughness: 0.5, iridescence: 0.1, iridescenceIOR: 1.3
}
};

