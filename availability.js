// ═══════════════════════════════════════════════════════════════════════════════
// STAP Availability Component - Media Inventory & Availability Charting
// External module for LA STAP Operations Portal
// Must load AFTER icon.js (depends on window.STAP_Icon)
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;
    
    // Get Icon from global export
    const Icon = window.STAP_Icon || (({ name }) => React.createElement('span', { title: name }, '?'));

    const AvailabilityComponent = ({ allData }) => {
        // Get LA_ZIP_DATA lazily inside component (ensures impressionsDashboard.js is loaded)
        const LA_ZIP_DATA = window.STAPImpressions?.LA_ZIP_DATA || {};

        // Helper to ensure we have a valid Date object (handles localStorage string serialization)
        const ensureDate = (dateValue) => {
            if (!dateValue) return null;
            if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? null : dateValue;
            // It's a string, parse it
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        };
        
        // --- MARKET & MEDIA INVENTORY PRESETS (Editable by chartist) ---
        const DEFAULT_INVENTORY = {
            'Los Angeles - STAP': { 'Transit Shelter-Digital Panel-Spot': 500, 'Transit Shelter-Digital Network-Spot': 400, 'Transit Shelters-Panel-Targeted': 2000, 'Transit Shelters-Panel-Network': 1500, 'Transit Shelters-Panel-Icon': 800, 'Transit Shelters-Domination': 200, 'Transit Shelter-Digital Panel-Spot-Playlist A': 100, 'Other': 1000 },
            'Los Angeles, CA': { 'Transit Buses-King': 150, 'Transit Buses-Kong': 80, 'Transit Buses-Full Side': 120, 'Transit Buses-Full Back': 120, 'Transit Buses-Full Wrap': 40, 'Transit Buses-Tailight Display': 100, 'Digital Billboards': 25, 'Other': 200 },
            'Dallas, TX': { 'Transit Buses-King': 100, 'Transit Buses-Kong': 50, 'Transit Buses-Full Side': 80, 'Transit Buses-Full Back': 80, 'Transit Buses-Full Wrap': 30, 'Other': 150 },
            'Miami, FL': { 'Transit Buses-King': 80, 'Transit Buses-Kong': 40, 'Transit Buses-Full Side': 60, 'Other': 120 },
            'Chicago, IL': { 'Transit Buses-King': 90, 'Transit Buses-Kong': 45, 'Transit Buses-Full Side': 70, 'Other': 130 },
            'Boston, MA': { 'Transit Buses-King': 60, 'Transit Buses-Kong': 30, 'Other': 100 },
            'Other Markets': { 'All Media': 500 }
        };

        // Market coordinates for map
        const MARKET_COORDS = {
            'Los Angeles, CA': [34.05, -118.24],
            'Dallas, TX': [32.78, -96.80],
            'Miami, FL': [25.76, -80.19],
            'Chicago, IL': [41.88, -87.63],
            'Boston, MA': [42.36, -71.06],
            'New York, NY': [40.71, -74.01],
            'Seattle, WA': [47.61, -122.33],
            'San Francisco, CA': [37.77, -122.42],
            'Orlando, FL': [28.54, -81.38],
            'Las Vegas, NV': [36.17, -115.14],
            'Baltimore, MD': [39.29, -76.61],
            'Philadelphia, PA': [39.95, -75.17],
            'Washington D.C., DC': [38.91, -77.04],
            'Phoenix, AZ': [33.45, -112.07],
            'Denver, CO': [39.74, -104.99],
            'Atlanta, GA': [33.75, -84.39],
            'Houston, TX': [29.76, -95.37],
            'San Diego, CA': [32.72, -117.16],
            'Minneapolis, MN': [44.98, -93.27],
            'Detroit, MI': [42.33, -83.05],
            'Portland, OR': [45.52, -122.68],
            'Charlotte, NC': [35.23, -80.84],
            'Tampa, FL': [27.95, -82.46],
            'Austin, TX': [30.27, -97.74],
            'Nashville, TN': [36.16, -86.78],
            'Broward County, FL': [26.12, -80.14],
            'Orange County, CA': [33.72, -117.83],
            'Howard County, MD': [39.25, -76.93],
            'Lakeland, FL': [28.04, -81.95],
            'Santa Monica, CA': [34.02, -118.49]
        };

        // --- STATE ---
        const [rangeStart, setRangeStart] = useState(() => {
            const d = new Date();
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
            const monday = new Date(d.setDate(diff));
            return monday.toISOString().split('T')[0];
        });
        const [rangeEnd, setRangeEnd] = useState(() => {
            const d = new Date();
            d.setDate(d.getDate() + 90); 
            return d.toISOString().split('T')[0];
        });
        
        const [selectedMarket, setSelectedMarket] = useState('ALL');
        const [selectedMedia, setSelectedMedia] = useState('ALL');
        const [selectedZip, setSelectedZip] = useState(''); // NEW: ZIP code filter
        const [inventoryOverride, setInventoryOverride] = useState(null); // Manual override
        const [requiredSize, setRequiredSize] = useState(50);
        const [includeHolds, setIncludeHolds] = useState(true);
        const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly', or 'yearly'
        const [chartView, setChartView] = useState('timeline'); // 'timeline', 'map', or 'geopath'
        const [sortByImpressions, setSortByImpressions] = useState(false); // NEW: Sort openings by impressions
        
        // --- IMPRESSIONS ESTIMATION HELPER ---
        // Maps product types to estimated weekly impressions per unit
        const getProductImpressions = (productType) => {
            if (!productType) return { weekly: 5000, multiplier: 1.0 };
            const prodLower = productType.toLowerCase();
            
            // Digital products - highest impressions due to rotation
            if (prodLower.includes('digital')) {
                if (prodLower.includes('spectacular') || prodLower.includes('domination')) {
                    return { weekly: 85000, multiplier: 2.8, tier: 'Premium Digital' };
                }
                if (prodLower.includes('billboard')) {
                    return { weekly: 65000, multiplier: 2.5, tier: 'Digital Billboard' };
                }
                return { weekly: 45000, multiplier: 2.0, tier: 'Digital' };
            }
            
            // Transit - varies by placement
            if (prodLower.includes('transit') || prodLower.includes('bus')) {
                if (prodLower.includes('full wrap')) {
                    return { weekly: 55000, multiplier: 1.8, tier: 'Transit Premium' };
                }
                if (prodLower.includes('king') || prodLower.includes('kong')) {
                    return { weekly: 35000, multiplier: 1.4, tier: 'Transit Large' };
                }
                if (prodLower.includes('shelter')) {
                    return { weekly: 18000, multiplier: 0.65, tier: 'Transit Shelter' };
                }
                return { weekly: 25000, multiplier: 1.0, tier: 'Transit' };
            }
            
            // Wallscapes & Large Format
            if (prodLower.includes('wallscape') || prodLower.includes('mural')) {
                return { weekly: 70000, multiplier: 1.8, tier: 'Wallscape' };
            }
            
            // Bulletins & Posters
            if (prodLower.includes('bulletin') || prodLower.includes('spectacular')) {
                return { weekly: 50000, multiplier: 1.5, tier: 'Bulletin' };
            }
            if (prodLower.includes('poster') || prodLower.includes('panel')) {
                if (prodLower.includes('targeted') || prodLower.includes('premier')) {
                    return { weekly: 32000, multiplier: 1.15, tier: 'Panel Targeted' };
                }
                return { weekly: 25000, multiplier: 0.95, tier: 'Panel/Poster' };
            }
            
            // Street furniture
            if (prodLower.includes('bench') || prodLower.includes('kiosk') || prodLower.includes('furniture')) {
                return { weekly: 12000, multiplier: 0.55, tier: 'Street Furniture' };
            }
            
            // Default
            return { weekly: 20000, multiplier: 1.0, tier: 'Standard' };
        };
        
        // Map ref for Leaflet
        const mapContainerRef = useRef(null);
        const mapInstanceRef = useRef(null);
        
        // Popup state for campaign details (click to open, click outside to close)
        const [expandedRowId, setExpandedRowId] = useState(null);
        const [isFullscreen, setIsFullscreen] = useState(false);
        const [showInventoryReminder, setShowInventoryReminder] = useState(true);

        // Show inventory reminder on component mount
        useEffect(() => {
            const timer = setTimeout(() => {
                setShowInventoryReminder(false);
            }, 8000); // Auto-dismiss after 8 seconds
            return () => clearTimeout(timer);
        }, []);

        // Handle escape key to exit fullscreen
        useEffect(() => {
            const handleEscape = (e) => {
                if (e.key === 'Escape' && isFullscreen) {
                    setIsFullscreen(false);
                }
            };
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }, [isFullscreen]);
        
        // Geopath Plotter State
        const [geopathData, setGeopathData] = useState([]);
        const [geopathFile, setGeopathFile] = useState(null);
        const [geopathStats, setGeopathStats] = useState(null);
        const geopathMapRef = useRef(null);
        const geopathMapInstanceRef = useRef(null);

        // --- GEOPATH CSV PARSER ---
        const parseGeopathCSV = (text) => {
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) return [];
            
            // Parse header row
            const parseRow = (line) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') { inQuotes = !inQuotes; }
                    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                    else { current += char; }
                }
                result.push(current.trim());
                return result;
            };
            
            const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
            
            // Find relevant columns (flexible matching)
            const findColumn = (patterns) => {
                return headers.findIndex(h => patterns.some(p => h.includes(p)));
            };
            
            const latIdx = findColumn(['latitude', 'lat', 'y_coord']);
            const lonIdx = findColumn(['longitude', 'lon', 'lng', 'long', 'x_coord']);
            const impIdx = findColumn(['impression', 'imps', 'weekly_imp', 'daily_imp', 'avg_imp', 'target_imp']);
            const idIdx = findColumn(['geopath_id', 'spot_id', 'panel_id', 'unit_id', 'id', 'plant_unit']);
            const nameIdx = findColumn(['name', 'description', 'location', 'address', 'street']);
            const mediaIdx = findColumn(['media_type', 'media', 'product', 'type', 'format']);
            const marketIdx = findColumn(['market', 'dma', 'cbsa', 'city']);
            const reachIdx = findColumn(['reach', 'target_reach']);
            const freqIdx = findColumn(['frequency', 'freq', 'avg_frequency']);
            
            if (latIdx === -1 || lonIdx === -1) {
                alert('CSV must contain Latitude and Longitude columns');
                return [];
            }
            
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseRow(lines[i]);
                const lat = parseFloat(values[latIdx]);
                const lon = parseFloat(values[lonIdx]);
                
                if (isNaN(lat) || isNaN(lon)) continue;
                if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
                
                const impressions = impIdx !== -1 ? parseFloat(values[impIdx]?.replace(/,/g, '')) || 0 : 0;
                
                data.push({
                    lat,
                    lon,
                    impressions,
                    id: idIdx !== -1 ? values[idIdx] : `LOC-${i}`,
                    name: nameIdx !== -1 ? values[nameIdx] : '',
                    media: mediaIdx !== -1 ? values[mediaIdx] : '',
                    market: marketIdx !== -1 ? values[marketIdx] : '',
                    reach: reachIdx !== -1 ? parseFloat(values[reachIdx]?.replace(/,/g, '')) || 0 : 0,
                    frequency: freqIdx !== -1 ? parseFloat(values[freqIdx]) || 0 : 0,
                    raw: values
                });
            }
            
            return data;
        };

        // Handle Geopath file upload
        const handleGeopathUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            setGeopathFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                const parsed = parseGeopathCSV(event.target.result);
                setGeopathData(parsed);
                
                // Calculate stats
                if (parsed.length > 0) {
                    const impressions = parsed.map(d => d.impressions).filter(i => i > 0);
                    const stats = {
                        total: parsed.length,
                        withImpressions: impressions.length,
                        totalImpressions: impressions.reduce((s, i) => s + i, 0),
                        avgImpressions: impressions.length > 0 ? Math.round(impressions.reduce((s, i) => s + i, 0) / impressions.length) : 0,
                        minImpressions: impressions.length > 0 ? Math.min(...impressions) : 0,
                        maxImpressions: impressions.length > 0 ? Math.max(...impressions) : 0,
                        medianImpressions: impressions.length > 0 ? impressions.sort((a, b) => a - b)[Math.floor(impressions.length / 2)] : 0,
                        markets: [...new Set(parsed.map(d => d.market).filter(Boolean))],
                        mediaTypes: [...new Set(parsed.map(d => d.media).filter(Boolean))]
                    };
                    setGeopathStats(stats);
                    setChartView('geopath'); // Auto-switch to Geopath view
                }
            };
            reader.readAsText(file);
        };

        // --- GEOPATH MAP INITIALIZATION ---
        useEffect(() => {
            if (chartView !== 'geopath' || !geopathMapRef.current || geopathData.length === 0) return;
            
            // Clean up existing map
            if (geopathMapInstanceRef.current) {
                geopathMapInstanceRef.current.remove();
                geopathMapInstanceRef.current = null;
            }

            // Calculate bounds
            const lats = geopathData.map(d => d.lat);
            const lons = geopathData.map(d => d.lon);
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

            // Initialize map
            const map = L.map(geopathMapRef.current, {
                center: [centerLat || 39.8, centerLon || -98.5],
                zoom: 10,
                scrollWheelZoom: true
            });

            // Add tile layer (dark mode for better visibility)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap contributors © CARTO',
                maxZoom: 19
            }).addTo(map);

            // Calculate impression thresholds for coloring
            const impressions = geopathData.map(d => d.impressions).filter(i => i > 0);
            const sortedImps = [...impressions].sort((a, b) => a - b);
            const p25 = sortedImps[Math.floor(sortedImps.length * 0.25)] || 0;
            const p50 = sortedImps[Math.floor(sortedImps.length * 0.50)] || 0;
            const p75 = sortedImps[Math.floor(sortedImps.length * 0.75)] || 0;
            const p90 = sortedImps[Math.floor(sortedImps.length * 0.90)] || 0;

            // Color scale function
            const getColor = (imp) => {
                if (imp === 0) return '#6b7280'; // gray for no data
                if (imp >= p90) return '#22c55e'; // green - top 10%
                if (imp >= p75) return '#84cc16'; // lime - top 25%
                if (imp >= p50) return '#eab308'; // yellow - above median
                if (imp >= p25) return '#f97316'; // orange - below median
                return '#ef4444'; // red - bottom 25%
            };

            // Add markers
            geopathData.forEach(loc => {
                const color = getColor(loc.impressions);
                const radius = loc.impressions > 0 
                    ? Math.max(5, Math.min(15, 5 + (loc.impressions / (p90 || 1)) * 10))
                    : 5;
                
                const circle = L.circleMarker([loc.lat, loc.lon], {
                    radius: radius,
                    fillColor: color,
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(map);
                
                // Popup with details
                const popupContent = `
                    <div style="min-width: 200px; font-family: Inter, sans-serif;">
                        <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #1e293b;">
                            ${loc.name || loc.id}
                        </h3>
                        ${loc.media ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">▸ ${loc.media}</div>` : ''}
                        ${loc.market ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">◉ ${loc.market}</div>` : ''}
                        
                        <div style="background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Weekly Impressions</div>
                            <div style="font-size: 20px; font-weight: bold; color: ${color};">
                                ${loc.impressions > 0 ? loc.impressions.toLocaleString() : 'N/A'}
                            </div>
                            ${loc.impressions > 0 ? `
                                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                                    ${loc.impressions >= p90 ? '★ Top 10%' : 
                                      loc.impressions >= p75 ? '▲ Top 25%' : 
                                      loc.impressions >= p50 ? '● Above Median' : 
                                      loc.impressions >= p25 ? '▼ Below Median' : '○ Bottom 25%'}
                                </div>
                            ` : ''}
                        </div>
                        
                        ${loc.reach > 0 || loc.frequency > 0 ? `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                                ${loc.reach > 0 ? `<div><span style="color: #64748b;">Reach:</span> <strong>${loc.reach.toLocaleString()}</strong></div>` : ''}
                                ${loc.frequency > 0 ? `<div><span style="color: #64748b;">Freq:</span> <strong>${loc.frequency.toFixed(1)}</strong></div>` : ''}
                            </div>
                        ` : ''}
                        
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                            ID: ${loc.id}<br>
                            Coords: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}
                        </div>
                    </div>
                `;
                
                circle.bindPopup(popupContent, { maxWidth: 300 });
                circle.bindTooltip(`${loc.impressions > 0 ? loc.impressions.toLocaleString() + ' imps' : loc.id}`, {
                    permanent: false,
                    direction: 'top'
                });
            });

            // Fit bounds to show all markers
            if (geopathData.length > 1) {
                const bounds = L.latLngBounds(geopathData.map(d => [d.lat, d.lon]));
                map.fitBounds(bounds, { padding: [20, 20] });
            }

            geopathMapInstanceRef.current = map;

            return () => {
                if (geopathMapInstanceRef.current) {
                    geopathMapInstanceRef.current.remove();
                    geopathMapInstanceRef.current = null;
                }
            };
        }, [chartView, geopathData]);

        // --- EXTRACT UNIQUE MARKETS & MEDIA FROM DATA ---
        // EXCLUDED PRODUCTION-RELATED ITEMS (not actual media inventory)
        const EXCLUDED_PRODUCTS = [
            'rush fee', 'rush', 'shipping', 'freight', 'delivery',
            'measurement', 'measurements', 'survey',
            'analytics', 'reporting', 'report',
            'production', 'install fee', 'installation fee',
            'removal', 'removal fee', 'de-install',
            'design', 'design fee', 'creative', 'artwork',
            'permit', 'permits', 'permitting',
            'admin', 'administrative', 'misc', 'miscellaneous',
            'service', 'services', 'charge',
            'tax', 'taxes'
        ];
        
        const isProductExcluded = (product) => {
            if (!product) return true;
            const productLower = product.toLowerCase();
            return EXCLUDED_PRODUCTS.some(excluded => 
                productLower.includes(excluded) || productLower === excluded
            );
        };

        const { markets, mediaTypes } = useMemo(() => {
            if (!allData) return { markets: [], mediaTypes: [] };
            const marketSet = new Set();
            const mediaSet = new Set();
            allData.forEach(item => {
                if (item.market) marketSet.add(item.market);
                // Only include actual media products, not production items
                if (item.product && !isProductExcluded(item.product)) {
                    mediaSet.add(item.product);
                }
            });
            return {
                markets: ['ALL', ...Array.from(marketSet).sort()],
                mediaTypes: ['ALL', ...Array.from(mediaSet).sort()]
            };
        }, [allData]);

        // --- REGION & CATEGORY MAPPINGS for smart groupings ---
        const AVAILABILITY_MARKET_GROUPS = {
            'West Coast': ['Los Angeles', 'San Francisco', 'Seattle', 'San Diego', 'Portland', 'Sacramento', 'Santa Monica', 'Orange County'],
            'East Coast': ['New York', 'Boston', 'Philadelphia', 'Washington', 'Baltimore', 'Newark', 'Howard County'],
            'Southwest': ['Dallas', 'Houston', 'Phoenix', 'Austin', 'San Antonio', 'Denver', 'Las Vegas'],
            'Southeast': ['Miami', 'Orlando', 'Atlanta', 'Tampa', 'Charlotte', 'Nashville', 'Broward County', 'Lakeland'],
            'Midwest': ['Chicago', 'Detroit', 'Minneapolis', 'Cleveland', 'Indianapolis', 'Columbus']
        };
        
        const AVAILABILITY_MEDIA_GROUPS = {
            'Digital': ['Digital', 'digital'],
            'Static': ['Panel', 'Poster', 'Static'],
            'Premium': ['Domination', 'Full Wrap', 'Embellishment', 'Icon', 'Premium']
        };

        // --- CALCULATE TOTAL INVENTORY BASED ON SELECTION ---
        const totalInventory = useMemo(() => {
            if (inventoryOverride) return inventoryOverride;
            
            let total = 0;
            const isRegion = selectedMarket.startsWith('REGION:');
            const isCategory = selectedMedia.startsWith('CATEGORY:');
            
            if (selectedMarket === 'ALL' && selectedMedia === 'ALL') {
                // Sum all inventory
                Object.values(DEFAULT_INVENTORY).forEach(mediaObj => {
                    Object.values(mediaObj).forEach(qty => total += qty);
                });
            } else if (selectedMarket === 'ALL' || isRegion) {
                // Sum across all markets (or region) for selected media
                Object.values(DEFAULT_INVENTORY).forEach(mediaObj => {
                    Object.entries(mediaObj).forEach(([media, qty]) => {
                        if (selectedMedia === 'ALL' || selectedMedia === media || media === 'Other' || media === 'All Media') total += qty;
                    });
                });
            } else if (selectedMedia === 'ALL' || isCategory) {
                // Sum all media for selected market
                const marketKey = Object.keys(DEFAULT_INVENTORY).find(k => selectedMarket.includes(k.split(',')[0])) || 'Other Markets';
                const mediaObj = DEFAULT_INVENTORY[marketKey] || DEFAULT_INVENTORY['Other Markets'];
                Object.values(mediaObj).forEach(qty => total += qty);
            } else {
                // Specific market + media
                const marketKey = Object.keys(DEFAULT_INVENTORY).find(k => selectedMarket.includes(k.split(',')[0])) || 'Other Markets';
                const mediaObj = DEFAULT_INVENTORY[marketKey] || DEFAULT_INVENTORY['Other Markets'];
                total = mediaObj[selectedMedia] || mediaObj['Other'] || mediaObj['All Media'] || 100;
            }
            return total || 500;
        }, [selectedMarket, selectedMedia, inventoryOverride]);

        // --- FILTER DATA BY MARKET & MEDIA (with region/category support) ---
        const filteredData = useMemo(() => {
            if (!allData) return [];
            
            // Check if using region or category
            const isRegion = selectedMarket.startsWith('REGION:');
            const isCategory = selectedMedia.startsWith('CATEGORY:');
            const regionName = isRegion ? selectedMarket.replace('REGION:', '') : null;
            const categoryName = isCategory ? selectedMedia.replace('CATEGORY:', '') : null;
            
            return allData.filter(item => {
                // Market filtering
                if (selectedMarket !== 'ALL') {
                    if (isRegion) {
                        // Check if item's market is in the region
                        const regionCities = AVAILABILITY_MARKET_GROUPS[regionName] || [];
                        const matchesRegion = regionCities.some(city => 
                            item.market?.toLowerCase().includes(city.toLowerCase())
                        );
                        if (!matchesRegion) return false;
                    } else {
                        if (item.market !== selectedMarket) return false;
                    }
                }
                
                // NOTE: ZIP filter is INFORMATIONAL ONLY
                // It shows impressions estimates for the selected neighborhood
                // but doesn't filter booking data (which doesn't have ZIP-level granularity)
                // If your data HAS ZIP codes, uncomment below to enable filtering:
                /*
                if (selectedZip) {
                    const itemZip = item.zip || item.zipCode || item.postalCode || '';
                    const address = item.address || item.location || '';
                    const zipMatches = itemZip.toString().includes(selectedZip) || 
                                      address.toString().includes(selectedZip);
                    if (!zipMatches) return false;
                }
                */
                
                // Media filtering
                if (selectedMedia !== 'ALL') {
                    if (isCategory) {
                        // Check if item's product matches the category
                        const categoryKeywords = AVAILABILITY_MEDIA_GROUPS[categoryName] || [];
                        const matchesCategory = categoryKeywords.some(keyword => 
                            item.product?.toLowerCase().includes(keyword.toLowerCase())
                        );
                        if (!matchesCategory) return false;
                    } else {
                        if (item.product !== selectedMedia) return false;
                    }
                }
                
                if (!includeHolds && (item.stage?.includes("Hold") || item.stage?.includes("Pending"))) return false;
                return true;
            });
        }, [allData, selectedMarket, selectedMedia, selectedZip, includeHolds]);

        // --- MARKET UTILIZATION SUMMARY ---
        const marketSummary = useMemo(() => {
            if (!allData) return [];
            const today = new Date();
            const summary = {};
            
            allData.forEach(item => {
                const market = item.market || 'Unknown';
                if (!summary[market]) {
                    summary[market] = { market, booked: 0, campaigns: 0, stages: {} };
                }
                
                // Only count active campaigns (date range includes today)
                let itemStart = ensureDate(item.dateObj) || ensureDate(item.date);
                let itemEnd = ensureDate(item.endDateObj) || ensureDate(item.endDate) || itemStart;
                if (itemStart && itemEnd && today >= itemStart && today <= itemEnd) {
                    summary[market].booked += (item.quantity || item.totalQty || 0);
                    summary[market].campaigns++;
                    const stage = item.stage || 'Unknown';
                    summary[market].stages[stage] = (summary[market].stages[stage] || 0) + 1;
                }
            });

            return Object.values(summary)
                .sort((a, b) => b.booked - a.booked)
                .slice(0, 8); // Top 8 markets
        }, [allData]);

        // --- MAP DATA: All markets with coordinates ---
        const mapMarketData = useMemo(() => {
            if (!allData) return [];
            const today = new Date();
            // Parse dates as local time
            const rangeStartDate = new Date(rangeStart + 'T00:00:00');
            const rangeEndDate = new Date(rangeEnd + 'T00:00:00');
            const summary = {};
            
            allData.forEach(item => {
                const market = item.market || 'Unknown';
                if (!summary[market]) {
                    summary[market] = { 
                        market, 
                        booked: 0, 
                        available: 0,
                        campaigns: 0, 
                        holds: 0,
                        confirmed: 0,
                        mediaTypes: {}
                    };
                }
                
                // Check if campaign overlaps with selected date range
                let itemStart = ensureDate(item.dateObj) || ensureDate(item.date);
                let itemEnd = ensureDate(item.endDateObj) || ensureDate(item.endDate) || itemStart;
                
                if (itemStart && itemEnd) {
                    const overlaps = itemStart <= rangeEndDate && itemEnd >= rangeStartDate;
                    if (overlaps) {
                        const qty = item.quantity || item.totalQty || 0;
                        summary[market].booked += qty;
                        summary[market].campaigns++;
                        
                        // Track media types (excluding production items)
                        const media = item.product || 'Other';
                        if (!isProductExcluded(media)) {
                            if (!summary[market].mediaTypes[media]) {
                                summary[market].mediaTypes[media] = 0;
                            }
                            summary[market].mediaTypes[media] += qty;
                        }
                        
                        // Track holds vs confirmed
                        if (item.stage?.includes('Hold') || item.stage?.includes('Pending')) {
                            summary[market].holds += qty;
                        } else {
                            summary[market].confirmed += qty;
                        }
                    }
                }
            });

            // Add coordinates and calculate utilization
            return Object.values(summary)
                .map(m => {
                    // Find coordinates (fuzzy match)
                    const coordKey = Object.keys(MARKET_COORDS).find(k => 
                        m.market.toLowerCase().includes(k.split(',')[0].toLowerCase()) ||
                        k.toLowerCase().includes(m.market.split(',')[0].toLowerCase())
                    );
                    const coords = coordKey ? MARKET_COORDS[coordKey] : null;
                    
                    // Estimate total inventory for this market
                    const invKey = Object.keys(DEFAULT_INVENTORY).find(k => 
                        m.market.toLowerCase().includes(k.split(',')[0].toLowerCase())
                    ) || 'Other Markets';
                    const marketInv = DEFAULT_INVENTORY[invKey] || DEFAULT_INVENTORY['Other Markets'];
                    const totalInv = Object.values(marketInv).reduce((s, v) => s + v, 0);
                    
                    const utilization = totalInv > 0 ? Math.round((m.booked / totalInv) * 100) : 0;
                    
                    return {
                        ...m,
                        coords,
                        totalInventory: totalInv,
                        utilization: Math.min(100, utilization),
                        available: Math.max(0, totalInv - m.booked)
                    };
                })
                .filter(m => m.coords) // Only markets with coordinates
                .sort((a, b) => b.booked - a.booked);
        }, [allData, rangeStart, rangeEnd]);

        // --- LEAFLET MAP INITIALIZATION ---
        useEffect(() => {
            if (chartView !== 'map' || !mapContainerRef.current) return;
            
            // Clean up existing map
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }

            // Initialize map centered on US
            const map = L.map(mapContainerRef.current, {
                center: [39.8, -98.5],
                zoom: 4,
                scrollWheelZoom: true
            });

            // Add OpenStreetMap tiles (FREE!)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);

            // Add market markers
            mapMarketData.forEach(market => {
                if (!market.coords) return;
                
                // Color based on utilization
                let color = '#22c55e'; // green
                if (market.utilization >= 90) color = '#ef4444'; // red
                else if (market.utilization >= 70) color = '#f97316'; // orange
                else if (market.utilization >= 50) color = '#eab308'; // yellow
                else if (market.utilization >= 30) color = '#3b82f6'; // blue
                
                // Size based on booked units (min 15, max 50)
                const radius = Math.max(15, Math.min(50, 10 + Math.sqrt(market.booked) * 2));
                
                // Create circle marker
                const circle = L.circleMarker(market.coords, {
                    radius: radius,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(map);
                
                // Top media types for popup
                const topMedia = Object.entries(market.mediaTypes)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([media, qty]) => `<li>${media}: ${qty}</li>`)
                    .join('');
                
                // Popup content
                circle.bindPopup(`
                    <div style="min-width: 200px; font-family: Inter, sans-serif;">
                        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #1e293b;">${market.market}</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                            <div style="background: #f1f5f9; padding: 8px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 18px; font-weight: bold; color: ${color};">${market.booked}</div>
                                <div style="font-size: 10px; color: #64748b;">Booked</div>
                            </div>
                            <div style="background: #f1f5f9; padding: 8px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 18px; font-weight: bold; color: #22c55e;">${market.available}</div>
                                <div style="font-size: 10px; color: #64748b;">Available</div>
                            </div>
                        </div>
                        <div style="background: linear-gradient(to right, ${color} ${market.utilization}%, #e2e8f0 ${market.utilization}%); height: 8px; border-radius: 4px; margin-bottom: 8px;"></div>
                        <div style="font-size: 11px; color: #64748b; text-align: center; margin-bottom: 8px;">${market.utilization}% Utilized • ${market.campaigns} Flights</div>
                        <div style="font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                            <strong style="color: #475569;">Top Media:</strong>
                            <ul style="margin: 4px 0 0 16px; padding: 0; color: #64748b;">${topMedia || '<li>No data</li>'}</ul>
                        </div>
                        ${market.holds > 0 ? `<div style="margin-top: 8px; padding: 6px; background: #fef3c7; border-radius: 4px; font-size: 10px; color: #92400e;">● ${market.holds} units on hold</div>` : ''}
                    </div>
                `, { maxWidth: 300 });
                
                // Tooltip on hover
                circle.bindTooltip(`${market.market.split(',')[0]}: ${market.booked} booked`, {
                    permanent: false,
                    direction: 'top'
                });
            });

            mapInstanceRef.current = map;

            // Cleanup on unmount
            return () => {
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.remove();
                    mapInstanceRef.current = null;
                }
            };
        }, [chartView, mapMarketData]);
        const utilizationData = useMemo(() => {
            if (!filteredData) return [];
            // Parse dates as local time (add T00:00:00 to prevent UTC interpretation)
            const start = new Date(rangeStart + 'T00:00:00');
            const end = new Date(rangeEnd + 'T00:00:00');
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

            const days = getDatesInRange(start, end);

            return days.map(day => {
                let bookedUnits = 0;
                let activeCampaigns = [];
                let holdUnits = 0;
                let confirmedUnits = 0;

                filteredData.forEach(item => {
                    let itemStart = ensureDate(item.dateObj) || ensureDate(item.date);
                    let itemEnd = ensureDate(item.endDateObj) || ensureDate(item.endDate) || itemStart;

                    if (itemStart && isDateInRange(day, itemStart, itemEnd)) {
                        const qty = parseFloat(item.quantity) || parseFloat(item.totalQty) || 0;
                        bookedUnits += qty;
                        
                        // Track holds vs confirmed separately
                        if (item.stage?.includes("Hold") || item.stage?.includes("Pending")) {
                            holdUnits += qty;
                        } else {
                            confirmedUnits += qty;
                        }
                        
                        if (qty > 3) activeCampaigns.push({ name: item.advertiser, qty, stage: item.stage, media: item.product });
                    }
                });

                const available = totalInventory - bookedUnits;
                const utilizationPct = totalInventory > 0 ? (bookedUnits / totalInventory) * 100 : 0;
                
                let status = 'open'; 
                if (utilizationPct >= 100) status = 'full';
                else if (utilizationPct >= 90) status = 'critical';
                else if (utilizationPct >= 70) status = 'tight';
                else if (utilizationPct >= 40) status = 'moderate';
                else if (bookedUnits > 0) status = 'light';

                return {
                    date: day,
                    dayName: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    weekLabel: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    isStartOfWeek: isPostingDay(day), 
                    booked: bookedUnits,
                    holdUnits,
                    confirmedUnits,
                    available: Math.max(0, available),
                    utilizationPct: Math.min(100, utilizationPct),
                    campaigns: activeCampaigns.sort((a,b) => b.qty - a.qty),
                    status
                };
            });
        }, [filteredData, rangeStart, rangeEnd, totalInventory]);

        // --- WEEKLY AGGREGATION ---
        const weeklyData = useMemo(() => {
            if (utilizationData.length === 0) return [];
            const weeks = [];
            let currentWeek = null;

            utilizationData.forEach(day => {
                if (day.isStartOfWeek || !currentWeek) {
                    if (currentWeek) weeks.push(currentWeek);
                    currentWeek = {
                        weekStart: day.date,
                        weekLabel: day.weekLabel,
                        days: [],
                        avgBooked: 0,
                        avgAvailable: 0,
                        peakBooked: 0,
                        minAvailable: Infinity,
                        campaigns: new Map() // Use Map to store campaign details
                    };
                }
                currentWeek.days.push(day);
                currentWeek.avgBooked += day.booked;
                currentWeek.avgAvailable += day.available;
                currentWeek.peakBooked = Math.max(currentWeek.peakBooked, day.booked);
                currentWeek.minAvailable = Math.min(currentWeek.minAvailable, day.available);
                // Store campaign details with name as key
                day.campaigns.forEach(c => {
                    if (!currentWeek.campaigns.has(c.name)) {
                        currentWeek.campaigns.set(c.name, { 
                            name: c.name, 
                            qty: c.qty, 
                            stage: c.stage,
                            advertiser: c.advertiser || c.name.split(' - ')[0]
                        });
                    }
                });
            });
            if (currentWeek) weeks.push(currentWeek);

            return weeks.map(w => ({
                ...w,
                avgBooked: Math.round(w.avgBooked / w.days.length),
                avgAvailable: Math.round(w.avgAvailable / w.days.length),
                avgUtilization: Math.min(100, Math.round((w.avgBooked / w.days.length / totalInventory) * 100)),
                campaignCount: w.campaigns.size,
                campaignList: Array.from(w.campaigns.values()) // Convert to array for display
            }));
        }, [utilizationData, totalInventory]);

        // --- MONTHLY DATA ---
        const monthlyData = useMemo(() => {
            if (utilizationData.length === 0) return [];
            const months = {};
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            utilizationData.forEach(day => {
                const monthKey = `${day.date.getFullYear()}-${day.date.getMonth()}`;
                if (!months[monthKey]) {
                    months[monthKey] = {
                        monthKey,
                        monthLabel: `${monthNames[day.date.getMonth()]} ${day.date.getFullYear()}`,
                        monthShort: monthNames[day.date.getMonth()],
                        year: day.date.getFullYear(),
                        days: [],
                        totalBooked: 0,
                        totalAvailable: 0,
                        peakBooked: 0,
                        minAvailable: Infinity,
                        campaigns: new Map()
                    };
                }
                months[monthKey].days.push(day);
                months[monthKey].totalBooked += day.booked;
                months[monthKey].totalAvailable += day.available;
                months[monthKey].peakBooked = Math.max(months[monthKey].peakBooked, day.booked);
                months[monthKey].minAvailable = Math.min(months[monthKey].minAvailable, day.available);
                day.campaigns.forEach(c => {
                    if (!months[monthKey].campaigns.has(c.name)) {
                        months[monthKey].campaigns.set(c.name, { name: c.name, qty: c.qty, stage: c.stage });
                    }
                });
            });

            return Object.values(months).map(m => ({
                ...m,
                avgBooked: Math.round(m.totalBooked / m.days.length),
                avgAvailable: Math.round(m.totalAvailable / m.days.length),
                avgUtilization: Math.min(100, Math.round((m.totalBooked / m.days.length / totalInventory) * 100)),
                campaignCount: m.campaigns.size,
                campaignList: Array.from(m.campaigns.values()),
                daysCount: m.days.length
            }));
        }, [utilizationData, totalInventory]);

        // --- YEARLY DATA ---
        const yearlyData = useMemo(() => {
            if (utilizationData.length === 0) return [];
            const years = {};

            utilizationData.forEach(day => {
                const year = day.date.getFullYear();
                if (!years[year]) {
                    years[year] = {
                        year,
                        yearLabel: year.toString(),
                        days: [],
                        totalBooked: 0,
                        totalAvailable: 0,
                        peakBooked: 0,
                        minAvailable: Infinity,
                        campaigns: new Map(),
                        monthlyBreakdown: {}
                    };
                }
                years[year].days.push(day);
                years[year].totalBooked += day.booked;
                years[year].totalAvailable += day.available;
                years[year].peakBooked = Math.max(years[year].peakBooked, day.booked);
                years[year].minAvailable = Math.min(years[year].minAvailable, day.available);
                day.campaigns.forEach(c => {
                    if (!years[year].campaigns.has(c.name)) {
                        years[year].campaigns.set(c.name, { name: c.name, qty: c.qty, stage: c.stage });
                    }
                });
                // Track monthly breakdown
                const month = day.date.getMonth();
                if (!years[year].monthlyBreakdown[month]) {
                    years[year].monthlyBreakdown[month] = { booked: 0, days: 0 };
                }
                years[year].monthlyBreakdown[month].booked += day.booked;
                years[year].monthlyBreakdown[month].days++;
            });

            return Object.values(years).map(y => ({
                ...y,
                avgBooked: Math.round(y.totalBooked / y.days.length),
                avgAvailable: Math.round(y.totalAvailable / y.days.length),
                avgUtilization: Math.min(100, Math.round((y.totalBooked / y.days.length / totalInventory) * 100)),
                campaignCount: y.campaigns.size,
                campaignList: Array.from(y.campaigns.values()),
                daysCount: y.days.length
            }));
        }, [utilizationData, totalInventory]);

        // --- GAP FINDER ---
        const gaps = useMemo(() => {
            if (utilizationData.length === 0) return [];
            let currentGap = { start: null, length: 0, avgAvail: 0 };
            const foundGaps = [];
            
            utilizationData.forEach((day, index) => {
                const fitsRequest = day.available >= requiredSize;

                if (fitsRequest) {
                    if (!currentGap.start) {
                        currentGap.start = day.date;
                        currentGap.avgAvail = day.available;
                    } else {
                        currentGap.avgAvail += day.available;
                    }
                    currentGap.length++;
                } else {
                    if (currentGap.start) {
                        currentGap.avgAvail = Math.floor(currentGap.avgAvail / currentGap.length);
                        foundGaps.push({...currentGap});
                        currentGap = { start: null, length: 0, avgAvail: 0 };
                    }
                }
                if (index === utilizationData.length - 1 && currentGap.start) {
                    currentGap.avgAvail = Math.floor(currentGap.avgAvail / currentGap.length);
                    foundGaps.push({...currentGap});
                }
            });
            return foundGaps.filter(g => g.length >= 7).sort((a,b) => b.length - a.length); 
        }, [utilizationData, requiredSize]);

        // --- BEST OPENINGS BY MEDIA TYPE ---
        const [showOpeningsPanel, setShowOpeningsPanel] = useState(false);
        const [showMetricsHelp, setShowMetricsHelp] = useState(false);
        
        const bestOpeningsByMedia = useMemo(() => {
            if (!filteredData || filteredData.length === 0) return { byMedia: [], byMarket: [], recommendations: [], byImpressions: [] };
            
            // Parse dates as local time
            const start = new Date(rangeStart + 'T00:00:00');
            const end = new Date(rangeEnd + 'T00:00:00');
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return { byMedia: [], byMarket: [], recommendations: [], byImpressions: [] };

            const days = getDatesInRange(start, end);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all unique media types from FILTERED data, excluding production items
            const allMediaTypes = [...new Set(filteredData.map(item => item.product).filter(Boolean))]
                .filter(product => !isProductExcluded(product));
            
            // Calculate openings for each media type
            const mediaOpenings = allMediaTypes.map(mediaType => {
                // Get inventory for this media type
                let mediaInventory = 0;
                Object.values(DEFAULT_INVENTORY).forEach(marketInv => {
                    Object.entries(marketInv).forEach(([media, qty]) => {
                        if (media === mediaType || (media === 'Other' && !Object.keys(marketInv).includes(mediaType))) {
                            mediaInventory += qty;
                        }
                    });
                });
                if (mediaInventory === 0) mediaInventory = 100; // Default

                // Calculate daily utilization for this media from FILTERED data
                const mediaUtilization = days.map(day => {
                    let booked = 0;
                    filteredData.forEach(item => {
                        if (item.product !== mediaType) return;
                        if (!includeHolds && (item.stage?.includes("Hold") || item.stage?.includes("Pending"))) return;
                        
                        let itemStart = ensureDate(item.dateObj) || ensureDate(item.date);
                        let itemEnd = ensureDate(item.endDateObj) || ensureDate(item.endDate) || itemStart;
                        
                        if (itemStart && itemEnd && day >= itemStart && day <= itemEnd) {
                            booked += (item.quantity || item.totalQty || 0);
                        }
                    });
                    return {
                        date: day,
                        booked,
                        available: Math.max(0, mediaInventory - booked)
                    };
                });

                // Find gaps for this media
                const mediaGaps = [];
                let currentGap = null;
                
                mediaUtilization.forEach((day, idx) => {
                    const canFit = day.available >= requiredSize;
                    
                    if (canFit) {
                        if (!currentGap) {
                            currentGap = {
                                start: day.date,
                                end: day.date,
                                length: 1,
                                minAvail: day.available,
                                avgAvail: day.available,
                                isImmediate: day.date <= new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000) // Within 2 weeks
                            };
                        } else {
                            currentGap.end = day.date;
                            currentGap.length++;
                            currentGap.minAvail = Math.min(currentGap.minAvail, day.available);
                            currentGap.avgAvail += day.available;
                        }
                    } else {
                        if (currentGap) {
                            currentGap.avgAvail = Math.round(currentGap.avgAvail / currentGap.length);
                            if (currentGap.length >= 7) mediaGaps.push({ ...currentGap });
                            currentGap = null;
                        }
                    }
                    
                    if (idx === mediaUtilization.length - 1 && currentGap) {
                        currentGap.avgAvail = Math.round(currentGap.avgAvail / currentGap.length);
                        if (currentGap.length >= 7) mediaGaps.push({ ...currentGap });
                    }
                });

                // Separate into short-term and long-term
                const shortTerm = mediaGaps.filter(g => g.length < 28).sort((a, b) => a.start - b.start).slice(0, 3);
                const longTerm = mediaGaps.filter(g => g.length >= 28).sort((a, b) => b.length - a.length).slice(0, 3);
                
                // Calculate overall availability score
                const totalAvailableDays = mediaUtilization.filter(d => d.available >= requiredSize).length;
                const availabilityScore = Math.round((totalAvailableDays / days.length) * 100);

                // Best gap = LONGEST gap (sorted by length descending)
                const sortedGaps = [...mediaGaps].sort((a, b) => b.length - a.length);
                const bestGap = sortedGaps[0] || null;
                
                // Calculate impressions potential based on DATE RANGE
                const impData = getProductImpressions(mediaType);
                const weeklyImpressions = impData.weekly;
                
                // Total impressions for this date range:
                // Method: weekly imps × average available units × weeks in SELECTED RANGE
                const avgAvailableUnits = totalAvailableDays > 0 
                    ? Math.round(mediaUtilization.filter(d => d.available >= requiredSize).reduce((sum, d) => sum + d.available, 0) / totalAvailableDays)
                    : 0;
                const weeksInRange = days.length / 7;
                
                // Campaign impressions based on the BEST GAP specifically
                const campaignImpressions = bestGap 
                    ? Math.round(weeklyImpressions * bestGap.avgAvail * (bestGap.length / 7))
                    : 0;
                
                // Total potential impressions across ALL availability in date range
                const totalRangeImpressions = Math.round(weeklyImpressions * avgAvailableUnits * (totalAvailableDays / 7));

                return {
                    media: mediaType,
                    inventory: mediaInventory,
                    shortTerm,
                    longTerm,
                    totalGaps: mediaGaps.length,
                    bestGap,
                    availabilityScore,
                    hasImmediate: mediaGaps.some(g => g.isImmediate),
                    totalAvailableDays,
                    weeksInRange,
                    // Impressions data
                    impressions: {
                        weeklyPerUnit: weeklyImpressions,
                        multiplier: impData.multiplier,
                        tier: impData.tier,
                        campaignTotal: campaignImpressions, // Best gap impressions
                        rangeTotal: totalRangeImpressions, // All availability in date range
                        avgAvailableUnits,
                        // Score for ranking (weighted by availability and impressions)
                        score: Math.round((campaignImpressions / 1000000) * (availabilityScore / 100) * 100)
                    }
                };
            });

            // Sort by availability score OR impressions score
            const sortedByAvailability = [...mediaOpenings].sort((a, b) => {
                // Always prioritize items with openings
                const aHasOpenings = a.shortTerm.length > 0 || a.longTerm.length > 0;
                const bHasOpenings = b.shortTerm.length > 0 || b.longTerm.length > 0;
                if (aHasOpenings && !bHasOpenings) return -1;
                if (!aHasOpenings && bHasOpenings) return 1;
                
                // Then sort by impressions score OR availability
                return b.availabilityScore - a.availabilityScore;
            });
            
            // NEW: Sorted by impressions potential
            const sortedByImpressions = [...mediaOpenings]
                .filter(m => m.shortTerm.length > 0 || m.longTerm.length > 0)
                .sort((a, b) => (b.impressions?.rangeTotal || 0) - (a.impressions?.rangeTotal || 0));

            // Calculate market-specific openings
            const marketOpenings = [];
            const uniqueMarkets = [...new Set(filteredData.map(item => item.market).filter(Boolean))];
            
            uniqueMarkets.forEach(market => {
                const marketData = filteredData.filter(item => item.market === market);
                let marketBooked = 0;
                
                marketData.forEach(item => {
                    let itemStart = ensureDate(item.dateObj) || ensureDate(item.date);
                    let itemEnd = ensureDate(item.endDateObj) || ensureDate(item.endDate) || itemStart;
                    if (itemStart && itemEnd && today >= itemStart && today <= itemEnd) {
                        marketBooked += (item.quantity || item.totalQty || 0);
                    }
                });

                // Estimate market inventory
                const marketKey = Object.keys(DEFAULT_INVENTORY).find(k => 
                    market.toLowerCase().includes(k.split(',')[0].toLowerCase())
                ) || 'Other Markets';
                const marketInv = DEFAULT_INVENTORY[marketKey] || DEFAULT_INVENTORY['Other Markets'];
                const totalInv = Object.values(marketInv).reduce((s, v) => s + v, 0);
                
                const available = Math.max(0, totalInv - marketBooked);
                const utilization = totalInv > 0 ? Math.round((marketBooked / totalInv) * 100) : 0;

                if (available >= requiredSize) {
                    marketOpenings.push({
                        market,
                        available,
                        totalInventory: totalInv,
                        utilization,
                        canFit: true
                    });
                }
            });

            // Generate recommendations
            const recommendations = [];
            
            // Best immediate opportunity
            const immediateOptions = sortedByAvailability.filter(m => m.hasImmediate && m.bestGap);
            if (immediateOptions.length > 0) {
                const best = immediateOptions[0];
                recommendations.push({
                    type: 'immediate',
                    icon: '▶',
                    title: 'Best Immediate Opportunity',
                    message: `${best.media} has ${best.bestGap.minAvail} units available starting ${best.bestGap.start.toLocaleDateString()}`,
                    media: best.media,
                    gap: best.bestGap
                });
            }

            // Best long-term opportunity
            const longTermOptions = sortedByAvailability.filter(m => m.longTerm.length > 0);
            if (longTermOptions.length > 0) {
                const best = longTermOptions.sort((a, b) => (b.longTerm[0]?.length || 0) - (a.longTerm[0]?.length || 0))[0];
                if (best.longTerm[0]) {
                    recommendations.push({
                        type: 'longterm',
                        icon: '◆',
                        title: 'Best Long-Term Window',
                        message: `${best.media} has ${Math.floor(best.longTerm[0].length / 7)} weeks available from ${best.longTerm[0].start.toLocaleDateString()}`,
                        media: best.media,
                        gap: best.longTerm[0]
                    });
                }
            }

            // Highest availability media
            if (sortedByAvailability[0] && sortedByAvailability[0].availabilityScore > 50) {
                recommendations.push({
                    type: 'flexible',
                    icon: '◇',
                    title: 'Most Flexible Media',
                    message: `${sortedByAvailability[0].media} has ${sortedByAvailability[0].availabilityScore}% availability across your date range`,
                    media: sortedByAvailability[0].media
                });
            }

            // Market with most space
            const bestMarket = marketOpenings.sort((a, b) => b.available - a.available)[0];
            if (bestMarket) {
                recommendations.push({
                    type: 'market',
                    icon: '◉',
                    title: 'Best Market Availability',
                    message: `${bestMarket.market.split(',')[0]} has ${bestMarket.available} units available (${100 - bestMarket.utilization}% open)`,
                    market: bestMarket.market
                });
            }

            // NEW: Top Impressions Opportunity
            const topImpression = sortedByImpressions[0];
            if (topImpression && topImpression.impressions?.rangeTotal > 0) {
                const impTotal = topImpression.impressions.rangeTotal;
                const impDisplay = impTotal >= 1000000000 
                    ? `${(impTotal / 1000000000).toFixed(1)}B`
                    : impTotal >= 1000000 
                        ? `${(impTotal / 1000000).toFixed(1)}M` 
                        : `${Math.round(impTotal / 1000)}K`;
                recommendations.push({
                    type: 'impressions',
                    icon: '📊',
                    title: 'Highest Impression Potential',
                    message: `${topImpression.media}: ~${impDisplay} sellable impressions (${topImpression.impressions.avgAvailableUnits || 0} avg avail units)`,
                    media: topImpression.media,
                    impressions: topImpression.impressions
                });
            }

            return {
                byMedia: sortedByAvailability,
                byImpressions: sortedByImpressions, // NEW
                byMarket: marketOpenings.sort((a, b) => b.available - a.available).slice(0, 8),
                recommendations
            };
        }, [filteredData, rangeStart, rangeEnd, requiredSize, includeHolds]);

        // --- STATUS COLORS ---
        const getStatusColor = (status) => {
            switch(status) {
                case 'full': return 'bg-red-500';
                case 'critical': return 'bg-orange-500';
                case 'tight': return 'bg-yellow-400';
                case 'moderate': return 'bg-blue-500';
                case 'light': return 'bg-blue-300';
                default: return 'bg-gray-200';
            }
        };

        // PDF Report Options State
        const [showPdfOptions, setShowPdfOptions] = useState(false);
        const [pdfOptions, setPdfOptions] = useState({
            includeMap: true,
            includeKpis: true,
            includeMarketBreakdown: true,
            includeImpressions: true,
            includeTable: true,
            includeHeader: true
        });

        // SVG Icons for PDF (Lucide-style)
        const PDF_ICONS = {
            chart: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
            map: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>',
            mapPin: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
            eye: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
            calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
            barChart: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>'
        };

        // PDF Export Function - uses current filter state and options
        const generateAvailabilityPDF = (options) => {
            const { includeMap, includeKpis, includeMarketBreakdown, includeImpressions, includeTable, includeHeader } = options;
            
            const dataToExport = viewMode === 'weekly' ? weeklyData : viewMode === 'monthly' ? monthlyData : viewMode === 'yearly' ? yearlyData : utilizationData;
            const marketLabel = selectedMarket === 'ALL' ? 'All Markets' : selectedMarket;
            const mediaLabel = selectedMedia === 'ALL' ? 'All Media Types' : selectedMedia;
            
            // Calculate summary stats from filtered data
            const avgUtil = dataToExport.length > 0 ? (dataToExport.reduce((s, d) => s + (d.utilizationPct || d.avgUtilization || 0), 0) / dataToExport.length).toFixed(1) : 0;
            const peakUtil = dataToExport.length > 0 ? Math.max(...dataToExport.map(d => d.utilizationPct || d.avgUtilization || 0)).toFixed(1) : 0;
            const avgAvail = dataToExport.length > 0 ? Math.round(dataToExport.reduce((s, d) => s + (d.available || d.avgAvailable || 0), 0) / dataToExport.length) : 0;
            
            // Calculate total impressions estimate
            const weeksInRange = Math.max(1, Math.ceil(dataToExport.length / 7));
            const avgWeeklyImpressions = totalInventory * 18000;
            const totalImpressionsCalc = avgWeeklyImpressions * weeksInRange;
            const availImpressionsCalc = Math.round((avgAvail / Math.max(1, totalInventory)) * totalImpressionsCalc);
            
            // Market breakdown - filtered by current selection
            const marketBreakdownData = selectedMarket === 'ALL' ? mapMarketData.slice(0, 8) : mapMarketData.filter(m => m.market.includes(selectedMarket.split(',')[0])).slice(0, 8);
            
            // Build market cards HTML
            const marketCardsHTML = marketBreakdownData.map(function(m) {
                var barColor = '#22c55e';
                if (m.utilization >= 90) barColor = '#ef4444';
                else if (m.utilization >= 70) barColor = '#f97316';
                else if (m.utilization >= 50) barColor = '#eab308';
                else if (m.utilization >= 30) barColor = '#3b82f6';
                return '<div class="market-card">' +
                    '<div class="market-name">' + m.market + '</div>' +
                    '<div class="market-stats">' +
                        '<div class="market-stat"><div class="market-stat-value" style="color:' + barColor + '">' + m.booked + '</div><div class="market-stat-label">Booked</div></div>' +
                        '<div class="market-stat"><div class="market-stat-value" style="color:#22c55e">' + m.available + '</div><div class="market-stat-label">Available</div></div>' +
                        '<div class="market-stat"><div class="market-stat-value">' + m.utilization + '%</div><div class="market-stat-label">Utilized</div></div>' +
                    '</div>' +
                    '<div class="market-bar"><div class="market-bar-fill" style="width:' + m.utilization + '%;background:' + barColor + '"></div></div>' +
                '</div>';
            }).join('');
            
            // Build table rows HTML
            const tableRowsHTML = dataToExport.slice(0, 50).map(function(d) {
                var avail = d.available || d.avgAvailable || 0;
                var periodImpressions = Math.round((avail / Math.max(1, totalInventory)) * avgWeeklyImpressions);
                var label = d.weekLabel || d.dayName || d.monthLabel || d.yearLabel || '';
                var status = d.status || 'open';
                return '<tr>' +
                    '<td style="font-weight:500">' + label + '</td>' +
                    '<td style="text-align:right">' + (d.booked || d.avgBooked || 0).toLocaleString() + '</td>' +
                    '<td style="text-align:right">' + (d.confirmedUnits || d.avgConfirmed || 0).toLocaleString() + '</td>' +
                    '<td style="text-align:right">' + (d.holdUnits || d.avgHolds || 0).toLocaleString() + '</td>' +
                    '<td style="text-align:right;font-weight:600;color:#16a34a">' + avail.toLocaleString() + '</td>' +
                    '<td style="text-align:right">' + (d.utilizationPct || d.avgUtilization || 0).toFixed(1) + '%</td>' +
                    '<td style="text-align:right;color:#7c3aed">' + (periodImpressions / 1000).toFixed(0) + 'K</td>' +
                    '<td><span class="status-badge ' + status + '">' + status.charAt(0).toUpperCase() + status.slice(1) + '</span></td>' +
                '</tr>';
            }).join('');
            
            // Map section HTML (conditional)
            const mapSectionHTML = includeMap ? `
                <div class="section">
                    <div class="section-header">
                        <div class="section-icon map"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg></div>
                        <div class="section-title">Market Coverage Map</div>
                    </div>
                    <div id="map"></div>
                    <div class="map-legend">
                        <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div> Open (&lt;30%)</div>
                        <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div> Available (30-50%)</div>
                        <div class="legend-item"><div class="legend-dot" style="background:#eab308"></div> Moderate (50-70%)</div>
                        <div class="legend-item"><div class="legend-dot" style="background:#f97316"></div> Tight (70-90%)</div>
                        <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div> Limited (&gt;90%)</div>
                    </div>
                </div>
            ` : '';
            
            // Map script (conditional)
            const mapScriptHTML = includeMap ? `
                <script>
                    window.onload = function() {
                        var map = L.map('map').setView([39.8, -98.5], 4);
                        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                            attribution: '© OpenStreetMap © CARTO', maxZoom: 19
                        }).addTo(map);
                        var markets = ${JSON.stringify(marketBreakdownData.map(m => ({ name: m.market, coords: m.coords, booked: m.booked, available: m.available, utilization: m.utilization })))};
                        markets.forEach(function(m) {
                            if (!m.coords) return;
                            var color = '#22c55e';
                            if (m.utilization >= 90) color = '#ef4444';
                            else if (m.utilization >= 70) color = '#f97316';
                            else if (m.utilization >= 50) color = '#eab308';
                            else if (m.utilization >= 30) color = '#3b82f6';
                            var radius = Math.max(12, Math.min(35, 8 + Math.sqrt(m.booked) * 1.5));
                            L.circleMarker(m.coords, { radius: radius, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.85 })
                                .addTo(map).bindPopup('<strong>' + m.name + '</strong><br>Booked: ' + m.booked + '<br>Available: ' + m.available + '<br>Utilization: ' + m.utilization + '%');
                        });
                        setTimeout(function() { window.print(); }, 1000);
                    };
                <\/script>
            ` : '<script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };<\/script>';
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`<!DOCTYPE html><html><head>
                <title>OOH Media Availability Report - ${marketLabel}</title>
                ${includeMap ? '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>' : ''}
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #1a1a2e; background: #fff; }
                    .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: white; padding: 40px; position: relative; overflow: hidden; }
                    .header::before { content: ''; position: absolute; top: -50%; right: -10%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%); }
                    .header-content { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; }
                    .logo-section { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
                    .logo-icon { width: 50px; height: 50px; background: linear-gradient(135deg, #38bdf8, #818cf8); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
                    .company-name { font-size: 14px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.7; }
                    .report-title { font-size: 32px; font-weight: 700; margin: 10px 0; }
                    .report-subtitle { font-size: 16px; opacity: 0.8; }
                    .header-meta { display: flex; gap: 40px; margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); flex-wrap: wrap; }
                    .meta-item { }
                    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.5; margin-bottom: 4px; }
                    .meta-value { font-size: 18px; font-weight: 600; }
                    .content { max-width: 1200px; margin: 0 auto; padding: 40px; }
                    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-bottom: 40px; }
                    .kpi-card { background: #f8fafc; border-radius: 16px; padding: 24px; text-align: center; border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
                    .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; }
                    .kpi-card.teal::before { background: linear-gradient(90deg, #14b8a6, #06b6d4); }
                    .kpi-card.blue::before { background: linear-gradient(90deg, #3b82f6, #6366f1); }
                    .kpi-card.amber::before { background: linear-gradient(90deg, #f59e0b, #ef4444); }
                    .kpi-card.green::before { background: linear-gradient(90deg, #22c55e, #10b981); }
                    .kpi-card.purple::before { background: linear-gradient(90deg, #8b5cf6, #a855f7); }
                    .kpi-value { font-size: 36px; font-weight: 700; margin-bottom: 5px; }
                    .kpi-card.teal .kpi-value { color: #0d9488; }
                    .kpi-card.blue .kpi-value { color: #2563eb; }
                    .kpi-card.amber .kpi-value { color: #d97706; }
                    .kpi-card.green .kpi-value { color: #16a34a; }
                    .kpi-card.purple .kpi-value { color: #7c3aed; }
                    .kpi-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
                    .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 8px; }
                    .section { margin-bottom: 40px; }
                    .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
                    .section-icon svg { width: 20px; height: 20px; }
                    .section-icon.map { background: #dbeafe; color: #2563eb; }
                    .section-icon.chart { background: #d1fae5; color: #059669; }
                    .section-icon.table { background: #fef3c7; color: #d97706; }
                    .section-icon.impressions { background: #ede9fe; color: #7c3aed; }
                    .section-title { font-size: 18px; font-weight: 600; color: #1e293b; }
                    #map { height: 350px; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 15px; }
                    .map-legend { display: flex; gap: 20px; justify-content: center; padding: 15px; background: #f8fafc; border-radius: 10px; flex-wrap: wrap; }
                    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
                    .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
                    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                    .one-col { display: block; }
                    .market-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                    .market-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
                    .market-name { font-weight: 600; color: #1e293b; margin-bottom: 10px; font-size: 14px; }
                    .market-stats { display: flex; gap: 15px; margin-bottom: 10px; }
                    .market-stat-value { font-size: 20px; font-weight: 700; }
                    .market-stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
                    .market-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
                    .market-bar-fill { height: 100%; border-radius: 4px; }
                    .impressions-box { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); border-radius: 16px; padding: 30px; color: white; }
                    .impressions-title { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; margin-bottom: 15px; }
                    .impressions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
                    .impressions-value { font-size: 32px; font-weight: 700; }
                    .impressions-label { font-size: 12px; opacity: 0.7; }
                    .impressions-note { margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 11px; opacity: 0.6; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th { background: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
                    td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; }
                    tr:hover { background: #f8fafc; }
                    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
                    .status-badge.open { background: #dcfce7; color: #166534; }
                    .status-badge.light { background: #dbeafe; color: #1e40af; }
                    .status-badge.moderate { background: #fef9c3; color: #854d0e; }
                    .status-badge.tight { background: #fed7aa; color: #c2410c; }
                    .status-badge.critical { background: #fecaca; color: #dc2626; }
                    .status-badge.full { background: #ef4444; color: white; }
                    .footer { margin-top: 50px; padding: 30px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
                    .footer-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
                    .footer-left { font-size: 12px; color: #64748b; }
                    .footer-right { font-size: 11px; color: #94a3b8; }
                    .logo-svg { width: 28px; height: 28px; color: white; }
                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .header { padding: 30px; } .content { padding: 30px; } #map { height: 280px; } .kpi-grid { grid-template-columns: repeat(5, 1fr); } }
                </style>
            </head><body>` +
                (includeHeader ? '<div class="header"><div class="header-content">' +
                    '<div class="logo-section">' +
                        '<div class="logo-icon"><svg class="logo-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></div>' +
                        '<div><div class="company-name">Vector Media</div><div class="report-title">OOH Media Availability Report</div></div>' +
                    '</div>' +
                    '<div class="report-subtitle">Comprehensive inventory analysis and market opportunity assessment</div>' +
                    '<div class="header-meta">' +
                        '<div class="meta-item"><div class="meta-label">Market</div><div class="meta-value">' + marketLabel + '</div></div>' +
                        '<div class="meta-item"><div class="meta-label">Media Type</div><div class="meta-value">' + mediaLabel + '</div></div>' +
                        '<div class="meta-item"><div class="meta-label">Flight Period</div><div class="meta-value">' + new Date(rangeStart).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) + ' - ' + new Date(rangeEnd).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) + '</div></div>' +
                        '<div class="meta-item"><div class="meta-label">Report Date</div><div class="meta-value">' + new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}) + '</div></div>' +
                    '</div>' +
                '</div></div>' : '') +
                '<div class="content">' +
                    (includeKpis ? '<div class="kpi-grid">' +
                        '<div class="kpi-card teal"><div class="kpi-value">' + totalInventory.toLocaleString() + '</div><div class="kpi-label">Total Faces</div><div class="kpi-sub">Network Inventory</div></div>' +
                        '<div class="kpi-card green"><div class="kpi-value">' + avgAvail.toLocaleString() + '</div><div class="kpi-label">Avg Available</div><div class="kpi-sub">Faces per period</div></div>' +
                        '<div class="kpi-card blue"><div class="kpi-value">' + avgUtil + '%</div><div class="kpi-label">Avg Utilization</div><div class="kpi-sub">Across date range</div></div>' +
                        '<div class="kpi-card amber"><div class="kpi-value">' + peakUtil + '%</div><div class="kpi-label">Peak Demand</div><div class="kpi-sub">Highest utilization</div></div>' +
                        '<div class="kpi-card purple"><div class="kpi-value">' + (totalImpressionsCalc / 1000000).toFixed(1) + 'M</div><div class="kpi-label">Est. Impressions</div><div class="kpi-sub">Total opportunity</div></div>' +
                    '</div>' : '') +
                    (includeMap ? mapSectionHTML : '') +
                    '<div class="' + ((includeMarketBreakdown && includeImpressions) ? 'two-col' : 'one-col') + '">' +
                        (includeMarketBreakdown ? '<div class="section"><div class="section-header"><div class="section-icon chart"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div><div class="section-title">Market Breakdown</div></div><div class="market-grid">' + marketCardsHTML + '</div></div>' : '') +
                        (includeImpressions ? '<div class="section"><div class="section-header"><div class="section-icon impressions"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></div><div class="section-title">Impression Opportunity</div></div>' +
                            '<div class="impressions-box">' +
                                '<div class="impressions-title">Estimated Reach Potential</div>' +
                                '<div class="impressions-grid">' +
                                    '<div><div class="impressions-value">' + (totalImpressionsCalc / 1000000).toFixed(1) + 'M</div><div class="impressions-label">Total Network Impressions</div></div>' +
                                    '<div><div class="impressions-value">' + (availImpressionsCalc / 1000000).toFixed(1) + 'M</div><div class="impressions-label">Available Impressions</div></div>' +
                                    '<div><div class="impressions-value">' + Math.round(avgWeeklyImpressions / 1000).toLocaleString() + 'K</div><div class="impressions-label">Weekly Reach (Full Network)</div></div>' +
                                    '<div><div class="impressions-value">' + weeksInRange + '</div><div class="impressions-label">Weeks in Flight Period</div></div>' +
                                '</div>' +
                                '<div class="impressions-note">* Impressions estimated using Geopath-equivalent methodology. Actual delivery may vary.</div>' +
                            '</div>' +
                        '</div>' : '') +
                    '</div>' +
                    (includeTable ? '<div class="section"><div class="section-header"><div class="section-icon table"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div><div class="section-title">Availability by Period</div></div>' +
                        '<table><thead><tr><th>Period</th><th style="text-align:right">Booked</th><th style="text-align:right">Confirmed</th><th style="text-align:right">On Hold</th><th style="text-align:right">Available</th><th style="text-align:right">Utilization</th><th style="text-align:right">Est. Impressions</th><th>Status</th></tr></thead>' +
                        '<tbody>' + tableRowsHTML + '</tbody></table>' +
                        (dataToExport.length > 50 ? '<p style="color:#94a3b8;font-size:11px;margin-top:12px;text-align:center;">Showing 50 of ' + dataToExport.length + ' periods. Export CSV for complete data.</p>' : '') +
                    '</div>' : '') +
                '</div>' +
                '<div class="footer"><div class="footer-content">' +
                    '<div class="footer-left"><strong>Vector Media</strong> • OOH Media Availability Report<br>For questions, contact your account representative</div>' +
                    '<div class="footer-right">Generated ' + new Date().toLocaleString() + '<br>CONFIDENTIAL - For planning purposes only</div>' +
                '</div></div>' +
                mapScriptHTML +
            '</body></html>');
            printWindow.document.close();
            setShowPdfOptions(false);
        };

        return (
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none overflow-auto' : ''}`}>
                {/* Inventory Reminder Notification */}
                {showInventoryReminder && (
                    <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2">
                            <span className="text-amber-600 text-lg">💡</span>
                            <p className="text-sm text-amber-800">
                                <strong>Reminder:</strong> Adjust the <span className="font-bold text-amber-900">Inventory Total</span> below if needed (default: <span className="font-bold">9,150</span>).
                            </p>
                        </div>
                        <button
                            onClick={() => setShowInventoryReminder(false)}
                            className="text-amber-600 hover:text-amber-800 p-1"
                            title="Dismiss"
                        >
                            <Icon name="X" size={16} />
                        </button>
                    </div>
                )}

                {/* HEADER with View Toggle */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600">
                                Viewing: <strong>{
                                    selectedMarket === 'ALL' ? 'All Markets' : 
                                    selectedMarket.startsWith('REGION:') ? `${selectedMarket.replace('REGION:', '')} Region` :
                                    selectedMarket.split(',')[0]
                                }</strong> • 
                                <strong>{
                                    selectedMedia === 'ALL' ? 'All Media' : 
                                    selectedMedia.startsWith('CATEGORY:') ? `${selectedMedia.replace('CATEGORY:', '')} Media` :
                                    selectedMedia
                                }</strong> • 
                                <span className="text-blue-600 font-bold">{totalInventory.toLocaleString()} Faces</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Chart View Toggle */}
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button onClick={() => setChartView('timeline')} className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${chartView === 'timeline' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <Icon name="BarChart" size={14} /> Timeline
                                </button>
                                <button onClick={() => setChartView('map')} className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${chartView === 'map' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <Icon name="MapPin" size={14} /> Map
                                </button>
                                <button onClick={() => setChartView('geopath')} className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${chartView === 'geopath' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <Icon name="Target" size={14} /> Geopath
                                </button>
                            </div>
                            {/* Fullscreen Toggle */}
                            <button 
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all border ${isFullscreen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}`}
                                title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                            >
                                <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} size={14} />
                                {isFullscreen ? 'Exit' : 'Expand'}
                            </button>
                            
                            {/* Export Dropdown */}
                            <div className="relative group">
                                <button 
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all border bg-white text-gray-600 border-gray-300 hover:border-teal-400 hover:text-teal-600"
                                    title="Export availability report"
                                >
                                    <Icon name="Download" size={14} />
                                    Export
                                    <Icon name="ChevronDown" size={12} />
                                </button>
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
                                    <div className="px-3 py-2 border-b border-gray-100">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Export Options</div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            // Export CSV - uses filtered data based on current selections
                                            const dataToExport = viewMode === 'weekly' ? weeklyData : viewMode === 'monthly' ? monthlyData : viewMode === 'yearly' ? yearlyData : utilizationData;
                                            const headers = ['Date', 'Booked', 'Confirmed', 'On Hold', 'Available', 'Total Inventory', 'Utilization %', 'Status', 'Market Filter', 'Media Filter'];
                                            const rows = dataToExport.map(d => [
                                                d.weekLabel || d.dayName || d.monthLabel || d.yearLabel,
                                                d.booked || d.avgBooked || 0,
                                                d.confirmedUnits || d.avgConfirmed || 0,
                                                d.holdUnits || d.avgHolds || 0,
                                                d.available || d.avgAvailable || 0,
                                                totalInventory,
                                                (d.utilizationPct || d.avgUtilization || 0).toFixed(1) + '%',
                                                d.status || '',
                                                selectedMarket === 'ALL' ? 'All Markets' : selectedMarket,
                                                selectedMedia === 'ALL' ? 'All Media' : selectedMedia
                                            ]);
                                            const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
                                            const blob = new Blob([csvContent], { type: 'text/csv' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `Availability_Report_${selectedMarket === 'ALL' ? 'All_Markets' : selectedMarket.replace(/[^a-z0-9]/gi, '_')}_${rangeStart}_to_${rangeEnd}.csv`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                    >
                                        <Icon name="FileSpreadsheet" size={16} className="text-green-600" />
                                        Export as CSV
                                    </button>
                                    <button 
                                        onClick={() => setShowPdfOptions(true)}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 border-t border-gray-100"
                                    >
                                        <Icon name="FileText" size={16} className="text-red-500" />
                                        Export as PDF...
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* PDF Options Modal */}
                {showPdfOptions && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPdfOptions(false)}>
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-teal-100 rounded-lg">
                                        <Icon name="FileText" size={20} className="text-teal-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">PDF Report Options</h3>
                                        <p className="text-xs text-gray-500">Select sections to include</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowPdfOptions(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <Icon name="X" size={20} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        checked={pdfOptions.includeHeader}
                                        onChange={e => setPdfOptions({...pdfOptions, includeHeader: e.target.checked})}
                                        className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            <Icon name="LayoutTemplate" size={16} className="text-gray-400" />
                                            Report Header
                                        </div>
                                        <div className="text-xs text-gray-500">Company branding, title, meta info</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        checked={pdfOptions.includeKpis}
                                        onChange={e => setPdfOptions({...pdfOptions, includeKpis: e.target.checked})}
                                        className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            <Icon name="BarChart3" size={16} className="text-gray-400" />
                                            KPI Summary Cards
                                        </div>
                                        <div className="text-xs text-gray-500">Total faces, utilization, impressions</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        checked={pdfOptions.includeMap}
                                        onChange={e => setPdfOptions({...pdfOptions, includeMap: e.target.checked})}
                                        className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            <Icon name="Map" size={16} className="text-gray-400" />
                                            Market Coverage Map
                                        </div>
                                        <div className="text-xs text-gray-500">Interactive map with utilization markers</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        checked={pdfOptions.includeMarketBreakdown}
                                        onChange={e => setPdfOptions({...pdfOptions, includeMarketBreakdown: e.target.checked})}
                                        className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            <Icon name="MapPin" size={16} className="text-gray-400" />
                                            Market Breakdown
                                        </div>
                                        <div className="text-xs text-gray-500">Per-market booked/available stats</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        checked={pdfOptions.includeImpressions}
                                        onChange={e => setPdfOptions({...pdfOptions, includeImpressions: e.target.checked})}
                                        className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            <Icon name="Eye" size={16} className="text-gray-400" />
                                            Impression Opportunity
                                        </div>
                                        <div className="text-xs text-gray-500">Estimated reach and weekly impressions</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200">
                                    <input 
                                        type="checkbox" 
                                        checked={pdfOptions.includeTable}
                                        onChange={e => setPdfOptions({...pdfOptions, includeTable: e.target.checked})}
                                        className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            <Icon name="Table" size={16} className="text-gray-400" />
                                            Availability Table
                                        </div>
                                        <div className="text-xs text-gray-500">Detailed period-by-period data</div>
                                    </div>
                                </label>
                            </div>
                            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-gray-50 rounded-b-xl">
                                <button 
                                    onClick={() => setShowPdfOptions(false)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => generateAvailabilityPDF(pdfOptions)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2"
                                >
                                    <Icon name="Download" size={16} />
                                    Generate PDF
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* FILTERS - Clean Organized Layout (Hidden in fullscreen) */}
                {!isFullscreen && (
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Filter By Section */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Filter By</label>
                            <div className="flex items-center gap-2">
                                <select 
                                    value={selectedMarket} 
                                    onChange={e => { setSelectedMarket(e.target.value); setInventoryOverride(null); }}
                                    className="text-sm font-medium border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
                                >
                                    <option value="ALL">All Markets</option>
                                    <optgroup label="📍 Regions">
                                        <option value="REGION:West Coast">West Coast</option>
                                        <option value="REGION:East Coast">East Coast</option>
                                        <option value="REGION:Southwest">Southwest</option>
                                        <option value="REGION:Southeast">Southeast</option>
                                        <option value="REGION:Midwest">Midwest</option>
                                    </optgroup>
                                    <optgroup label="📌 Individual Markets">
                                        {markets.filter(m => m !== 'ALL').map(m => (
                                            <option key={m} value={m}>{m.split(',')[0]}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <select 
                                    value={selectedMedia} 
                                    onChange={e => { setSelectedMedia(e.target.value); setInventoryOverride(null); }}
                                    className="text-sm font-medium border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none min-w-[180px]"
                                >
                                    <option value="ALL">All Media Types</option>
                                    <optgroup label="📦 Categories">
                                        <option value="CATEGORY:Digital">All Digital</option>
                                        <option value="CATEGORY:Static">All Static Panels</option>
                                        <option value="CATEGORY:Premium">Premium Units</option>
                                    </optgroup>
                                    <optgroup label="📋 Individual Media">
                                        {mediaTypes.filter(m => m !== 'ALL').map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                        
                        {/* ZIP Code Filter (LA Only) - INFORMATIONAL for impressions reference */}
                        {(selectedMarket === 'ALL' || selectedMarket.includes('Los Angeles') || selectedMarket === 'REGION:West Coast') && (
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Icon name="MapPin" size={10} /> ZIP Impressions Ref
                                </label>
                                <div className="relative">
                                    <select 
                                        value={selectedZip} 
                                        onChange={e => setSelectedZip(e.target.value)}
                                        className="text-sm font-medium border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-w-[180px] appearance-none pr-8"
                                    >
                                        <option value="">All ZIP Codes</option>
                                        <optgroup label="🏙️ Downtown / Central">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Downtown', 'South Park', 'Industrial District', 'Financial District'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🎬 Hollywood">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => d.area.includes('Hollywood') || d.area.includes('West Hollywood')).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🏮 Koreatown / Mid-City">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Koreatown', 'Mid-Wilshire', 'Mid-City', 'Park La Brea', 'Los Feliz'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🌴 Westside">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Westwood', 'West LA', 'Palms', 'Beverlywood', 'Beverly Grove', 'Brentwood', 'Rancho Park', 'Century City', 'Bel Air', 'Beverly Hills'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🏖️ Beach Cities">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Venice', 'Marina del Rey', 'Playa del Rey', 'Santa Monica', 'Mar Vista', 'Playa Vista'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🏠 Northeast LA">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Echo Park', 'Silver Lake', 'Eagle Rock', 'Highland Park', 'Glassell Park', 'Lincoln Heights', 'El Sereno', 'Thai Town'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🌆 East LA / Boyle Heights">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => d.area.includes('East LA') || d.area.includes('Boyle Heights')).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🏘️ South LA">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Florence', 'Watts', 'South Central', 'Baldwin Hills', 'West Adams', 'Jefferson Park', 'View Park', 'Willowbrook', 'Ladera Heights'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="🌳 San Fernando Valley">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Van Nuys', 'North Hollywood', 'Studio City', 'Sherman Oaks', 'Encino', 'Tarzana', 'Woodland Hills', 'Canoga Park', 'Winnetka', 'Northridge', 'Granada Hills', 'Pacoima', 'Sylmar', 'Reseda', 'Panorama City', 'Sun Valley', 'Sunland', 'Tujunga', 'Valley Village', 'North Hills', 'Mission Hills', 'Chatsworth', 'Porter Ranch', 'West Hills', 'San Fernando'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="⚓ Harbor / South Bay">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['San Pedro', 'Wilmington', 'Harbor City', 'Carson', 'Torrance', 'Gardena', 'Hawthorne', 'Lawndale', 'Inglewood', 'Lennox', 'Lomita', 'Long Beach'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="✈️ Culver City / LAX">
                                            {Object.entries(LA_ZIP_DATA).filter(([z, d]) => ['Culver City', 'Westchester'].includes(d.area)).map(([zip, data]) => (
                                                <option key={zip} value={zip}>{zip} - {data.area}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Icon name="ChevronDown" size={14} className="text-gray-400" />
                                    </div>
                                </div>
                                {/* Compact indicator when selected */}
                                {selectedZip && LA_ZIP_DATA[selectedZip] && (
                                    <div className="text-[10px] mt-1 text-emerald-600 font-medium">
                                        ✓ See impressions reference below
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Inventory Section */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Inventory</label>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1">
                                    <span className="text-xs text-gray-500 mr-1.5">Total:</span>
                                    <input 
                                        type="number" 
                                        value={inventoryOverride || totalInventory} 
                                        onChange={e => setInventoryOverride(parseInt(e.target.value) || null)} 
                                        className="w-16 text-sm font-bold text-gray-800 outline-none"
                                    />
                                </div>
                                <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                                    <span className="text-xs text-blue-600 mr-1.5">Need:</span>
                                    <input 
                                        type="number" 
                                        value={requiredSize} 
                                        onChange={e => setRequiredSize(parseInt(e.target.value) || 0)} 
                                        className="w-12 text-sm font-bold text-blue-700 outline-none bg-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Date Range Section with Quick Presets */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Date Range</label>
                            <div className="flex items-center gap-2">
                                {/* Back arrow */}
                                <button
                                    onClick={() => {
                                        const start = new Date(rangeStart + 'T00:00:00');
                                        const end = new Date(rangeEnd + 'T00:00:00');
                                        start.setMonth(start.getMonth() - 1);
                                        end.setMonth(end.getMonth() - 1);
                                        setRangeStart(start.toISOString().split('T')[0]);
                                        setRangeEnd(end.toISOString().split('T')[0]);
                                    }}
                                    className="p-1.5 bg-gray-100 hover:bg-blue-100 rounded border border-gray-200 transition-all"
                                    title="Previous month"
                                >
                                    <Icon name="ChevronLeft" size={14} className="text-gray-600" />
                                </button>
                                
                                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1">
                                    <Icon name="Calendar" size={14} className="text-gray-400" />
                                    <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="bg-transparent font-medium text-gray-700 outline-none text-sm"/>
                                    <span className="text-gray-400">→</span>
                                    <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="bg-transparent font-medium text-gray-700 outline-none text-sm"/>
                                </div>
                                
                                {/* Forward arrow */}
                                <button
                                    onClick={() => {
                                        const start = new Date(rangeStart + 'T00:00:00');
                                        const end = new Date(rangeEnd + 'T00:00:00');
                                        start.setMonth(start.getMonth() + 1);
                                        end.setMonth(end.getMonth() + 1);
                                        setRangeStart(start.toISOString().split('T')[0]);
                                        setRangeEnd(end.toISOString().split('T')[0]);
                                    }}
                                    className="p-1.5 bg-gray-100 hover:bg-blue-100 rounded border border-gray-200 transition-all"
                                    title="Next month"
                                >
                                    <Icon name="ChevronRight" size={14} className="text-gray-600" />
                                </button>
                                
                                {/* Quick Date Presets */}
                                <div className="flex items-center gap-1">
                                    {[
                                        { label: 'This Mo', getRange: () => {
                                            const now = new Date();
                                            return { 
                                                start: new Date(now.getFullYear(), now.getMonth(), 1),
                                                end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                                            };
                                        }},
                                        { label: 'Next Mo', getRange: () => {
                                            const now = new Date();
                                            return { 
                                                start: new Date(now.getFullYear(), now.getMonth() + 1, 1),
                                                end: new Date(now.getFullYear(), now.getMonth() + 2, 0)
                                            };
                                        }},
                                        { label: '+2 Mo', getRange: () => {
                                            const now = new Date();
                                            return { 
                                                start: new Date(now.getFullYear(), now.getMonth() + 2, 1),
                                                end: new Date(now.getFullYear(), now.getMonth() + 3, 0)
                                            };
                                        }},
                                        { label: '90 Days', getRange: () => {
                                            const now = new Date();
                                            const end = new Date(now);
                                            end.setDate(end.getDate() + 90);
                                            return { start: now, end };
                                        }},
                                        { label: '6 Mo', getRange: () => {
                                            const now = new Date();
                                            const end = new Date(now);
                                            end.setMonth(end.getMonth() + 6);
                                            return { start: now, end };
                                        }},
                                        { label: '2026', getRange: () => {
                                            return { 
                                                start: new Date(2026, 0, 1),
                                                end: new Date(2026, 11, 31)
                                            };
                                        }},
                                    ].map((preset, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                const { start, end } = preset.getRange();
                                                setRangeStart(start.toISOString().split('T')[0]);
                                                setRangeEnd(end.toISOString().split('T')[0]);
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded border border-gray-200 transition-all"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Options Section */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Options</label>
                            <div className="flex items-center gap-2">
                                {/* Holds Toggle - Redesigned for clarity */}
                                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                                    <button 
                                        onClick={() => setIncludeHolds(true)}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${includeHolds ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                        title="Show all bookings including pending holds - conservative availability view"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                        All Bookings
                                    </button>
                                    <button 
                                        onClick={() => setIncludeHolds(false)}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${!includeHolds ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                        title="Show only confirmed bookings - optimistic availability view (holds may convert)"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Confirmed Only
                                    </button>
                                </div>
                                <div className="flex bg-white border border-gray-300 rounded-lg p-0.5">
                                    <button onClick={() => setViewMode('daily')} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'daily' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Day</button>
                                    <button onClick={() => setViewMode('weekly')} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'weekly' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Week</button>
                                    <button onClick={() => setViewMode('monthly')} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'monthly' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Month</button>
                                    <button onClick={() => setViewMode('yearly')} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'yearly' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Year</button>
                                </div>
                                {/* Reset Button - inline with options */}
                                <button 
                                    onClick={() => {
                                        setSelectedMarket('ALL');
                                        setSelectedMedia('ALL');
                                        setSelectedZip(''); // Reset ZIP filter
                                        setInventoryOverride(null);
                                        setRequiredSize(50);
                                        setIncludeHolds(true);
                                        setViewMode('daily');
                                        setSortByImpressions(false); // Reset impressions sort
                                        // Reset dates to default (today + 90 days)
                                        const today = new Date();
                                        const day = today.getDay();
                                        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                                        const monday = new Date(today.setDate(diff));
                                        setRangeStart(monday.toISOString().split('T')[0]);
                                        const futureDate = new Date();
                                        futureDate.setDate(futureDate.getDate() + 90);
                                        setRangeEnd(futureDate.toISOString().split('T')[0]);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all flex items-center gap-1"
                                    title="Reset all filters to defaults"
                                >
                                    <Icon name="RotateCcw" size={12} />
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                )}
                
                {/* CONTENT AREA */}
                <div className={isFullscreen ? "p-2" : "p-4"}>
                
                {/* ZIP IMPRESSIONS BANNER - Hidden in fullscreen */}
                {!isFullscreen && selectedZip && LA_ZIP_DATA[selectedZip] && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                                        {selectedZip.slice(-2)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                                            {LA_ZIP_DATA[selectedZip].area}
                                            <span className="text-[10px] font-normal px-1.5 py-0.5 bg-emerald-200 text-emerald-700 rounded">📊 Reference</span>
                                        </div>
                                        <div className="text-xs text-emerald-600">ZIP {selectedZip} • {LA_ZIP_DATA[selectedZip].pop.toLocaleString()} pop • {LA_ZIP_DATA[selectedZip].sqMi} mi² • <span className="italic">Est. weekly impressions per unit</span></div>
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-emerald-200"></div>
                                <div className="text-center">
                                    <div className="text-xs text-emerald-600 font-medium">Pop Density</div>
                                    <div className="text-xl font-bold text-emerald-700">{Math.round(LA_ZIP_DATA[selectedZip].pop / LA_ZIP_DATA[selectedZip].sqMi).toLocaleString()}/mi²</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Impressions by product for this ZIP */}
                                {(() => {
                                    const density = LA_ZIP_DATA[selectedZip].pop / LA_ZIP_DATA[selectedZip].sqMi;
                                    const baseImps = Math.round(density * 0.75);
                                    return (
                                        <>
                                            <div className="text-center px-3 py-1 bg-white rounded-lg border border-emerald-200">
                                                <div className="text-[10px] text-gray-500">Digital</div>
                                                <div className="font-bold text-emerald-700">{(baseImps * 2.8 / 1000).toFixed(0)}K</div>
                                            </div>
                                            <div className="text-center px-3 py-1 bg-white rounded-lg border border-emerald-200">
                                                <div className="text-[10px] text-gray-500">Panel</div>
                                                <div className="font-bold text-emerald-700">{(baseImps * 1.15 / 1000).toFixed(0)}K</div>
                                            </div>
                                            <div className="text-center px-3 py-1 bg-white rounded-lg border border-emerald-200">
                                                <div className="text-[10px] text-gray-500">Transit</div>
                                                <div className="font-bold text-emerald-700">{(baseImps * 0.65 / 1000).toFixed(0)}K</div>
                                            </div>
                                        </>
                                    );
                                })()}
                                <button 
                                    onClick={() => setSelectedZip('')}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                    title="Clear ZIP selection"
                                >
                                    <Icon name="X" size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* MARKET SUMMARY CARDS - Hidden in fullscreen */}
                {!isFullscreen && (
                <div className="mb-4 grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {marketSummary.slice(0, 6).map((m, idx) => (
                        <button 
                            key={m.market}
                            onClick={() => setSelectedMarket(m.market)}
                            className={`p-2 rounded-lg border text-left transition-all hover:shadow ${selectedMarket === m.market ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        >
                            <div className="text-[9px] font-bold text-gray-500 uppercase truncate">{m.market.split(',')[0]}</div>
                            <div className="text-base font-bold text-gray-800">{m.booked}</div>
                            <div className="text-[9px] text-gray-500">{m.campaigns} flights</div>
                        </button>
                    ))}
                </div>
                )}
                
                {/* View Mode Info Banner */}
                {!isFullscreen && !includeHolds && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                        <Icon name="Info" size={14} className="text-blue-600 flex-shrink-0" />
                        <span className="text-xs text-blue-700">
                            <strong>Confirmed Only view:</strong> Showing only contracted bookings. Pending holds ({filteredData.filter(d => d.stage?.includes('Hold') || d.stage?.includes('Pending')).length} flights) are hidden — actual availability may be lower if holds convert.
                        </span>
                        <button 
                            onClick={() => setIncludeHolds(true)}
                            className="ml-auto px-2 py-1 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700 transition-all flex-shrink-0"
                        >
                            Show All
                        </button>
                    </div>
                )}

                {/* RECOMMENDATIONS BAR - Hidden in fullscreen */}
                {!isFullscreen && bestOpeningsByMedia.recommendations.length > 0 && (
                    <div className="mb-3 p-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 overflow-x-auto text-xs">
                                {bestOpeningsByMedia.recommendations.slice(0, 2).map((rec, idx) => (
                                    <div key={idx} className="flex items-center gap-1 whitespace-nowrap">
                                        <span>{rec.icon}</span>
                                        <span className="font-semibold text-green-800">{rec.title}:</span>
                                        <span className="text-green-700 truncate max-w-[200px]">{rec.message}</span>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => setShowOpeningsPanel(!showOpeningsPanel)}
                                className="px-2 py-1 bg-green-600 text-white text-[11px] font-bold rounded hover:bg-green-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                            >
                                <Icon name="Search" size={12} />
                                {showOpeningsPanel ? 'Hide' : 'Find Openings'}
                            </button>
                        </div>
                    </div>
                )}

                {/* BEST OPENINGS PANEL (Expandable) - Hidden in fullscreen */}
                {!isFullscreen && showOpeningsPanel && (
                    <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 text-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        <Icon name="Search" size={20} /> Best Openings Finder
                                    </h3>
                                    <p className="text-green-100 text-sm">Finding windows for {requiredSize}+ units • {rangeStart} to {rangeEnd}</p>
                                </div>
                                <button onClick={() => setShowOpeningsPanel(false)} className="p-1 hover:bg-white/20 rounded">
                                    <Icon name="X" size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-5 gap-3 mb-4">
                                <div className="bg-blue-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-blue-700">{bestOpeningsByMedia.byMedia.filter(m => m.shortTerm.length > 0).length}</div>
                                    <div className="text-xs text-blue-600">Media w/ Short-Term</div>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-purple-700">{bestOpeningsByMedia.byMedia.filter(m => m.longTerm.length > 0).length}</div>
                                    <div className="text-xs text-purple-600">Media w/ Long-Term</div>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-green-700">{bestOpeningsByMedia.byMarket.length}</div>
                                    <div className="text-xs text-green-600">Markets w/ Space</div>
                                </div>
                                <div className="bg-amber-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-amber-700">{bestOpeningsByMedia.byMedia.filter(m => m.hasImmediate).length}</div>
                                    <div className="text-xs text-amber-600">Immediate Options</div>
                                </div>
                                <button 
                                    onClick={() => setSortByImpressions(!sortByImpressions)}
                                    className={`p-3 rounded-lg text-center transition-all ${sortByImpressions ? 'bg-emerald-100 border-2 border-emerald-400' : 'bg-emerald-50 hover:bg-emerald-100'}`}
                                    title="Impressions if you sell the available inventory"
                                >
                                    <div className="text-2xl font-bold text-emerald-700">
                                        {(() => {
                                            // Calculate based on ACTUAL available inventory
                                            const avgAvailable = utilizationData.length > 0 
                                                ? Math.round(utilizationData.reduce((sum, d) => sum + d.available, 0) / utilizationData.length)
                                                : 0;
                                            const weeksInRange = utilizationData.length / 7;
                                            const weeklyImpRate = selectedMedia.includes('Digital') ? 45000 : 15000;
                                            const totalImps = avgAvailable * weeklyImpRate * weeksInRange;
                                            
                                            if (totalImps >= 1000000000) return `${(totalImps / 1000000000).toFixed(1)}B`;
                                            if (totalImps >= 1000000) return `${(totalImps / 1000000).toFixed(0)}M`;
                                            if (totalImps >= 1000) return `${Math.round(totalImps / 1000)}K`;
                                            return totalImps.toString();
                                        })()}
                                    </div>
                                    <div className="text-xs text-emerald-600">{sortByImpressions ? '✓ Sorted by Imps' : 'Sellable Imps'}</div>
                                </button>
                            </div>

                            {/* Tabs for Short-Term vs Long-Term */}
                            <div className="flex gap-2 mb-4 border-b">
                                <button 
                                    onClick={() => setViewMode('daily')}
                                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${viewMode === 'daily' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    🚀 Short-Term (1-4 weeks)
                                </button>
                                <button 
                                    onClick={() => setViewMode('weekly')}
                                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${viewMode === 'weekly' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    📅 Long-Term (4+ weeks)
                                </button>
                            </div>

                            {/* Openings by Media Type */}
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {(sortByImpressions ? bestOpeningsByMedia.byImpressions : bestOpeningsByMedia.byMedia)
                                    .filter(m => viewMode === 'daily' ? m.shortTerm.length > 0 : m.longTerm.length > 0)
                                    .map((media, idx) => {
                                        const openings = viewMode === 'daily' ? media.shortTerm : media.longTerm;
                                        const impTotal = media.impressions?.rangeTotal || 0;
                                        const impDisplay = impTotal >= 1000000000 
                                            ? `${(impTotal / 1000000000).toFixed(1)}B`
                                            : impTotal >= 1000000 
                                                ? `${(impTotal / 1000000).toFixed(1)}M` 
                                                : `${Math.round(impTotal / 1000)}K`;
                                        return (
                                            <div key={idx} className={`border rounded-lg p-3 hover:border-gray-300 transition-colors ${sortByImpressions && idx === 0 ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-200'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`w-2 h-2 rounded-full ${media.availabilityScore > 70 ? 'bg-green-500' : media.availabilityScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                                                        <span className="font-semibold text-gray-800">{media.media}</span>
                                                        {media.hasImmediate && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">NOW</span>}
                                                        {sortByImpressions && idx === 0 && <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded">🏆 TOP IMPS</span>}
                                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">{media.impressions?.tier || 'Standard'}</span>
                                                    </div>
                                                    <div className="text-right flex items-center gap-3">
                                                        {/* Impressions Estimate - for selected date range */}
                                                        <div className="flex flex-col items-end" title={`${media.totalAvailableDays || 0} available days × ${media.impressions?.avgAvailableUnits || 0} avg units`}>
                                                            <span className="text-[10px] text-emerald-600 font-medium">Range Imps</span>
                                                            <span className="font-bold text-emerald-700">~{impDisplay}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-gray-500">Avail</span>
                                                            <span className={`font-bold ${media.availabilityScore > 70 ? 'text-green-600' : media.availabilityScore > 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                {media.availabilityScore}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                    {openings.map((gap, gIdx) => {
                                                        // Calculate impressions for this specific gap
                                                        const gapImps = Math.round((media.impressions?.weeklyPerUnit || 20000) * gap.avgAvail * (gap.length / 7));
                                                        const gapImpDisplay = gapImps >= 1000000 
                                                            ? `${(gapImps / 1000000).toFixed(1)}M` 
                                                            : `${Math.round(gapImps / 1000)}K`;
                                                        return (
                                                            <div 
                                                                key={gIdx} 
                                                                className={`p-2 rounded-lg text-xs ${gIdx === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}
                                                            >
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="font-bold text-gray-700">
                                                                        {Math.floor(gap.length / 7)} weeks
                                                                    </span>
                                                                    {gIdx === 0 && <span className="text-green-600 text-[10px] font-bold">BEST</span>}
                                                                </div>
                                                                <div className="text-gray-600">
                                                                    {gap.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {gap.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </div>
                                                                <div className="text-gray-500 mt-1">
                                                                    {gap.avgAvail} avg units • <span className="text-emerald-600 font-semibold">~{gapImpDisplay} imps</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                
                                {bestOpeningsByMedia.byMedia.filter(m => viewMode === 'daily' ? m.shortTerm.length > 0 : m.longTerm.length > 0).length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <Icon name="AlertCircle" size={32} className="mx-auto mb-2 text-gray-400" />
                                        <p>No {viewMode === 'daily' ? 'short-term (1-4 week)' : 'long-term (4+ week)'} openings found for {requiredSize}+ units</p>
                                        <p className="text-sm mt-1">Try reducing the required units or expanding your date range</p>
                                    </div>
                                )}
                            </div>

                            {/* Market Availability Section */}
                            {bestOpeningsByMedia.byMarket.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <Icon name="MapPin" size={16} className="text-blue-600" /> Markets with Available Space
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {bestOpeningsByMedia.byMarket.map((market, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => { setSelectedMarket(market.market); setShowOpeningsPanel(false); }}
                                                className={`p-2 rounded-lg text-left text-xs border transition-all hover:shadow-md ${
                                                    market.utilization < 50 ? 'bg-green-50 border-green-200 hover:border-green-400' :
                                                    market.utilization < 70 ? 'bg-blue-50 border-blue-200 hover:border-blue-400' :
                                                    'bg-amber-50 border-amber-200 hover:border-amber-400'
                                                }`}
                                            >
                                                <div className="font-semibold text-gray-800 truncate">{market.market.split(',')[0]}</div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-gray-500">{market.available} avail</span>
                                                    <span className={`font-bold ${market.utilization < 50 ? 'text-green-600' : market.utilization < 70 ? 'text-blue-600' : 'text-yellow-600'}`}>
                                                        {100 - market.utilization}% open
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* GAP ANALYSIS SUMMARY - Hidden in fullscreen */}
                {!isFullscreen && (
                <div className="mb-3">
                    {/* Quick Reference Toggle */}
                    <div className="flex justify-end mb-1">
                        <button 
                            onClick={() => setShowMetricsHelp(!showMetricsHelp)}
                            className="text-[10px] text-gray-500 hover:text-blue-600 flex items-center gap-1"
                        >
                            <Icon name="HelpCircle" size={12} />
                            {showMetricsHelp ? 'Hide' : 'What do these mean?'}
                        </button>
                    </div>
                    
                    {/* Metrics Help Panel */}
                    {showMetricsHelp && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px]">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <span className="font-bold text-green-700">🔍 OPENINGS:</span>
                                    <p className="text-gray-600">Number of media types (products) with availability gaps that fit your "Need" requirement.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-blue-700">✓ BEST WINDOW:</span>
                                    <p className="text-gray-600">Longest continuous period with enough availability to book your requested units.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-purple-700">📦 SELLABLE:</span>
                                    <p className="text-gray-600">Count of availability gaps: "4+wk" = full flight opportunities, "1-3wk" = shorter fills.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-indigo-700">📊 AVG UTIL:</span>
                                    <p className="text-gray-600">Average % of inventory booked across selected date range. Higher = busier.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-amber-700">📈 PEAK:</span>
                                    <p className="text-gray-600">Highest single-day booking count. Shows your busiest day in the range.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-emerald-700">📣 SELLABLE IMPS:</span>
                                    <p className="text-gray-600">Impressions you can deliver if you sell available inventory. Shows avg available units × ~15K weekly imps (static) or ~45K (digital) × weeks.</p>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-blue-200">
                                <span className="font-bold text-gray-700">📋 BOOKING VIEW OPTIONS:</span>
                                <div className="flex gap-4 mt-1">
                                    <div className="flex items-start gap-1">
                                        <span className="w-2 h-2 mt-1 rounded-full bg-orange-400 flex-shrink-0"></span>
                                        <p className="text-gray-600"><strong>All Bookings:</strong> Includes confirmed + pending holds. Conservative view — shows less availability.</p>
                                    </div>
                                    <div className="flex items-start gap-1">
                                        <span className="w-2 h-2 mt-1 rounded-full bg-blue-500 flex-shrink-0"></span>
                                        <p className="text-gray-600"><strong>Confirmed Only:</strong> Shows only contracted bookings. Optimistic view — holds may convert and reduce actual availability.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <button 
                        onClick={() => setShowOpeningsPanel(!showOpeningsPanel)}
                        className={`p-2 border rounded-lg transition-all hover:shadow ${showOpeningsPanel ? 'bg-green-100 border-green-400' : 'bg-green-50 border-green-200'}`}
                        title="Media types with availability gaps fitting your Need requirement"
                    >
                        <h4 className="text-[9px] font-bold uppercase flex items-center gap-1 text-green-700">
                            <Icon name="Search" size={10}/> Openings
                        </h4>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-green-700">{bestOpeningsByMedia.byMedia.filter(m => m.bestGap).length}</span>
                            <span className="text-[10px] text-green-600">media types</span>
                        </div>
                    </button>

                    <div 
                        className={`p-2 border rounded-lg ${gaps[0] ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}
                        title="Longest continuous period with enough availability"
                    >
                        <h4 className="text-[9px] font-bold uppercase flex items-center gap-1 text-blue-700">
                            <Icon name="CheckCircle" size={10}/> Best Window
                        </h4>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-blue-700">{gaps[0] ? Math.floor(gaps[0].length / 7) : 0}</span>
                            <span className="text-[10px] text-blue-600">weeks</span>
                        </div>
                    </div>

                    <div 
                        className="p-2 bg-purple-50 border border-purple-200 rounded-lg"
                        title="Availability gaps: 4+wk = full flights, 1-3wk = shorter fills"
                    >
                        <h4 className="text-[9px] font-bold text-purple-700 uppercase">Sellable</h4>
                        <div className="text-[10px] text-purple-900">
                            <span className="font-bold">{gaps.filter(g => g.length >= 28).length}</span> 4+wk • 
                            <span className="font-bold ml-1">{gaps.filter(g => g.length >= 7 && g.length < 28).length}</span> 1-3wk
                        </div>
                    </div>

                    <div 
                        className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg"
                        title="Average % of inventory booked in this date range"
                    >
                        <h4 className="text-[9px] font-bold text-indigo-700 uppercase">Avg Util</h4>
                        <div className="text-xl font-bold text-indigo-700">
                            {utilizationData.length > 0 ? Math.round(utilizationData.reduce((sum, d) => sum + d.utilizationPct, 0) / utilizationData.length) : 0}%
                        </div>
                    </div>

                    <div 
                        className="p-2 bg-amber-50 border border-amber-200 rounded-lg"
                        title="Highest single-day booking in this range"
                    >
                        <h4 className="text-[9px] font-bold text-amber-700 uppercase">Peak</h4>
                        <div className="text-xl font-bold text-amber-700">
                            {utilizationData.length > 0 ? Math.max(...utilizationData.map(d => d.booked)) : 0}
                        </div>
                    </div>
                    
                    {/* Sellable Impressions Card - Based on ACTUAL available inventory */}
                    <button 
                        onClick={() => { setSortByImpressions(true); setShowOpeningsPanel(true); }}
                        className={`p-2 border rounded-lg transition-all hover:shadow ${sortByImpressions ? 'bg-emerald-100 border-emerald-400' : 'bg-emerald-50 border-emerald-200'}`}
                        title="Impressions you can deliver if you sell the available inventory"
                    >
                        <h4 className="text-[9px] font-bold uppercase flex items-center gap-1 text-emerald-700">
                            <Icon name="TrendingUp" size={10}/> Sellable Imps
                        </h4>
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-emerald-700">
                                    {(() => {
                                        // Calculate based on ACTUAL available inventory from timeline
                                        const avgAvailable = utilizationData.length > 0 
                                            ? Math.round(utilizationData.reduce((sum, d) => sum + d.available, 0) / utilizationData.length)
                                            : 0;
                                        const weeksInRange = utilizationData.length / 7;
                                        // Use a base weekly impressions rate (~15,000 per unit per week for static)
                                        const weeklyImpRate = selectedMedia.includes('Digital') ? 45000 : 15000;
                                        const totalImps = avgAvailable * weeklyImpRate * weeksInRange;
                                        
                                        if (totalImps >= 1000000000) return `${(totalImps / 1000000000).toFixed(1)}B`;
                                        if (totalImps >= 1000000) return `${(totalImps / 1000000).toFixed(1)}M`;
                                        if (totalImps >= 1000) return `${Math.round(totalImps / 1000)}K`;
                                        return totalImps.toLocaleString();
                                    })()}
                                </span>
                            </div>
                            <span className="text-[9px] text-emerald-600">
                                {utilizationData.length > 0 
                                    ? `${Math.round(utilizationData.reduce((sum, d) => sum + d.available, 0) / utilizationData.length).toLocaleString()} avg avail`
                                    : '0 avail'}
                            </span>
                        </div>
                    </button>
                </div>
                </div>
                )}

                {/* CHART VIEW: TIMELINE or MAP */}
                {chartView === 'timeline' ? (
                    /* TIMELINE VISUALIZATION */
                    <div className="relative border rounded-lg bg-gray-50">
                        {/* Fullscreen compact info bar */}
                        {isFullscreen && (
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white text-sm">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold">{selectedMarket === 'ALL' ? 'All Markets' : selectedMarket.split(',')[0]}</span>
                                    <span className="text-gray-400">•</span>
                                    <span>{selectedMedia === 'ALL' ? 'All Media' : selectedMedia}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-blue-400">{totalInventory.toLocaleString()} faces</span>
                                    <span className="text-gray-400">•</span>
                                    <span>
                                        {new Date(rangeStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → {new Date(rangeEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="text-gray-400">|</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500"></span>Confirmed</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400"></span>On Hold</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex bg-gray-700 rounded p-0.5">
                                        <button onClick={() => setViewMode('daily')} className={`px-2 py-1 text-xs font-bold rounded transition-all ${viewMode === 'daily' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'}`}>Day</button>
                                        <button onClick={() => setViewMode('weekly')} className={`px-2 py-1 text-xs font-bold rounded transition-all ${viewMode === 'weekly' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'}`}>Week</button>
                                        <button onClick={() => setViewMode('monthly')} className={`px-2 py-1 text-xs font-bold rounded transition-all ${viewMode === 'monthly' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'}`}>Month</button>
                                        <button onClick={() => setViewMode('yearly')} className={`px-2 py-1 text-xs font-bold rounded transition-all ${viewMode === 'yearly' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'}`}>Year</button>
                                    </div>
                                    <span className="text-xs text-gray-400">Press ESC to exit</span>
                                </div>
                            </div>
                        )}
                        <div className="flex border-b bg-white sticky top-0 z-20 shadow-sm">
                            <div className="w-28 p-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-r">
                                {viewMode === 'daily' ? 'Date' : viewMode === 'weekly' ? 'Week' : viewMode === 'monthly' ? 'Month' : 'Year'}
                            </div>
                            <div className="flex-1 p-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider flex justify-between">
                                <span>Booked Faces ({requiredSize} needed / {totalInventory.toLocaleString()} total)</span>
                                <div className="flex gap-3 items-center">
                                    <span className="flex items-center gap-1">
                                        <span className="w-4 h-3 rounded bg-blue-500"></span>
                                        <span className="text-blue-700 font-bold">Confirmed</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-4 h-3 rounded bg-orange-400 border border-orange-500"></span>
                                        <span className="text-orange-700 font-bold">On Hold</span>
                                    </span>
                                    <span className="text-gray-300 mx-1">|</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Space OK</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>Tight</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>Full</span>
                                </div>
                            </div>
                        </div>

                        <div className={`${isFullscreen ? '' : 'max-h-[400px] overflow-y-auto'}`}>
                            {viewMode === 'daily' ? (
                                // DAILY VIEW
                                utilizationData.map((day, idx) => {
                                    const canFit = day.available >= requiredSize;
                                    const isExpanded = expandedRowId === `day-${idx}`;
                                    
                                    return (
                                        <div key={idx} className={`flex border-b last:border-0 hover:bg-white transition-colors ${day.isStartOfWeek ? 'border-t-2 border-t-blue-300' : ''}`}>
                                            <div className={`w-28 p-1.5 border-r flex flex-col justify-center relative ${canFit ? 'bg-green-50/50' : 'bg-red-50/30'}`}>
                                                {day.isStartOfWeek && (
                                                    <span className="absolute top-0 left-0 bg-blue-600 text-white text-[7px] px-0.5 rounded-br font-bold">WK</span>
                                                )}
                                                <span className={`text-[11px] ${day.isStartOfWeek ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                                                    {day.dayName}
                                                </span>
                                                <span className={`text-[9px] ${canFit ? 'text-green-600' : 'text-red-500'} font-semibold`}>
                                                    {day.available} avail
                                                </span>
                                            </div>
                                            
                                            <div className="flex-1 p-1.5 flex items-center relative">
                                                {/* Target Line */}
                                                <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-blue-300 z-0" 
                                                    style={{ left: `calc(${Math.min(100, (requiredSize / totalInventory) * 100)}%)` }} 
                                                />

                                                {/* Clickable Stacked Bar */}
                                                <div 
                                                    onClick={() => {
                                                        if (day.campaigns.length > 0) {
                                                            setExpandedRowId(isExpanded ? null : `day-${idx}`);
                                                        }
                                                    }}
                                                    className={`h-6 rounded flex overflow-hidden shadow-sm relative z-10 ${day.campaigns.length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`} 
                                                    style={{ width: `${Math.max(2, day.utilizationPct)}%` }}
                                                    title={day.campaigns.length > 0 ? `Click for campaign details` : ""}
                                                >
                                                    {day.confirmedUnits > 0 && (
                                                        <div className={`${getStatusColor(day.status)} flex items-center justify-center`} 
                                                            style={{ width: `${(day.confirmedUnits / day.booked) * 100}%` }}>
                                                            <span className="text-[10px] font-bold text-white truncate px-1">{day.confirmedUnits.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {day.holdUnits > 0 && (
                                                        <div className="bg-orange-400 flex items-center justify-center border-l-2 border-orange-500" 
                                                            style={{ width: `${(day.holdUnits / day.booked) * 100}%` }}>
                                                            <span className="text-[10px] font-bold text-orange-900 truncate px-1">{day.holdUnits.toLocaleString()} Hold</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Summary text after bar */}
                                                <div className="ml-2 text-[9px] text-gray-500 whitespace-nowrap flex items-center gap-1">
                                                    <span className="font-semibold text-gray-700">{day.booked.toLocaleString()}</span>
                                                    <span className="text-gray-400">total</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="text-gray-400">{day.campaigns.length} flights</span>
                                                </div>
                                                
                                                {/* Click-to-open popup */}
                                                {isExpanded && day.campaigns.length > 0 && (
                                                    <div 
                                                        className="fixed right-8 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] p-4 rounded-xl shadow-2xl z-[100] w-96"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <div className="font-bold border-b border-gray-700 pb-2 mb-3 flex justify-between items-center">
                                                            <span className="text-sm">Active Flights ({day.campaigns.length})</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-400">{day.booked} / {totalInventory}</span>
                                                                <button 
                                                                    onClick={() => setExpandedRowId(null)}
                                                                    className="text-gray-400 hover:text-white p-0.5 hover:bg-gray-700 rounded"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <ul className="max-h-[60vh] overflow-y-auto space-y-1">
                                                            {day.campaigns.map((c, i) => (
                                                                <li key={i} className="flex justify-between items-center">
                                                                    <span className="truncate flex-1">{c.name}</span>
                                                                    <span className={`ml-2 px-1.5 rounded text-[9px] font-bold ${c.stage?.includes('Hold') ? 'bg-orange-500' : 'bg-blue-500'}`}>{c.qty}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between items-center text-xs">
                                                            <span className="text-gray-400">{day.campaigns.length} campaigns</span>
                                                            <span className="font-bold text-blue-400">{day.booked.toLocaleString()} total faces</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : viewMode === 'weekly' ? (
                                // WEEKLY VIEW
                                weeklyData.map((week, idx) => {
                                    const canFit = week.minAvailable >= requiredSize;
                                    const utilizationColor = week.avgUtilization >= 90 ? 'bg-red-500' : week.avgUtilization >= 70 ? 'bg-yellow-400' : week.avgUtilization >= 40 ? 'bg-blue-500' : 'bg-blue-300';
                                    const isExpanded = expandedRowId === `week-${idx}`;
                                    
                                    return (
                                        <div key={idx} className={`flex border-b last:border-0 hover:bg-white transition-colors ${canFit ? '' : 'bg-red-50/30'}`}>
                                            <div className={`w-28 p-1.5 border-r flex flex-col justify-center ${canFit ? 'bg-green-50/50' : ''}`}>
                                                <span className="text-[11px] font-bold text-gray-900">{week.weekLabel}</span>
                                                <span className={`text-[9px] ${canFit ? 'text-green-600' : 'text-red-500'} font-semibold`}>
                                                    Min: {week.minAvailable}
                                                </span>
                                            </div>
                                            
                                            <div className="flex-1 p-1.5 flex items-center gap-2 relative">
                                                {/* Clickable bar */}
                                                <div 
                                                    onClick={() => {
                                                        if (week.campaignList && week.campaignList.length > 0) {
                                                            setExpandedRowId(isExpanded ? null : `week-${idx}`);
                                                        }
                                                    }}
                                                    className={`h-5 rounded ${utilizationColor} flex items-center px-2 shadow-sm transition-all ${week.campaignList?.length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-white/50' : ''}`} 
                                                    style={{ width: `${Math.max(5, week.avgUtilization)}%` }}
                                                    title={week.campaignList?.length > 0 ? "Click to see campaign details" : ""}
                                                >
                                                    <span className="text-[9px] font-bold text-white">{week.avgUtilization}%</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500">
                                                    <span className="font-semibold text-gray-700">{week.avgBooked}</span> avg • 
                                                    <span className="font-semibold text-gray-700 ml-1">{week.campaignCount}</span> flights
                                                    {week.campaignList?.length > 0 && !isExpanded && (
                                                        <button 
                                                            onClick={() => setExpandedRowId(`week-${idx}`)}
                                                            className="ml-2 text-blue-500 hover:text-blue-700 font-medium"
                                                        >
                                                            ▼ Details
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* Click-to-open popup */}
                                                {isExpanded && week.campaignList && week.campaignList.length > 0 && (
                                                    <div 
                                                        className="fixed right-8 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] p-4 rounded-xl shadow-2xl z-[100] w-96"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <div className="font-bold border-b border-gray-700 pb-2 mb-3 flex justify-between items-center">
                                                            <span className="text-sm">▣ Booked Campaigns ({week.campaignCount})</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-400">{week.weekLabel}</span>
                                                                <button 
                                                                    onClick={() => setExpandedRowId(null)}
                                                                    className="text-gray-400 hover:text-white p-0.5 hover:bg-gray-700 rounded"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <ul className="max-h-[50vh] overflow-y-auto space-y-1">
                                                            {week.campaignList.map((campaign, i) => (
                                                                <li key={i} className="flex items-center justify-between gap-2 py-0.5">
                                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${campaign.stage?.includes('Hold') ? 'bg-orange-400' : 'bg-blue-400'}`}></span>
                                                                        <span className="truncate">{campaign.name}</span>
                                                                    </div>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${campaign.stage?.includes('Hold') ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                                                        {campaign.qty}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <div className="mt-3 pt-2 border-t border-gray-700 grid grid-cols-4 gap-2 text-[10px]">
                                                            <div>
                                                                <span className="text-gray-400">Peak:</span>
                                                                <span className="ml-1 font-bold">{week.peakBooked}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Avg:</span>
                                                                <span className="ml-1 font-bold">{week.avgBooked}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Avail:</span>
                                                                <span className="ml-1 font-bold text-green-400">{week.minAvailable}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Total:</span>
                                                                <span className="ml-1 font-bold text-blue-400">{week.campaignList.reduce((sum, c) => sum + (c.qty || 0), 0).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : viewMode === 'monthly' ? (
                                // MONTHLY VIEW
                                monthlyData.map((month, idx) => {
                                    const canFit = month.minAvailable >= requiredSize;
                                    const utilizationColor = month.avgUtilization >= 90 ? 'bg-red-500' : month.avgUtilization >= 70 ? 'bg-yellow-400' : month.avgUtilization >= 40 ? 'bg-blue-500' : 'bg-blue-300';
                                    const isExpanded = expandedRowId === `month-${idx}`;
                                    
                                    return (
                                        <div key={idx} className={`flex border-b last:border-0 hover:bg-white transition-colors ${canFit ? '' : 'bg-red-50/30'}`}>
                                            <div className={`w-28 p-1.5 border-r flex flex-col justify-center ${canFit ? 'bg-green-50/50' : ''}`}>
                                                <span className="text-[11px] font-bold text-gray-900">{month.monthLabel}</span>
                                                <span className={`text-[9px] ${canFit ? 'text-green-600' : 'text-red-500'} font-semibold`}>
                                                    {month.daysCount} days
                                                </span>
                                            </div>
                                            
                                            <div className="flex-1 p-1.5 flex items-center gap-2 relative">
                                                <div 
                                                    onClick={() => {
                                                        if (month.campaignList && month.campaignList.length > 0) {
                                                            setExpandedRowId(isExpanded ? null : `month-${idx}`);
                                                        }
                                                    }}
                                                    className={`h-5 rounded ${utilizationColor} flex items-center px-2 shadow-sm transition-all ${month.campaignList?.length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-white/50' : ''}`} 
                                                    style={{ width: `${Math.max(5, month.avgUtilization)}%` }}
                                                    title={month.campaignList?.length > 0 ? "Click to see campaign details" : ""}
                                                >
                                                    <span className="text-[9px] font-bold text-white">{month.avgUtilization}%</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500">
                                                    <span className="font-semibold text-gray-700">{month.avgBooked}</span> avg • 
                                                    <span className="font-semibold text-gray-700 ml-1">{month.campaignCount}</span> flights
                                                </div>
                                                
                                                {/* Click-to-open popup */}
                                                {isExpanded && month.campaignList && month.campaignList.length > 0 && (
                                                    <div 
                                                        className="fixed right-8 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] p-4 rounded-xl shadow-2xl z-[100] w-96"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <div className="font-bold border-b border-gray-700 pb-2 mb-3 flex justify-between items-center">
                                                            <span className="text-sm">▣ Booked Campaigns ({month.campaignCount})</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-400">{month.monthLabel}</span>
                                                                <button 
                                                                    onClick={() => setExpandedRowId(null)}
                                                                    className="text-gray-400 hover:text-white p-0.5 hover:bg-gray-700 rounded"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <ul className="max-h-[50vh] overflow-y-auto space-y-1">
                                                            {month.campaignList.map((campaign, i) => (
                                                                <li key={i} className="flex items-center justify-between gap-2 py-0.5">
                                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${campaign.stage?.includes('Hold') ? 'bg-orange-400' : 'bg-blue-400'}`}></span>
                                                                        <span className="truncate">{campaign.name}</span>
                                                                    </div>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${campaign.stage?.includes('Hold') ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                                                        {campaign.qty}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <div className="mt-3 pt-2 border-t border-gray-700 grid grid-cols-4 gap-2 text-[10px]">
                                                            <div>
                                                                <span className="text-gray-400">Peak:</span>
                                                                <span className="ml-1 font-bold">{month.peakBooked}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Avg:</span>
                                                                <span className="ml-1 font-bold">{month.avgBooked}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Min Avail:</span>
                                                                <span className="ml-1 font-bold text-green-400">{month.minAvailable}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Total:</span>
                                                                <span className="ml-1 font-bold text-blue-400">{month.campaignList.reduce((sum, c) => sum + (c.qty || 0), 0).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                // YEARLY VIEW
                                yearlyData.map((year, idx) => {
                                    const canFit = year.minAvailable >= requiredSize;
                                    const utilizationColor = year.avgUtilization >= 90 ? 'bg-red-500' : year.avgUtilization >= 70 ? 'bg-yellow-400' : year.avgUtilization >= 40 ? 'bg-blue-500' : 'bg-blue-300';
                                    const monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
                                    const isExpanded = expandedRowId === `year-${idx}`;
                                    
                                    return (
                                        <div key={idx} className={`flex border-b last:border-0 hover:bg-white transition-colors ${canFit ? '' : 'bg-red-50/30'}`}>
                                            <div className={`w-28 p-1.5 border-r flex flex-col justify-center ${canFit ? 'bg-green-50/50' : ''}`}>
                                                <span className="text-[11px] font-bold text-gray-900">{year.yearLabel}</span>
                                                <span className={`text-[9px] ${canFit ? 'text-green-600' : 'text-red-500'} font-semibold`}>
                                                    {year.daysCount} days
                                                </span>
                                            </div>
                                            
                                            <div className="flex-1 p-1.5 flex flex-col gap-1 relative">
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        onClick={() => {
                                                            if (year.campaignList && year.campaignList.length > 0) {
                                                                setExpandedRowId(isExpanded ? null : `year-${idx}`);
                                                            }
                                                        }}
                                                        className={`h-5 rounded ${utilizationColor} flex items-center px-2 shadow-sm transition-all ${year.campaignList?.length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-white/50' : ''}`} 
                                                        style={{ width: `${Math.max(5, year.avgUtilization)}%` }}
                                                        title={year.campaignList?.length > 0 ? "Click to see campaign details" : ""}
                                                    >
                                                        <span className="text-[9px] font-bold text-white">{year.avgUtilization}%</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500">
                                                        <span className="font-semibold text-gray-700">{year.avgBooked}</span> avg • 
                                                        <span className="font-semibold text-gray-700 ml-1">{year.campaignCount}</span> flights
                                                    </div>
                                                </div>
                                                {/* Mini monthly sparkline */}
                                                <div className="flex gap-0.5">
                                                    {monthNames.map((m, mIdx) => {
                                                        const monthData = year.monthlyBreakdown[mIdx];
                                                        const monthUtil = monthData ? Math.min(100, Math.round((monthData.booked / monthData.days / totalInventory) * 100)) : 0;
                                                        const barColor = monthUtil >= 90 ? 'bg-red-400' : monthUtil >= 70 ? 'bg-yellow-400' : monthUtil >= 40 ? 'bg-blue-400' : monthUtil > 0 ? 'bg-blue-300' : 'bg-gray-200';
                                                        return (
                                                            <div key={mIdx} className="flex flex-col items-center" title={`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mIdx]}: ${monthUtil}%`}>
                                                                <div className={`w-4 ${barColor} rounded-sm`} style={{ height: `${Math.max(2, monthUtil / 5)}px` }}></div>
                                                                <span className="text-[7px] text-gray-400">{m}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {/* Click-to-open popup */}
                                                {isExpanded && year.campaignList && year.campaignList.length > 0 && (
                                                    <div 
                                                        className="fixed right-8 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] p-4 rounded-xl shadow-2xl z-[100] w-96"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <div className="font-bold border-b border-gray-700 pb-2 mb-3 flex justify-between items-center">
                                                            <span className="text-sm">▣ Booked Campaigns ({year.campaignCount})</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-400">{year.yearLabel}</span>
                                                                <button 
                                                                    onClick={() => setExpandedRowId(null)}
                                                                    className="text-gray-400 hover:text-white p-0.5 hover:bg-gray-700 rounded"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <ul className="max-h-[50vh] overflow-y-auto space-y-1">
                                                            {year.campaignList.map((campaign, i) => (
                                                                <li key={i} className="flex items-center justify-between gap-2 py-0.5">
                                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${campaign.stage?.includes('Hold') ? 'bg-orange-400' : 'bg-blue-400'}`}></span>
                                                                        <span className="truncate">{campaign.name}</span>
                                                                    </div>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${campaign.stage?.includes('Hold') ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                                                        {campaign.qty}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <div className="mt-3 pt-2 border-t border-gray-700 grid grid-cols-4 gap-2 text-[10px]">
                                                            <div>
                                                                <span className="text-gray-400">Peak:</span>
                                                                <span className="ml-1 font-bold">{year.peakBooked}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Avg:</span>
                                                                <span className="ml-1 font-bold">{year.avgBooked}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Min Avail:</span>
                                                                <span className="ml-1 font-bold text-green-400">{year.minAvailable}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Total:</span>
                                                                <span className="ml-1 font-bold text-blue-400">{year.campaignList.reduce((sum, c) => sum + (c.qty || 0), 0).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ) : chartView === 'map' ? (
                    /* MAP VIEW */
                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                        <div className="flex border-b bg-white p-2 justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Icon name="MapPin" size={14} className="text-blue-600" />
                                <span className="text-xs font-bold text-gray-700">Market Map</span>
                                <span className="text-[10px] text-gray-400">({mapMarketData.length})</span>
                            </div>
                            <div className="flex gap-2 text-[9px]">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>{'<'}50%</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>50-70%</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span>70-90%</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>{'>'}90%</span>
                            </div>
                        </div>
                        <div 
                            ref={mapContainerRef} 
                            style={{ height: '400px', width: '100%' }}
                            className="bg-gray-100"
                        />
                        {/* Market Legend Below Map */}
                        <div className="p-2 bg-white border-t max-h-32 overflow-y-auto">
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                                {mapMarketData.slice(0, 12).map((m, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`p-1.5 rounded border text-[10px] cursor-pointer hover:shadow transition-all ${
                                            m.utilization >= 90 ? 'bg-red-50 border-red-200' :
                                            m.utilization >= 70 ? 'bg-yellow-50 border-yellow-200' :
                                            m.utilization >= 50 ? 'bg-blue-50 border-blue-200' :
                                            'bg-green-50 border-green-200'
                                        }`}
                                        onClick={() => setSelectedMarket(m.market)}
                                    >
                                        <div className="font-bold text-gray-800 truncate">{m.market.split(',')[0]}</div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">{m.booked}/{m.totalInventory}</span>
                                            <span className={`font-bold ${
                                                m.utilization >= 90 ? 'text-red-600' :
                                                m.utilization >= 70 ? 'text-yellow-600' :
                                                m.utilization >= 50 ? 'text-blue-600' :
                                                'text-green-600'
                                            }`}>{m.utilization}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* GEOPATH IMPRESSION PLOTTER */
                    <div className="border rounded-xl overflow-hidden bg-gray-50">
                        {/* Header with upload */}
                        <div className="flex flex-wrap border-b bg-white p-3 justify-between items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Icon name="Target" size={18} className="text-emerald-600" />
                                <span className="text-sm font-bold text-gray-700">Geopath Impression Plotter</span>
                                {geopathData.length > 0 && (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                        {geopathData.length} locations
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-1">
                                    <Icon name="UploadCloud" size={14} />
                                    Upload Geopath CSV
                                    <input 
                                        type="file" 
                                        accept=".csv" 
                                        onChange={handleGeopathUpload}
                                        className="hidden"
                                    />
                                </label>
                                {geopathFile && (
                                    <span className="text-xs text-gray-500">{geopathFile.name}</span>
                                )}
                            </div>
                        </div>
                        
                        {geopathData.length === 0 ? (
                            /* Empty state - instructions */
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon name="Target" size={32} className="text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Upload Geopath Data</h3>
                                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                    Upload a CSV export from Geopath to visualize location impressions on the map. 
                                    Locations will be color-coded by performance.
                                </p>
                                
                                <div className="bg-gray-100 rounded-lg p-4 text-left max-w-lg mx-auto mb-6">
                                    <h4 className="font-bold text-gray-700 text-sm mb-2">Required CSV Columns:</h4>
                                    <ul className="text-xs text-gray-600 space-y-1">
                                        <li>• <strong>Latitude</strong> (lat, latitude, y_coord)</li>
                                        <li>• <strong>Longitude</strong> (lon, lng, longitude, x_coord)</li>
                                    </ul>
                                    <h4 className="font-bold text-gray-700 text-sm mt-3 mb-2">Optional Columns:</h4>
                                    <ul className="text-xs text-gray-600 space-y-1">
                                        <li>• <strong>Impressions</strong> (impressions, imps, weekly_imp)</li>
                                        <li>• <strong>ID</strong> (geopath_id, spot_id, panel_id)</li>
                                        <li>• <strong>Name/Location</strong> (name, description, address)</li>
                                        <li>• <strong>Media Type</strong> (media_type, media, format)</li>
                                        <li>• <strong>Market</strong> (market, dma, cbsa)</li>
                                        <li>• <strong>Reach/Frequency</strong></li>
                                    </ul>
                                </div>
                                
                                <label className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-2">
                                    <Icon name="UploadCloud" size={18} />
                                    Select CSV File
                                    <input 
                                        type="file" 
                                        accept=".csv" 
                                        onChange={handleGeopathUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        ) : (
                            <>
                                {/* Stats bar */}
                                {geopathStats && (
                                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b grid grid-cols-2 md:grid-cols-6 gap-3">
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-emerald-700">{geopathStats.total}</div>
                                            <div className="text-[10px] text-emerald-600 uppercase">Locations</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-emerald-700">{(geopathStats.totalImpressions / 1000000).toFixed(1)}M</div>
                                            <div className="text-[10px] text-emerald-600 uppercase">Total Imps</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-emerald-700">{(geopathStats.avgImpressions / 1000).toFixed(0)}K</div>
                                            <div className="text-[10px] text-emerald-600 uppercase">Avg Imps</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-green-600">{(geopathStats.maxImpressions / 1000).toFixed(0)}K</div>
                                            <div className="text-[10px] text-green-600 uppercase">Top Imps</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-red-600">{(geopathStats.minImpressions / 1000).toFixed(0)}K</div>
                                            <div className="text-[10px] text-red-600 uppercase">Low Imps</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-gray-700">{geopathStats.markets.length}</div>
                                            <div className="text-[10px] text-gray-500 uppercase">Markets</div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Legend */}
                                <div className="p-2 bg-white border-b flex flex-wrap items-center justify-center gap-3 text-[10px]">
                                    <span className="text-gray-500 font-semibold">Impressions:</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Top 10%</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-lime-500"></span> Top 25%</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Above Median</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500"></span> Below Median</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Bottom 25%</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400"></span> No Data</span>
                                </div>
                                
                                {/* Map */}
                                <div 
                                    ref={geopathMapRef} 
                                    style={{ height: '500px', width: '100%' }}
                                    className="bg-gray-800"
                                />
                                
                                {/* Bottom summary */}
                                <div className="p-3 bg-white border-t">
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs text-gray-500">
                                            {geopathStats?.mediaTypes.length > 0 && (
                                                <span>Media: {geopathStats.mediaTypes.slice(0, 5).join(', ')}{geopathStats.mediaTypes.length > 5 ? '...' : ''}</span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => { setGeopathData([]); setGeopathFile(null); setGeopathStats(null); }}
                                            className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1"
                                        >
                                            <Icon name="X" size={12} /> Clear Data
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
                </div>{/* End CONTENT AREA */}
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORTS - Available globally
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAP_AvailabilityComponent = AvailabilityComponent;

    console.log('✅ STAP Availability Component loaded');

})(window);
