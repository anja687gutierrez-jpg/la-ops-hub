// ═══════════════════════════════════════════════════════════════════════════════
// IMPRESSIONS DASHBOARD - Comprehensive OOH Proposal Dashboard
// Format breakdown charts, location heatmaps, market aggregation, PDF export
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    // Icon component from main app
    const Icon = window.STAP_Icon || (({ name, size = 16, className = '' }) =>
        React.createElement('span', { className, style: { fontSize: size } }, '●')
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // LA ZIP CODE DATA - Population & Demographics for Impressions Estimation
    // Based on US Census 2022 data
    // ═══════════════════════════════════════════════════════════════════════════════
    const LA_ZIP_DATA = {
        // Downtown & Central LA
        '90012': { pop: 38430, sqMi: 3.2, area: 'Downtown LA', region: 'Central', lat: 34.0622, lng: -118.2437 },
        '90013': { pop: 14587, sqMi: 0.7, area: 'Downtown LA', region: 'Central', lat: 34.0444, lng: -118.2439 },
        '90014': { pop: 9273, sqMi: 0.3, area: 'Fashion District', region: 'Central', lat: 34.0395, lng: -118.2545 },
        '90015': { pop: 25554, sqMi: 1.1, area: 'South Park', region: 'Central', lat: 34.0375, lng: -118.2614 },
        '90017': { pop: 28754, sqMi: 0.8, area: 'Downtown LA', region: 'Central', lat: 34.0509, lng: -118.2634 },
        '90021': { pop: 2781, sqMi: 1.2, area: 'Industrial District', region: 'Central', lat: 34.0269, lng: -118.2365 },
        '90071': { pop: 313, sqMi: 0.2, area: 'Financial District', region: 'Central', lat: 34.0519, lng: -118.2551 },
        // Koreatown & Mid-City
        '90004': { pop: 58833, sqMi: 2.1, area: 'Hancock Park', region: 'Mid-City', lat: 34.0767, lng: -118.3090 },
        '90005': { pop: 37754, sqMi: 0.9, area: 'Koreatown', region: 'Mid-City', lat: 34.0596, lng: -118.3007 },
        '90006': { pop: 56628, sqMi: 1.4, area: 'Koreatown', region: 'Mid-City', lat: 34.0481, lng: -118.2930 },
        '90010': { pop: 4185, sqMi: 0.3, area: 'Mid-Wilshire', region: 'Mid-City', lat: 34.0609, lng: -118.3152 },
        '90019': { pop: 59410, sqMi: 2.8, area: 'Mid-City', region: 'Mid-City', lat: 34.0490, lng: -118.3387 },
        '90020': { pop: 38400, sqMi: 0.8, area: 'Koreatown', region: 'Mid-City', lat: 34.0667, lng: -118.3089 },
        '90035': { pop: 26595, sqMi: 1.8, area: 'Mid-City', region: 'Mid-City', lat: 34.0536, lng: -118.3793 },
        '90036': { pop: 37713, sqMi: 2.1, area: 'Fairfax', region: 'Mid-City', lat: 34.0706, lng: -118.3505 },
        // Hollywood
        '90028': { pop: 30982, sqMi: 1.8, area: 'Hollywood', region: 'Hollywood', lat: 34.1017, lng: -118.3287 },
        '90029': { pop: 34649, sqMi: 1.3, area: 'Thai Town', region: 'Hollywood', lat: 34.0890, lng: -118.2943 },
        '90038': { pop: 27979, sqMi: 1.4, area: 'Hollywood', region: 'Hollywood', lat: 34.0905, lng: -118.3310 },
        '90046': { pop: 48170, sqMi: 4.2, area: 'West Hollywood', region: 'Hollywood', lat: 34.1144, lng: -118.3659 },
        '90068': { pop: 21064, sqMi: 4.8, area: 'Hollywood Hills', region: 'Hollywood', lat: 34.1287, lng: -118.3340 },
        '90069': { pop: 20045, sqMi: 1.8, area: 'West Hollywood', region: 'Hollywood', lat: 34.0903, lng: -118.3766 },
        // Eastside
        '90026': { pop: 64769, sqMi: 3.1, area: 'Echo Park', region: 'Eastside', lat: 34.0781, lng: -118.2606 },
        '90027': { pop: 45764, sqMi: 5.8, area: 'Los Feliz', region: 'Eastside', lat: 34.1134, lng: -118.2885 },
        '90039': { pop: 28244, sqMi: 2.8, area: 'Silver Lake', region: 'Eastside', lat: 34.1044, lng: -118.2607 },
        '90041': { pop: 28321, sqMi: 3.5, area: 'Eagle Rock', region: 'Eastside', lat: 34.1361, lng: -118.2148 },
        '90042': { pop: 59151, sqMi: 5.8, area: 'Highland Park', region: 'Eastside', lat: 34.1147, lng: -118.1920 },
        '90031': { pop: 37457, sqMi: 4.2, area: 'Lincoln Heights', region: 'Eastside', lat: 34.0789, lng: -118.2074 },
        '90032': { pop: 44881, sqMi: 3.8, area: 'El Sereno', region: 'Eastside', lat: 34.0808, lng: -118.1755 },
        '90065': { pop: 44897, sqMi: 5.2, area: 'Cypress Park', region: 'Eastside', lat: 34.1099, lng: -118.2277 },
        // Westside
        '90024': { pop: 50392, sqMi: 2.9, area: 'Westwood', region: 'Westside', lat: 34.0635, lng: -118.4409 },
        '90025': { pop: 44429, sqMi: 3.4, area: 'West LA', region: 'Westside', lat: 34.0403, lng: -118.4435 },
        '90034': { pop: 55061, sqMi: 2.5, area: 'Palms', region: 'Westside', lat: 34.0284, lng: -118.3977 },
        '90048': { pop: 20411, sqMi: 1.2, area: 'Beverly Grove', region: 'Westside', lat: 34.0749, lng: -118.3755 },
        '90049': { pop: 35819, sqMi: 8.2, area: 'Brentwood', region: 'Westside', lat: 34.0621, lng: -118.4823 },
        '90064': { pop: 25956, sqMi: 2.1, area: 'Rancho Park', region: 'Westside', lat: 34.0365, lng: -118.4217 },
        '90066': { pop: 54142, sqMi: 4.5, area: 'Mar Vista', region: 'Westside', lat: 34.0020, lng: -118.4298 },
        '90067': { pop: 2653, sqMi: 0.5, area: 'Century City', region: 'Westside', lat: 34.0571, lng: -118.4154 },
        '90077': { pop: 7868, sqMi: 6.5, area: 'Bel Air', region: 'Westside', lat: 34.0939, lng: -118.4461 },
        '90210': { pop: 19180, sqMi: 5.8, area: 'Beverly Hills', region: 'Westside', lat: 34.0901, lng: -118.4065 },
        '90272': { pop: 21298, sqMi: 8.5, area: 'Pacific Palisades', region: 'Westside', lat: 34.0441, lng: -118.5259 },
        // Beach Cities
        '90291': { pop: 25656, sqMi: 2.1, area: 'Venice', region: 'Beach', lat: 33.9925, lng: -118.4597 },
        '90292': { pop: 24481, sqMi: 3.2, area: 'Marina del Rey', region: 'Beach', lat: 33.9777, lng: -118.4514 },
        '90293': { pop: 13039, sqMi: 1.8, area: 'Playa del Rey', region: 'Beach', lat: 33.9561, lng: -118.4406 },
        '90402': { pop: 11816, sqMi: 0.8, area: 'Santa Monica', region: 'Beach', lat: 34.0353, lng: -118.4985 },
        // South LA
        '90001': { pop: 57652, sqMi: 4.5, area: 'Florence', region: 'South LA', lat: 33.9425, lng: -118.2551 },
        '90002': { pop: 53108, sqMi: 3.8, area: 'Watts', region: 'South LA', lat: 33.9492, lng: -118.2467 },
        '90003': { pop: 75024, sqMi: 4.2, area: 'South LA', region: 'South LA', lat: 33.9640, lng: -118.2729 },
        '90007': { pop: 41004, sqMi: 1.3, area: 'USC Area', region: 'South LA', lat: 34.0271, lng: -118.2834 },
        '90008': { pop: 33076, sqMi: 2.8, area: 'Baldwin Hills', region: 'South LA', lat: 34.0102, lng: -118.3401 },
        '90011': { pop: 106042, sqMi: 4.8, area: 'South Central', region: 'South LA', lat: 33.9927, lng: -118.2577 },
        '90016': { pop: 47309, sqMi: 2.4, area: 'West Adams', region: 'South LA', lat: 34.0305, lng: -118.3565 },
        '90018': { pop: 49898, sqMi: 2.6, area: 'Jefferson Park', region: 'South LA', lat: 34.0291, lng: -118.3117 },
        '90037': { pop: 69064, sqMi: 3.2, area: 'Vermont Square', region: 'South LA', lat: 33.9980, lng: -118.2879 },
        '90043': { pop: 44461, sqMi: 3.2, area: 'View Park', region: 'South LA', lat: 33.9888, lng: -118.3338 },
        '90044': { pop: 98990, sqMi: 5.2, area: 'Vermont-Slauson', region: 'South LA', lat: 33.9540, lng: -118.2897 },
        '90047': { pop: 52200, sqMi: 4.5, area: 'Vermont Knolls', region: 'South LA', lat: 33.9573, lng: -118.3117 },
        '90056': { pop: 8225, sqMi: 0.9, area: 'Ladera Heights', region: 'South LA', lat: 33.9932, lng: -118.3757 },
        '90059': { pop: 39471, sqMi: 2.8, area: 'Green Meadows', region: 'South LA', lat: 33.9279, lng: -118.2449 },
        '90061': { pop: 28646, sqMi: 2.1, area: 'Vermont Vista', region: 'South LA', lat: 33.9224, lng: -118.2795 },
        '90062': { pop: 33528, sqMi: 2.0, area: 'South LA', region: 'South LA', lat: 34.0022, lng: -118.3087 },
        // East LA & Boyle Heights
        '90023': { pop: 44558, sqMi: 3.5, area: 'Boyle Heights', region: 'East LA', lat: 34.0231, lng: -118.2017 },
        '90033': { pop: 47655, sqMi: 2.1, area: 'Boyle Heights', region: 'East LA', lat: 34.0496, lng: -118.2106 },
        '90063': { pop: 52008, sqMi: 3.8, area: 'East LA', region: 'East LA', lat: 34.0439, lng: -118.1854 },
        // San Fernando Valley
        '91040': { pop: 20911, sqMi: 4.2, area: 'Sunland', region: 'Valley', lat: 34.2575, lng: -118.3040 },
        '91042': { pop: 27119, sqMi: 12.5, area: 'Tujunga', region: 'Valley', lat: 34.2595, lng: -118.2877 },
        '91303': { pop: 30611, sqMi: 4.8, area: 'Canoga Park', region: 'Valley', lat: 34.2036, lng: -118.5978 },
        '91304': { pop: 54369, sqMi: 8.2, area: 'Canoga Park', region: 'Valley', lat: 34.2263, lng: -118.6017 },
        '91306': { pop: 49460, sqMi: 5.8, area: 'Winnetka', region: 'Valley', lat: 34.2050, lng: -118.5712 },
        '91316': { pop: 34305, sqMi: 3.8, area: 'Encino', region: 'Valley', lat: 34.1589, lng: -118.5017 },
        '91324': { pop: 29744, sqMi: 3.2, area: 'Northridge', region: 'Valley', lat: 34.2283, lng: -118.5369 },
        '91325': { pop: 35537, sqMi: 3.8, area: 'Northridge', region: 'Valley', lat: 34.2425, lng: -118.5363 },
        '91326': { pop: 36503, sqMi: 8.5, area: 'Porter Ranch', region: 'Valley', lat: 34.2813, lng: -118.5550 },
        '91331': { pop: 99804, sqMi: 8.2, area: 'Pacoima', region: 'Valley', lat: 34.2541, lng: -118.4098 },
        '91335': { pop: 77158, sqMi: 6.5, area: 'Reseda', region: 'Valley', lat: 34.2011, lng: -118.5355 },
        '91342': { pop: 92580, sqMi: 18.5, area: 'Sylmar', region: 'Valley', lat: 34.3089, lng: -118.4463 },
        '91343': { pop: 63193, sqMi: 5.2, area: 'North Hills', region: 'Valley', lat: 34.2364, lng: -118.4815 },
        '91344': { pop: 53862, sqMi: 8.8, area: 'Granada Hills', region: 'Valley', lat: 34.2792, lng: -118.5009 },
        '91352': { pop: 45601, sqMi: 4.5, area: 'Sun Valley', region: 'Valley', lat: 34.2188, lng: -118.3716 },
        '91356': { pop: 30599, sqMi: 3.2, area: 'Tarzana', region: 'Valley', lat: 34.1728, lng: -118.5509 },
        '91364': { pop: 28765, sqMi: 4.2, area: 'Woodland Hills', region: 'Valley', lat: 34.1650, lng: -118.6063 },
        '91367': { pop: 44862, sqMi: 5.8, area: 'Woodland Hills', region: 'Valley', lat: 34.1803, lng: -118.6098 },
        '91401': { pop: 39179, sqMi: 2.5, area: 'Van Nuys', region: 'Valley', lat: 34.1826, lng: -118.4489 },
        '91402': { pop: 67937, sqMi: 4.8, area: 'Panorama City', region: 'Valley', lat: 34.2200, lng: -118.4469 },
        '91403': { pop: 25887, sqMi: 2.8, area: 'Sherman Oaks', region: 'Valley', lat: 34.1508, lng: -118.4612 },
        '91405': { pop: 55451, sqMi: 3.5, area: 'Van Nuys', region: 'Valley', lat: 34.2006, lng: -118.4487 },
        '91406': { pop: 53276, sqMi: 4.2, area: 'Van Nuys', region: 'Valley', lat: 34.1972, lng: -118.4920 },
        '91423': { pop: 31787, sqMi: 3.8, area: 'Sherman Oaks', region: 'Valley', lat: 34.1463, lng: -118.4305 },
        '91436': { pop: 16190, sqMi: 2.1, area: 'Encino', region: 'Valley', lat: 34.1623, lng: -118.4737 },
        '91601': { pop: 35615, sqMi: 2.8, area: 'North Hollywood', region: 'Valley', lat: 34.1684, lng: -118.3769 },
        '91602': { pop: 19980, sqMi: 2.5, area: 'North Hollywood', region: 'Valley', lat: 34.1511, lng: -118.3668 },
        '91604': { pop: 32073, sqMi: 3.5, area: 'Studio City', region: 'Valley', lat: 34.1395, lng: -118.3966 },
        '91605': { pop: 51654, sqMi: 3.8, area: 'North Hollywood', region: 'Valley', lat: 34.2019, lng: -118.4064 },
        '91606': { pop: 43552, sqMi: 2.8, area: 'North Hollywood', region: 'Valley', lat: 34.1872, lng: -118.3936 },
        '91607': { pop: 30734, sqMi: 2.5, area: 'Valley Village', region: 'Valley', lat: 34.1670, lng: -118.4097 },
        // Harbor Area
        '90045': { pop: 41123, sqMi: 5.4, area: 'Westchester', region: 'Harbor', lat: 33.9562, lng: -118.3959 },
        '90501': { pop: 42536, sqMi: 4.8, area: 'Torrance', region: 'Harbor', lat: 33.8326, lng: -118.3080 },
        '90710': { pop: 27517, sqMi: 3.8, area: 'Harbor City', region: 'Harbor', lat: 33.8016, lng: -118.2972 },
        '90731': { pop: 63431, sqMi: 8.5, area: 'San Pedro', region: 'Harbor', lat: 33.7311, lng: -118.2921 },
        '90744': { pop: 54277, sqMi: 6.8, area: 'Wilmington', region: 'Harbor', lat: 33.7899, lng: -118.2630 },
        '90810': { pop: 36306, sqMi: 4.2, area: 'Long Beach', region: 'Harbor', lat: 33.8192, lng: -118.2194 },
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // MARKET COORDINATES & DATA - For Multi-Market Comparison
    // ═══════════════════════════════════════════════════════════════════════════════
    const MARKET_DATA = {
        'Los Angeles, CA': { lat: 34.05, lng: -118.24, pop: 3898747, households: 1413995, medianIncome: 65290, color: '#ef4444' },
        'Dallas, TX': { lat: 32.78, lng: -96.80, pop: 1304379, households: 538698, medianIncome: 54747, color: '#f97316' },
        'Miami, FL': { lat: 25.76, lng: -80.19, pop: 442241, households: 182205, medianIncome: 44224, color: '#eab308' },
        'Chicago, IL': { lat: 41.88, lng: -87.63, pop: 2746388, households: 1073628, medianIncome: 58247, color: '#22c55e' },
        'Boston, MA': { lat: 42.36, lng: -71.06, pop: 692600, households: 283235, medianIncome: 71115, color: '#06b6d4' },
        'New York, NY': { lat: 40.71, lng: -74.01, pop: 8336817, households: 3181595, medianIncome: 63998, color: '#3b82f6' },
        'Seattle, WA': { lat: 47.61, lng: -122.33, pop: 737015, households: 356729, medianIncome: 97185, color: '#8b5cf6' },
        'San Francisco, CA': { lat: 37.77, lng: -122.42, pop: 873965, households: 388250, medianIncome: 112449, color: '#ec4899' },
        'Orlando, FL': { lat: 28.54, lng: -81.38, pop: 307573, households: 131963, medianIncome: 48511, color: '#14b8a6' },
        'Las Vegas, NV': { lat: 36.17, lng: -115.14, pop: 641903, households: 250524, medianIncome: 56354, color: '#64748b' },
        'Phoenix, AZ': { lat: 33.45, lng: -112.07, pop: 1608139, households: 589376, medianIncome: 57459, color: '#f43f5e' },
        'Denver, CO': { lat: 39.74, lng: -104.99, pop: 715522, households: 326220, medianIncome: 68592, color: '#a855f7' },
        'Atlanta, GA': { lat: 33.75, lng: -84.39, pop: 498715, households: 224658, medianIncome: 59948, color: '#84cc16' },
        'Houston, TX': { lat: 29.76, lng: -95.37, pop: 2304580, households: 845553, medianIncome: 52338, color: '#0ea5e9' },
        'San Diego, CA': { lat: 32.72, lng: -117.16, pop: 1386932, households: 524938, medianIncome: 79673, color: '#f59e0b' },
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // PRODUCT FORMAT DEFINITIONS - Impressions & Multipliers
    // ═══════════════════════════════════════════════════════════════════════════════
    const PRODUCT_FORMATS = {
        'Digital Billboard': {
            weekly: 65000, multiplier: 2.5, tier: 'Premium', category: 'Digital',
            color: '#6366f1', icon: '📺', cpm: 8.50,
            description: 'High-impact digital displays with multiple rotations'
        },
        'Digital Spectacular': {
            weekly: 85000, multiplier: 2.8, tier: 'Premium', category: 'Digital',
            color: '#8b5cf6', icon: '🌟', cpm: 12.00,
            description: 'Large-format digital dominations in prime locations'
        },
        'Digital Transit Shelter': {
            weekly: 45000, multiplier: 2.0, tier: 'Digital', category: 'Digital',
            color: '#06b6d4', icon: '🚏', cpm: 6.50,
            description: 'Digital screens at transit shelter locations'
        },
        'Transit Bus - Full Wrap': {
            weekly: 55000, multiplier: 1.8, tier: 'Transit Premium', category: 'Transit',
            color: '#10b981', icon: '🚌', cpm: 4.25,
            description: 'Complete bus exterior wrap for maximum visibility'
        },
        'Transit Bus - King': {
            weekly: 35000, multiplier: 1.4, tier: 'Transit', category: 'Transit',
            color: '#22c55e', icon: '🚍', cpm: 3.00,
            description: 'Large side panel on transit buses'
        },
        'Transit Bus - Kong': {
            weekly: 32000, multiplier: 1.3, tier: 'Transit', category: 'Transit',
            color: '#84cc16', icon: '🚍', cpm: 2.75,
            description: 'Extended side panel coverage'
        },
        'Transit Shelter - Panel': {
            weekly: 18000, multiplier: 0.65, tier: 'Street Level', category: 'Street',
            color: '#eab308', icon: '🚏', cpm: 2.00,
            description: 'Static panels at transit shelter locations'
        },
        'Transit Shelter - Targeted': {
            weekly: 25000, multiplier: 1.15, tier: 'Street Level', category: 'Street',
            color: '#f59e0b', icon: '🎯', cpm: 3.50,
            description: 'Premium placement in high-traffic areas'
        },
        'Wallscape': {
            weekly: 70000, multiplier: 1.8, tier: 'Large Format', category: 'Static',
            color: '#ef4444', icon: '🏢', cpm: 5.50,
            description: 'Building-mounted large format displays'
        },
        'Bulletin': {
            weekly: 50000, multiplier: 1.5, tier: 'Large Format', category: 'Static',
            color: '#f97316', icon: '📋', cpm: 4.00,
            description: 'Standard large format bulletins'
        },
        'Poster/Panel': {
            weekly: 25000, multiplier: 0.95, tier: 'Standard', category: 'Static',
            color: '#64748b', icon: '📄', cpm: 2.25,
            description: 'Standard poster and panel formats'
        },
        'Street Furniture': {
            weekly: 12000, multiplier: 0.55, tier: 'Street Level', category: 'Street',
            color: '#94a3b8', icon: '🪑', cpm: 1.50,
            description: 'Benches, kiosks, and urban furniture'
        },
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // REGION DEFINITIONS - LA Area Regions for Analysis
    // ═══════════════════════════════════════════════════════════════════════════════
    const LA_REGIONS = {
        'Central': { color: '#ef4444', label: 'Downtown/Central LA', x: 50, y: 45 },
        'Mid-City': { color: '#f97316', label: 'Mid-City/Koreatown', x: 40, y: 40 },
        'Hollywood': { color: '#eab308', label: 'Hollywood/WeHo', x: 35, y: 30 },
        'Eastside': { color: '#22c55e', label: 'Eastside', x: 60, y: 35 },
        'Westside': { color: '#06b6d4', label: 'Westside', x: 20, y: 45 },
        'Beach': { color: '#3b82f6', label: 'Beach Cities', x: 15, y: 55 },
        'South LA': { color: '#8b5cf6', label: 'South LA', x: 45, y: 60 },
        'East LA': { color: '#ec4899', label: 'East LA/Boyle Heights', x: 65, y: 45 },
        'Valley': { color: '#14b8a6', label: 'San Fernando Valley', x: 40, y: 15 },
        'Harbor': { color: '#64748b', label: 'Harbor/South Bay', x: 35, y: 80 },
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // IMPRESSIONS CALCULATION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    const getProductImpressions = (productType) => {
        if (!productType) return { weekly: 20000, multiplier: 1.0, tier: 'Standard', category: 'Static', cpm: 2.50 };

        const prodLower = productType.toLowerCase();

        for (const [format, data] of Object.entries(PRODUCT_FORMATS)) {
            if (prodLower.includes(format.toLowerCase().split(' ')[0])) {
                return data;
            }
        }

        if (prodLower.includes('digital')) {
            if (prodLower.includes('spectacular') || prodLower.includes('domination')) {
                return PRODUCT_FORMATS['Digital Spectacular'];
            }
            if (prodLower.includes('billboard')) {
                return PRODUCT_FORMATS['Digital Billboard'];
            }
            return PRODUCT_FORMATS['Digital Transit Shelter'];
        }

        if (prodLower.includes('transit') || prodLower.includes('bus')) {
            if (prodLower.includes('full wrap')) return PRODUCT_FORMATS['Transit Bus - Full Wrap'];
            if (prodLower.includes('king')) return PRODUCT_FORMATS['Transit Bus - King'];
            if (prodLower.includes('kong')) return PRODUCT_FORMATS['Transit Bus - Kong'];
            if (prodLower.includes('shelter')) {
                if (prodLower.includes('targeted') || prodLower.includes('premier')) {
                    return PRODUCT_FORMATS['Transit Shelter - Targeted'];
                }
                return PRODUCT_FORMATS['Transit Shelter - Panel'];
            }
            return { weekly: 25000, multiplier: 1.0, tier: 'Transit', category: 'Transit', color: '#22c55e', icon: '🚍', cpm: 2.75 };
        }

        if (prodLower.includes('wallscape') || prodLower.includes('mural')) return PRODUCT_FORMATS['Wallscape'];
        if (prodLower.includes('bulletin') || prodLower.includes('spectacular')) return PRODUCT_FORMATS['Bulletin'];
        if (prodLower.includes('poster') || prodLower.includes('panel')) return PRODUCT_FORMATS['Poster/Panel'];
        if (prodLower.includes('bench') || prodLower.includes('kiosk') || prodLower.includes('furniture')) return PRODUCT_FORMATS['Street Furniture'];

        return { weekly: 20000, multiplier: 1.0, tier: 'Standard', category: 'Static', color: '#64748b', icon: '📄', cpm: 2.50 };
    };

    const estimateZipImpressions = (zip, productType = null) => {
        const data = LA_ZIP_DATA[zip];

        if (!data) {
            const avgDensity = 8000;
            const baseImps = Math.round(avgDensity * 0.75);
            return {
                zip,
                found: false,
                area: 'Unknown',
                region: 'Unknown',
                population: null,
                density: avgDensity,
                baseImpressions: baseImps,
                weeklyImpressions: Object.fromEntries(
                    Object.entries(PRODUCT_FORMATS).map(([k, v]) => [k, Math.round(baseImps * v.multiplier)])
                )
            };
        }

        const density = Math.round(data.pop / data.sqMi);
        const baseImpressions = Math.round(density * 0.75);

        return {
            zip,
            found: true,
            area: data.area,
            region: data.region,
            population: data.pop,
            sqMiles: data.sqMi,
            density,
            baseImpressions,
            weeklyImpressions: Object.fromEntries(
                Object.entries(PRODUCT_FORMATS).map(([k, v]) => [k, Math.round(baseImpressions * v.multiplier)])
            )
        };
    };

    const calculateCampaignImpressions = (units, productType, weeks = 4) => {
        const prodData = getProductImpressions(productType);
        const weeklyPerUnit = prodData.weekly;
        const totalWeekly = weeklyPerUnit * units;
        const campaignTotal = totalWeekly * weeks;
        const estimatedCost = (campaignTotal / 1000) * (prodData.cpm || 2.50);

        return {
            weeklyPerUnit,
            totalWeekly,
            campaignTotal,
            estimatedCost,
            formatted: {
                weeklyPerUnit: formatNumber(weeklyPerUnit),
                totalWeekly: formatNumber(totalWeekly),
                campaignTotal: formatNumber(campaignTotal),
                cost: '$' + formatNumber(estimatedCost),
            },
            tier: prodData.tier,
            multiplier: prodData.multiplier,
            cpm: prodData.cpm,
        };
    };

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
        return num.toString();
    };

    const formatCurrency = (num) => {
        if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
        return '$' + num.toFixed(0);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // BAR CHART COMPONENT
    // ═══════════════════════════════════════════════════════════════════════════════
    const BarChart = ({ data, maxValue, horizontal = false, showLabels = true, height = 200 }) => {
        const sortedData = [...data].sort((a, b) => b.value - a.value);
        const max = maxValue || Math.max(...data.map(d => d.value));

        if (horizontal) {
            return React.createElement('div', { className: 'space-y-2' },
                sortedData.map((item, idx) =>
                    React.createElement('div', { key: item.label, className: 'flex items-center gap-2' }, [
                        React.createElement('div', {
                            key: 'label',
                            className: 'w-32 text-xs text-gray-600 truncate text-right'
                        }, item.label),
                        React.createElement('div', {
                            key: 'bar-container',
                            className: 'flex-1 h-6 bg-gray-100 rounded-full overflow-hidden'
                        },
                            React.createElement('div', {
                                className: 'h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2',
                                style: {
                                    width: `${(item.value / max) * 100}%`,
                                    backgroundColor: item.color || '#6366f1'
                                }
                            },
                                showLabels && React.createElement('span', {
                                    className: 'text-xs font-bold text-white'
                                }, formatNumber(item.value))
                            )
                        )
                    ])
                )
            );
        }

        return React.createElement('div', {
            className: 'flex items-end gap-1 justify-center',
            style: { height: `${height}px` }
        },
            sortedData.slice(0, 12).map((item, idx) =>
                React.createElement('div', {
                    key: item.label,
                    className: 'flex flex-col items-center gap-1 flex-1 max-w-16'
                }, [
                    showLabels && React.createElement('div', {
                        key: 'value',
                        className: 'text-[10px] font-bold text-gray-700'
                    }, formatNumber(item.value)),
                    React.createElement('div', {
                        key: 'bar',
                        className: 'w-full rounded-t-lg transition-all duration-500 hover:opacity-80',
                        style: {
                            height: `${(item.value / max) * (height - 40)}px`,
                            backgroundColor: item.color || '#6366f1',
                            minHeight: '4px'
                        },
                        title: `${item.label}: ${formatNumber(item.value)}`
                    }),
                    React.createElement('div', {
                        key: 'label',
                        className: 'text-[9px] text-gray-500 text-center truncate w-full transform -rotate-45 origin-top-left mt-2'
                    }, item.label.split(' ')[0])
                ])
            )
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // DONUT CHART COMPONENT
    // ═══════════════════════════════════════════════════════════════════════════════
    const DonutChart = ({ data, size = 180, centerLabel, centerValue }) => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        const radius = size / 2 - 10;
        const innerRadius = radius * 0.6;
        let currentAngle = -90;

        const segments = data.map(item => {
            const angle = (item.value / total) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const x1 = size / 2 + radius * Math.cos(startRad);
            const y1 = size / 2 + radius * Math.sin(startRad);
            const x2 = size / 2 + radius * Math.cos(endRad);
            const y2 = size / 2 + radius * Math.sin(endRad);
            const x3 = size / 2 + innerRadius * Math.cos(endRad);
            const y3 = size / 2 + innerRadius * Math.sin(endRad);
            const x4 = size / 2 + innerRadius * Math.cos(startRad);
            const y4 = size / 2 + innerRadius * Math.sin(startRad);

            const largeArc = angle > 180 ? 1 : 0;

            return {
                ...item,
                path: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`,
                percentage: ((item.value / total) * 100).toFixed(1)
            };
        });

        return React.createElement('div', { className: 'flex items-center gap-4' }, [
            React.createElement('svg', {
                key: 'chart',
                width: size,
                height: size,
                viewBox: `0 0 ${size} ${size}`
            }, [
                ...segments.map((seg, idx) =>
                    React.createElement('path', {
                        key: idx,
                        d: seg.path,
                        fill: seg.color,
                        stroke: 'white',
                        strokeWidth: 2,
                        className: 'hover:opacity-80 transition-opacity cursor-pointer'
                    })
                ),
                React.createElement('text', {
                    key: 'center-value',
                    x: size / 2,
                    y: size / 2 - 5,
                    textAnchor: 'middle',
                    className: 'text-2xl font-bold fill-gray-800'
                }, centerValue),
                React.createElement('text', {
                    key: 'center-label',
                    x: size / 2,
                    y: size / 2 + 15,
                    textAnchor: 'middle',
                    className: 'text-xs fill-gray-500'
                }, centerLabel)
            ]),
            React.createElement('div', { key: 'legend', className: 'flex flex-col gap-1' },
                segments.slice(0, 6).map((seg, idx) =>
                    React.createElement('div', {
                        key: idx,
                        className: 'flex items-center gap-2 text-xs'
                    }, [
                        React.createElement('div', {
                            key: 'dot',
                            className: 'w-3 h-3 rounded-full',
                            style: { backgroundColor: seg.color }
                        }),
                        React.createElement('span', { key: 'label', className: 'text-gray-600' }, seg.label),
                        React.createElement('span', { key: 'pct', className: 'text-gray-400 ml-auto' }, seg.percentage + '%')
                    ])
                )
            )
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // REGION HEATMAP COMPONENT - Visual LA Map
    // ═══════════════════════════════════════════════════════════════════════════════
    const RegionHeatmap = ({ regionStats, selectedRegion, onSelectRegion, selectedFormat }) => {
        const maxDensity = Math.max(...Object.values(regionStats).map(r => r.avgDensity));

        return React.createElement('div', {
            className: 'relative bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-4',
            style: { height: '400px' }
        }, [
            // Map Title
            React.createElement('div', {
                key: 'title',
                className: 'absolute top-3 left-3 text-xs font-bold text-gray-500 uppercase tracking-wider'
            }, 'LA Metro Regions'),

            // Compass
            React.createElement('div', {
                key: 'compass',
                className: 'absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-xs font-bold text-gray-600'
            }, 'N'),

            // Region bubbles
            ...Object.entries(LA_REGIONS).map(([regionId, region]) => {
                const stats = regionStats[regionId];
                if (!stats) return null;

                const intensity = stats.avgDensity / maxDensity;
                const size = 40 + intensity * 40;
                const imps = selectedFormat
                    ? stats.impressions[selectedFormat] || 0
                    : stats.avgDensity;

                return React.createElement('div', {
                    key: regionId,
                    onClick: () => onSelectRegion(selectedRegion === regionId ? null : regionId),
                    className: `absolute cursor-pointer transition-all duration-300 hover:scale-110 ${
                        selectedRegion === regionId ? 'ring-4 ring-indigo-400 ring-offset-2' : ''
                    }`,
                    style: {
                        left: `${region.x}%`,
                        top: `${region.y}%`,
                        transform: 'translate(-50%, -50%)'
                    }
                },
                    React.createElement('div', {
                        className: 'rounded-full flex flex-col items-center justify-center text-white shadow-lg',
                        style: {
                            width: `${size}px`,
                            height: `${size}px`,
                            backgroundColor: region.color,
                            opacity: 0.7 + intensity * 0.3
                        }
                    }, [
                        React.createElement('div', {
                            key: 'value',
                            className: 'text-sm font-bold'
                        }, formatNumber(imps)),
                        React.createElement('div', {
                            key: 'label',
                            className: 'text-[8px] opacity-80'
                        }, regionId)
                    ])
                );
            }),

            // Legend
            React.createElement('div', {
                key: 'legend',
                className: 'absolute bottom-3 left-3 bg-white/90 rounded-lg p-2 text-xs'
            }, [
                React.createElement('div', { key: 'title', className: 'font-bold text-gray-600 mb-1' }, 'Density Scale'),
                React.createElement('div', { key: 'scale', className: 'flex items-center gap-1' }, [
                    React.createElement('span', { key: 'low' }, 'Low'),
                    React.createElement('div', {
                        key: 'gradient',
                        className: 'w-16 h-2 rounded',
                        style: { background: 'linear-gradient(to right, #94a3b8, #6366f1, #ef4444)' }
                    }),
                    React.createElement('span', { key: 'high' }, 'High')
                ])
            ])
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // MARKET COMPARISON TABLE
    // ═══════════════════════════════════════════════════════════════════════════════
    const MarketComparisonTable = ({ markets, selectedFormat, weeks }) => {
        const formatData = PRODUCT_FORMATS[selectedFormat] || PRODUCT_FORMATS['Bulletin'];
        const sortedMarkets = Object.entries(MARKET_DATA)
            .filter(([name]) => markets.includes(name))
            .map(([name, data]) => {
                const marketMultiplier = data.pop > 2000000 ? 1.2 : data.pop > 1000000 ? 1.0 : 0.85;
                const weeklyImps = Math.round(formatData.weekly * marketMultiplier);
                const totalImps = weeklyImps * weeks;
                const estimatedCPM = formatData.cpm * (data.medianIncome > 80000 ? 1.3 : data.medianIncome > 60000 ? 1.1 : 1.0);

                return {
                    name,
                    ...data,
                    weeklyImps,
                    totalImps,
                    cpm: estimatedCPM,
                    cost: (totalImps / 1000) * estimatedCPM
                };
            })
            .sort((a, b) => b.totalImps - a.totalImps);

        return React.createElement('div', { className: 'overflow-x-auto' },
            React.createElement('table', { className: 'w-full text-sm' }, [
                React.createElement('thead', { key: 'head' },
                    React.createElement('tr', { className: 'bg-gray-50' }, [
                        React.createElement('th', { key: 'market', className: 'px-3 py-2 text-left font-bold text-gray-700' }, 'Market'),
                        React.createElement('th', { key: 'pop', className: 'px-3 py-2 text-right font-bold text-gray-700' }, 'Population'),
                        React.createElement('th', { key: 'weekly', className: 'px-3 py-2 text-right font-bold text-gray-700' }, 'Weekly Imps'),
                        React.createElement('th', { key: 'total', className: 'px-3 py-2 text-right font-bold text-gray-700' }, `${weeks}wk Total`),
                        React.createElement('th', { key: 'cpm', className: 'px-3 py-2 text-right font-bold text-gray-700' }, 'CPM'),
                        React.createElement('th', { key: 'cost', className: 'px-3 py-2 text-right font-bold text-gray-700' }, 'Est. Cost')
                    ])
                ),
                React.createElement('tbody', { key: 'body' },
                    sortedMarkets.map((market, idx) =>
                        React.createElement('tr', {
                            key: market.name,
                            className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }, [
                            React.createElement('td', { key: 'name', className: 'px-3 py-2 font-medium' }, [
                                React.createElement('span', {
                                    key: 'dot',
                                    className: 'inline-block w-2 h-2 rounded-full mr-2',
                                    style: { backgroundColor: market.color }
                                }),
                                market.name
                            ]),
                            React.createElement('td', { key: 'pop', className: 'px-3 py-2 text-right text-gray-600' }, formatNumber(market.pop)),
                            React.createElement('td', { key: 'weekly', className: 'px-3 py-2 text-right font-medium text-indigo-600' }, formatNumber(market.weeklyImps)),
                            React.createElement('td', { key: 'total', className: 'px-3 py-2 text-right font-bold text-gray-800' }, formatNumber(market.totalImps)),
                            React.createElement('td', { key: 'cpm', className: 'px-3 py-2 text-right text-gray-600' }, '$' + market.cpm.toFixed(2)),
                            React.createElement('td', { key: 'cost', className: 'px-3 py-2 text-right font-medium text-emerald-600' }, formatCurrency(market.cost))
                        ])
                    )
                ),
                React.createElement('tfoot', { key: 'foot' },
                    React.createElement('tr', { className: 'bg-indigo-50 font-bold' }, [
                        React.createElement('td', { key: 'label', className: 'px-3 py-2' }, 'Total'),
                        React.createElement('td', { key: 'pop', className: 'px-3 py-2 text-right' }, formatNumber(sortedMarkets.reduce((s, m) => s + m.pop, 0))),
                        React.createElement('td', { key: 'weekly', className: 'px-3 py-2 text-right text-indigo-600' }, formatNumber(sortedMarkets.reduce((s, m) => s + m.weeklyImps, 0))),
                        React.createElement('td', { key: 'total', className: 'px-3 py-2 text-right text-indigo-700' }, formatNumber(sortedMarkets.reduce((s, m) => s + m.totalImps, 0))),
                        React.createElement('td', { key: 'cpm', className: 'px-3 py-2 text-right' }, '-'),
                        React.createElement('td', { key: 'cost', className: 'px-3 py-2 text-right text-emerald-700' }, formatCurrency(sortedMarkets.reduce((s, m) => s + m.cost, 0)))
                    ])
                )
            ])
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // CAMPAIGN CALCULATOR COMPONENT
    // ═══════════════════════════════════════════════════════════════════════════════
    const CampaignCalculator = ({ onCalculate }) => {
        const [units, setUnits] = useState(10);
        const [weeks, setWeeks] = useState(4);
        const [format, setFormat] = useState('Digital Billboard');

        const calculation = useMemo(() => {
            return calculateCampaignImpressions(units, format, weeks);
        }, [units, weeks, format]);

        return React.createElement('div', {
            className: 'bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white'
        }, [
            React.createElement('h3', {
                key: 'title',
                className: 'text-lg font-bold mb-4 flex items-center gap-2'
            }, ['🧮 Campaign Calculator']),

            React.createElement('div', {
                key: 'inputs',
                className: 'grid grid-cols-3 gap-4 mb-6'
            }, [
                React.createElement('div', { key: 'units' }, [
                    React.createElement('label', { className: 'text-indigo-100 text-sm block mb-1' }, 'Units'),
                    React.createElement('input', {
                        type: 'number',
                        value: units,
                        onChange: (e) => setUnits(parseInt(e.target.value) || 0),
                        className: 'w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50',
                        min: 1
                    })
                ]),
                React.createElement('div', { key: 'weeks' }, [
                    React.createElement('label', { className: 'text-indigo-100 text-sm block mb-1' }, 'Weeks'),
                    React.createElement('input', {
                        type: 'number',
                        value: weeks,
                        onChange: (e) => setWeeks(parseInt(e.target.value) || 0),
                        className: 'w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50',
                        min: 1,
                        max: 52
                    })
                ]),
                React.createElement('div', { key: 'format' }, [
                    React.createElement('label', { className: 'text-indigo-100 text-sm block mb-1' }, 'Format'),
                    React.createElement('select', {
                        value: format,
                        onChange: (e) => setFormat(e.target.value),
                        className: 'w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-white/50'
                    },
                        Object.keys(PRODUCT_FORMATS).map(f =>
                            React.createElement('option', { key: f, value: f, className: 'text-gray-800' }, f)
                        )
                    )
                ])
            ]),

            React.createElement('div', {
                key: 'results',
                className: 'grid grid-cols-4 gap-3'
            }, [
                React.createElement('div', {
                    key: 'weekly-unit',
                    className: 'bg-white/10 rounded-xl p-3'
                }, [
                    React.createElement('div', { className: 'text-indigo-100 text-xs' }, 'Weekly/Unit'),
                    React.createElement('div', { className: 'text-xl font-bold' }, calculation.formatted.weeklyPerUnit)
                ]),
                React.createElement('div', {
                    key: 'total-weekly',
                    className: 'bg-white/10 rounded-xl p-3'
                }, [
                    React.createElement('div', { className: 'text-indigo-100 text-xs' }, 'Total Weekly'),
                    React.createElement('div', { className: 'text-xl font-bold' }, calculation.formatted.totalWeekly)
                ]),
                React.createElement('div', {
                    key: 'campaign',
                    className: 'bg-white/20 rounded-xl p-3'
                }, [
                    React.createElement('div', { className: 'text-indigo-100 text-xs' }, 'Campaign Total'),
                    React.createElement('div', { className: 'text-2xl font-bold' }, calculation.formatted.campaignTotal)
                ]),
                React.createElement('div', {
                    key: 'cost',
                    className: 'bg-emerald-500/30 rounded-xl p-3'
                }, [
                    React.createElement('div', { className: 'text-emerald-100 text-xs' }, 'Est. Cost'),
                    React.createElement('div', { className: 'text-xl font-bold' }, calculation.formatted.cost)
                ])
            ])
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // HEATMAP CELL COMPONENT
    // ═══════════════════════════════════════════════════════════════════════════════
    const HeatmapCell = ({ value, maxValue, label, onClick, selected }) => {
        const intensity = maxValue > 0 ? value / maxValue : 0;

        const getColor = (intensity) => {
            if (intensity < 0.25) return `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`;
            if (intensity < 0.5) return `rgba(139, 92, 246, ${0.3 + intensity * 0.7})`;
            if (intensity < 0.75) return `rgba(236, 72, 153, ${0.4 + intensity * 0.6})`;
            return `rgba(239, 68, 68, ${0.5 + intensity * 0.5})`;
        };

        return React.createElement('div', {
            onClick,
            className: `p-2 text-center cursor-pointer transition-all hover:scale-105 rounded-lg ${
                selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
            }`,
            style: { backgroundColor: getColor(intensity) },
            title: label
        }, [
            React.createElement('div', {
                key: 'value',
                className: `font-bold ${intensity > 0.5 ? 'text-white' : 'text-gray-800'}`
            }, formatNumber(value)),
            React.createElement('div', {
                key: 'label',
                className: `text-[10px] ${intensity > 0.5 ? 'text-white/80' : 'text-gray-600'}`
            }, 'imps/wk')
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // PDF EXPORT FUNCTION
    // ═══════════════════════════════════════════════════════════════════════════════
    const generateProposalPDF = (proposalName, clientName, campaignSummary, regionStats, selectedMarkets, weeks) => {
        const formatCategories = {};
        Object.entries(PRODUCT_FORMATS).forEach(([name, data]) => {
            const cat = data.category;
            if (!formatCategories[cat]) formatCategories[cat] = [];
            formatCategories[cat].push({ name, ...data });
        });

        const sortedRegions = Object.values(regionStats).sort((a, b) => b.avgDensity - a.avgDensity);
        const totalRegionPop = sortedRegions.reduce((s, r) => s + r.totalPop, 0);

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${proposalName} - OOH Impressions Proposal</title>
    <style>
        @page { margin: 0.5in; size: letter; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; }
        .page { page-break-after: always; padding: 20px; }
        .page:last-child { page-break-after: auto; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 24pt; margin-bottom: 8px; }
        .header .subtitle { opacity: 0.9; font-size: 12pt; }
        .header .meta { display: flex; gap: 20px; margin-top: 15px; font-size: 10pt; opacity: 0.8; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 14pt; font-weight: 700; color: #4f46e5; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e0e7ff; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center; }
        .stat-value { font-size: 22pt; font-weight: 700; color: #4f46e5; }
        .stat-label { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .table th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        .table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .table tr:nth-child(even) { background: #f8fafc; }
        .format-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .format-card { background: #f8fafc; border-radius: 8px; padding: 12px; border-left: 4px solid; }
        .format-name { font-weight: 600; font-size: 10pt; }
        .format-stats { font-size: 9pt; color: #64748b; }
        .region-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .region-name { width: 120px; font-size: 10pt; }
        .region-bar-fill { height: 20px; border-radius: 4px; display: flex; align-items: center; padding: 0 8px; color: white; font-size: 9pt; font-weight: 600; }
        .footer { text-align: center; font-size: 9pt; color: #94a3b8; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
        .highlight { background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%); border-radius: 10px; padding: 16px; margin: 15px 0; }
        .disclaimer { font-size: 8pt; color: #94a3b8; font-style: italic; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1>${proposalName}</h1>
            <div class="subtitle">${clientName ? `Prepared for ${clientName}` : 'OOH Impressions Analysis'}</div>
            <div class="meta">
                <span>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>Duration: ${weeks}-Week Campaign</span>
                <span>Markets: ${selectedMarkets.length} Market${selectedMarkets.length > 1 ? 's' : ''}</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Campaign Summary</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${formatNumber(campaignSummary.total || 0)}</div>
                    <div class="stat-label">Total Impressions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(PRODUCT_FORMATS).length}</div>
                    <div class="stat-label">Product Formats</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(LA_REGIONS).length}</div>
                    <div class="stat-label">Coverage Regions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(LA_ZIP_DATA).length}</div>
                    <div class="stat-label">ZIP Codes</div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Product Format Breakdown</div>
            <div class="format-grid">
                ${Object.entries(PRODUCT_FORMATS).map(([name, data]) => `
                    <div class="format-card" style="border-color: ${data.color};">
                        <div class="format-name">${name}</div>
                        <div class="format-stats">${formatNumber(data.weekly)} weekly/unit - ${data.tier}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Regional Coverage (LA Metro)</div>
            ${sortedRegions.slice(0, 10).map(region => {
                const width = (region.totalPop / totalRegionPop) * 100;
                return `
                    <div class="region-bar">
                        <div class="region-name">${region.label}</div>
                        <div class="region-bar-fill" style="width: ${Math.max(width * 3, 15)}%; background: ${region.color};">
                            ${formatNumber(region.totalPop)} pop
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="highlight">
            <strong>Methodology:</strong> Impressions estimates are based on Geopath-equivalent methodology using US Census 2022 population data,
            population density calculations, and industry-standard visibility multipliers per product format.
        </div>

        <div class="disclaimer">
            * All impressions are estimates based on industry benchmarks. Actual delivery may vary based on specific placements, traffic patterns,
            weather conditions, and time of day. CPM rates are market estimates and subject to negotiation.
        </div>

        <div class="footer">
            Generated by STAP Impressions Dashboard • ${new Date().toISOString().split('T')[0]}
        </div>
    </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
            win.onload = () => {
                win.print();
            };
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // IMPRESSIONS DASHBOARD COMPONENT
    // ═══════════════════════════════════════════════════════════════════════════════
    const ImpressionsDashboard = ({
        campaignData = [],
        proposalName = 'OOH Proposal',
        clientName = '',
        showExport = true
    }) => {
        const [selectedFormat, setSelectedFormat] = useState(null);
        const [selectedRegion, setSelectedRegion] = useState(null);
        const [viewMode, setViewMode] = useState('overview');
        const [campaignWeeks, setCampaignWeeks] = useState(4);
        const [selectedMarkets, setSelectedMarkets] = useState(['Los Angeles, CA']);
        const dashboardRef = useRef(null);

        // Calculate region-level statistics
        const regionStats = useMemo(() => {
            const stats = {};

            for (const [zip, data] of Object.entries(LA_ZIP_DATA)) {
                const region = data.region;
                if (!stats[region]) {
                    stats[region] = {
                        region,
                        ...LA_REGIONS[region],
                        zips: [],
                        totalPop: 0,
                        totalSqMi: 0,
                        avgDensity: 0,
                        impressions: {}
                    };
                }

                stats[region].zips.push(zip);
                stats[region].totalPop += data.pop;
                stats[region].totalSqMi += data.sqMi;
            }

            for (const region of Object.values(stats)) {
                region.avgDensity = Math.round(region.totalPop / region.totalSqMi);
                const baseImps = region.avgDensity * 0.75;

                for (const [format, formatData] of Object.entries(PRODUCT_FORMATS)) {
                    region.impressions[format] = Math.round(baseImps * formatData.multiplier);
                }
            }

            return stats;
        }, []);

        // Build heatmap data
        const heatmapData = useMemo(() => {
            const formats = Object.keys(PRODUCT_FORMATS);
            const regions = Object.keys(LA_REGIONS);

            const matrix = {};
            let maxValue = 0;

            for (const format of formats) {
                matrix[format] = {};
                for (const region of regions) {
                    const value = regionStats[region]?.impressions[format] || 0;
                    matrix[format][region] = value;
                    if (value > maxValue) maxValue = value;
                }
            }

            return { matrix, formats, regions, maxValue };
        }, [regionStats]);

        // Campaign impressions summary
        const campaignSummary = useMemo(() => {
            if (!campaignData || campaignData.length === 0) {
                return { total: 0, byFormat: {}, byMarket: {}, byCategory: {} };
            }

            let total = 0;
            const byFormat = {};
            const byMarket = {};
            const byCategory = {};

            for (const item of campaignData) {
                const units = item.quantity || item.units || 1;
                const product = item.product || item.media || 'Standard';
                const market = item.market || 'Los Angeles, CA';

                const imps = calculateCampaignImpressions(units, product, campaignWeeks);
                const formatInfo = getProductImpressions(product);
                total += imps.campaignTotal;

                byFormat[product] = (byFormat[product] || 0) + imps.campaignTotal;
                byMarket[market] = (byMarket[market] || 0) + imps.campaignTotal;
                byCategory[formatInfo.category || 'Static'] = (byCategory[formatInfo.category || 'Static'] || 0) + imps.campaignTotal;
            }

            return { total, byFormat, byMarket, byCategory };
        }, [campaignData, campaignWeeks]);

        // Format chart data
        const formatChartData = useMemo(() => {
            return Object.entries(PRODUCT_FORMATS).map(([name, data]) => ({
                label: name,
                value: data.weekly,
                color: data.color
            }));
        }, []);

        // Category chart data
        const categoryChartData = useMemo(() => {
            const categories = {};
            Object.entries(PRODUCT_FORMATS).forEach(([name, data]) => {
                const cat = data.category;
                if (!categories[cat]) {
                    categories[cat] = { value: 0, color: data.color };
                }
                categories[cat].value += data.weekly;
            });
            return Object.entries(categories).map(([label, data]) => ({
                label,
                ...data
            }));
        }, []);

        // Region chart data
        const regionChartData = useMemo(() => {
            return Object.values(regionStats).map(r => ({
                label: r.label || r.region,
                value: r.avgDensity,
                color: r.color
            }));
        }, [regionStats]);

        // Handle PDF Export
        const handleExportPDF = () => {
            generateProposalPDF(proposalName, clientName, campaignSummary, regionStats, selectedMarkets, campaignWeeks);
        };

        // Toggle market selection
        const toggleMarket = (market) => {
            setSelectedMarkets(prev =>
                prev.includes(market)
                    ? prev.filter(m => m !== market)
                    : [...prev, market]
            );
        };

        // Render Heatmap Table
        const renderHeatmap = () => {
            const { matrix, formats, regions, maxValue } = heatmapData;

            return React.createElement('div', { className: 'overflow-x-auto' },
                React.createElement('table', { className: 'w-full border-collapse' }, [
                    React.createElement('thead', { key: 'head' },
                        React.createElement('tr', {}, [
                            React.createElement('th', {
                                key: 'corner',
                                className: 'p-2 text-left text-xs font-bold text-gray-600 bg-gray-50 sticky left-0'
                            }, 'Format'),
                            ...regions.map(region =>
                                React.createElement('th', {
                                    key: region,
                                    className: `p-2 text-center text-xs font-bold cursor-pointer hover:bg-gray-100 transition-colors ${
                                        selectedRegion === region ? 'bg-indigo-100' : 'bg-gray-50'
                                    }`,
                                    onClick: () => setSelectedRegion(selectedRegion === region ? null : region)
                                }, [
                                    React.createElement('div', {
                                        key: 'color',
                                        className: 'w-3 h-3 rounded-full mx-auto mb-1',
                                        style: { backgroundColor: LA_REGIONS[region]?.color }
                                    }),
                                    React.createElement('div', { key: 'name', className: 'text-[10px]' }, region)
                                ])
                            )
                        ])
                    ),
                    React.createElement('tbody', { key: 'body' },
                        formats.map(format =>
                            React.createElement('tr', {
                                key: format,
                                className: selectedFormat === format ? 'bg-indigo-50' : ''
                            }, [
                                React.createElement('td', {
                                    key: 'label',
                                    className: `p-2 text-xs font-medium cursor-pointer hover:bg-gray-50 sticky left-0 bg-white ${
                                        selectedFormat === format ? 'bg-indigo-100' : ''
                                    }`,
                                    onClick: () => setSelectedFormat(selectedFormat === format ? null : format)
                                }, [
                                    React.createElement('span', { key: 'icon', className: 'mr-1' }, PRODUCT_FORMATS[format]?.icon),
                                    format.split(' ').slice(0, 2).join(' ')
                                ]),
                                ...regions.map(region =>
                                    React.createElement('td', { key: region, className: 'p-1' },
                                        React.createElement(HeatmapCell, {
                                            value: matrix[format][region],
                                            maxValue,
                                            label: `${format} in ${region}: ${formatNumber(matrix[format][region])} imps/week`,
                                            onClick: () => {
                                                setSelectedFormat(format);
                                                setSelectedRegion(region);
                                            },
                                            selected: selectedFormat === format && selectedRegion === region
                                        })
                                    )
                                )
                            ])
                        )
                    )
                ])
            );
        };

        // Main render
        return React.createElement('div', {
            ref: dashboardRef,
            className: 'bg-gray-50 min-h-screen'
        }, [
            // Header with Summary Stats
            React.createElement('div', {
                key: 'header',
                className: 'bg-white border-b border-gray-200 p-6'
            }, [
                React.createElement('div', {
                    key: 'title-row',
                    className: 'flex items-center justify-between mb-6'
                }, [
                    React.createElement('div', { key: 'left' }, [
                        React.createElement('h1', {
                            key: 'title',
                            className: 'text-2xl font-bold text-gray-900 flex items-center gap-2'
                        }, ['📊 Impressions Dashboard']),
                        React.createElement('p', {
                            key: 'subtitle',
                            className: 'text-gray-500'
                        }, proposalName + (clientName ? ` • ${clientName}` : ''))
                    ]),
                    React.createElement('div', { key: 'actions', className: 'flex items-center gap-3' }, [
                        React.createElement('div', { key: 'weeks', className: 'flex items-center gap-2' }, [
                            React.createElement('label', { className: 'text-sm text-gray-600' }, 'Weeks:'),
                            React.createElement('select', {
                                value: campaignWeeks,
                                onChange: (e) => setCampaignWeeks(parseInt(e.target.value)),
                                className: 'px-3 py-1.5 border border-gray-300 rounded-lg text-sm'
                            }, [1, 2, 4, 8, 12, 16, 26, 52].map(w =>
                                React.createElement('option', { key: w, value: w }, `${w} wk`)
                            ))
                        ]),
                        showExport && React.createElement('button', {
                            key: 'export',
                            onClick: handleExportPDF,
                            className: 'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2'
                        }, ['📄 Export PDF'])
                    ])
                ]),

                // Summary Stats Row
                React.createElement('div', {
                    key: 'stats',
                    className: 'grid grid-cols-2 md:grid-cols-5 gap-4'
                }, [
                    React.createElement('div', {
                        key: 'total',
                        className: 'bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white'
                    }, [
                        React.createElement('div', { key: 'label', className: 'text-indigo-100 text-sm' }, 'Campaign Impressions'),
                        React.createElement('div', { key: 'value', className: 'text-3xl font-bold' }, formatNumber(campaignSummary.total || Object.values(PRODUCT_FORMATS).reduce((s, f) => s + f.weekly, 0) * 10)),
                        React.createElement('div', { key: 'period', className: 'text-indigo-200 text-xs' }, `${campaignWeeks}-week estimate`)
                    ]),
                    React.createElement('div', {
                        key: 'formats',
                        className: 'bg-white border border-gray-200 rounded-xl p-4'
                    }, [
                        React.createElement('div', { key: 'label', className: 'text-gray-500 text-sm' }, 'Formats'),
                        React.createElement('div', { key: 'value', className: 'text-3xl font-bold text-gray-900' }, Object.keys(PRODUCT_FORMATS).length),
                        React.createElement('div', { key: 'sub', className: 'text-gray-400 text-xs' }, 'product types')
                    ]),
                    React.createElement('div', {
                        key: 'regions',
                        className: 'bg-white border border-gray-200 rounded-xl p-4'
                    }, [
                        React.createElement('div', { key: 'label', className: 'text-gray-500 text-sm' }, 'Regions'),
                        React.createElement('div', { key: 'value', className: 'text-3xl font-bold text-gray-900' }, Object.keys(LA_REGIONS).length),
                        React.createElement('div', { key: 'sub', className: 'text-gray-400 text-xs' }, 'LA coverage areas')
                    ]),
                    React.createElement('div', {
                        key: 'zips',
                        className: 'bg-white border border-gray-200 rounded-xl p-4'
                    }, [
                        React.createElement('div', { key: 'label', className: 'text-gray-500 text-sm' }, 'ZIP Codes'),
                        React.createElement('div', { key: 'value', className: 'text-3xl font-bold text-gray-900' }, Object.keys(LA_ZIP_DATA).length),
                        React.createElement('div', { key: 'sub', className: 'text-gray-400 text-xs' }, 'with demographics')
                    ]),
                    React.createElement('div', {
                        key: 'markets',
                        className: 'bg-white border border-gray-200 rounded-xl p-4'
                    }, [
                        React.createElement('div', { key: 'label', className: 'text-gray-500 text-sm' }, 'Markets'),
                        React.createElement('div', { key: 'value', className: 'text-3xl font-bold text-gray-900' }, Object.keys(MARKET_DATA).length),
                        React.createElement('div', { key: 'sub', className: 'text-gray-400 text-xs' }, 'available')
                    ])
                ])
            ]),

            // View Toggle
            React.createElement('div', {
                key: 'view-toggle',
                className: 'bg-white border-b border-gray-200 px-6 py-3'
            },
                React.createElement('div', { className: 'flex gap-1 bg-gray-100 rounded-xl p-1 inline-flex' },
                    [
                        ['overview', '📊 Overview'],
                        ['heatmap', '🗺️ Heatmap'],
                        ['formats', '📦 Formats'],
                        ['regions', '📍 Regions'],
                        ['markets', '🌎 Markets'],
                        ['calculator', '🧮 Calculator']
                    ].map(([mode, label]) =>
                        React.createElement('button', {
                            key: mode,
                            onClick: () => setViewMode(mode),
                            className: `px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                                viewMode === mode
                                    ? 'bg-white text-indigo-600 shadow'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`
                        }, label)
                    )
                )
            ),

            // Calculation Transparency Box (Inline)
            React.createElement('div', {
                key: 'calc-info',
                className: 'mx-6 mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4'
            }, [
                // Headline
                React.createElement('div', {
                    key: 'headline',
                    className: 'flex items-center gap-2 mb-3'
                }, [
                    React.createElement(Icon, { key: 'icon', name: 'Info', size: 16, className: 'text-purple-600' }),
                    React.createElement('span', {
                        key: 'text',
                        className: 'text-sm font-semibold text-gray-700'
                    }, 'How it\'s calculated')
                ]),
                // Formula Code Block
                React.createElement('div', {
                    key: 'formula',
                    className: 'bg-white border border-purple-100 rounded-md px-4 py-3 font-mono text-sm text-gray-800 mb-3'
                }, 'Weekly Imps = (Population ÷ Sq Miles) × 0.75 × Product Multiplier'),
                // Multipliers Footer
                React.createElement('div', {
                    key: 'multipliers',
                    className: 'text-xs text-purple-600'
                }, 'Product Multipliers: Panel-Targeted: 1.15x • Panel-Network: 0.95x • Digital: 2.8x • Transit Shelter: 0.65x • Wallscape: 1.4x • Poster: 0.75x')
            ]),

            // Main Content
            React.createElement('div', { key: 'content', className: 'p-6' }, [
                // Overview View
                viewMode === 'overview' && React.createElement('div', { key: 'overview', className: 'space-y-6' }, [
                    // Charts Row
                    React.createElement('div', { key: 'charts', className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' }, [
                        // Format Bar Chart
                        React.createElement('div', {
                            key: 'format-chart',
                            className: 'bg-white rounded-2xl shadow-lg p-6'
                        }, [
                            React.createElement('h3', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' }, '📦 Impressions by Format'),
                            React.createElement(BarChart, { data: formatChartData, horizontal: true, height: 300 })
                        ]),

                        // Category Donut Chart
                        React.createElement('div', {
                            key: 'category-chart',
                            className: 'bg-white rounded-2xl shadow-lg p-6'
                        }, [
                            React.createElement('h3', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' }, '📊 Format Categories'),
                            React.createElement('div', { key: 'chart', className: 'flex justify-center' },
                                React.createElement(DonutChart, {
                                    data: categoryChartData,
                                    size: 200,
                                    centerLabel: 'categories',
                                    centerValue: categoryChartData.length
                                })
                            )
                        ])
                    ]),

                    // Region Heatmap
                    React.createElement('div', {
                        key: 'region-map',
                        className: 'bg-white rounded-2xl shadow-lg p-6'
                    }, [
                        React.createElement('h3', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' }, '📍 LA Region Coverage'),
                        React.createElement(RegionHeatmap, {
                            regionStats,
                            selectedRegion,
                            onSelectRegion: setSelectedRegion,
                            selectedFormat
                        })
                    ]),

                    // Region Bar Chart
                    React.createElement('div', {
                        key: 'region-chart',
                        className: 'bg-white rounded-2xl shadow-lg p-6'
                    }, [
                        React.createElement('h3', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' }, '📈 Population Density by Region'),
                        React.createElement(BarChart, { data: regionChartData, height: 200 })
                    ])
                ]),

                // Heatmap View
                viewMode === 'heatmap' && React.createElement('div', {
                    key: 'heatmap',
                    className: 'bg-white rounded-2xl shadow-lg p-6'
                }, [
                    React.createElement('h2', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-2' }, '📊 Format × Region Impressions Matrix'),
                    React.createElement('p', { key: 'desc', className: 'text-gray-500 text-sm mb-4' }, 'Click cells to explore format/region combinations. Darker = higher impressions.'),
                    renderHeatmap(),
                    (selectedFormat || selectedRegion) && React.createElement('div', {
                        key: 'selection',
                        className: 'mt-6 p-4 bg-indigo-50 rounded-xl'
                    }, [
                        React.createElement('h4', { key: 'title', className: 'font-bold text-gray-900 mb-2' }, 'Selected:'),
                        React.createElement('div', { key: 'content', className: 'flex gap-4' }, [
                            selectedFormat && React.createElement('span', { key: 'format', className: 'px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm' },
                                PRODUCT_FORMATS[selectedFormat]?.icon + ' ' + selectedFormat
                            ),
                            selectedRegion && React.createElement('span', {
                                key: 'region',
                                className: 'px-3 py-1 rounded-lg text-sm text-white',
                                style: { backgroundColor: LA_REGIONS[selectedRegion]?.color }
                            }, LA_REGIONS[selectedRegion]?.label)
                        ])
                    ])
                ]),

                // Formats View
                viewMode === 'formats' && React.createElement('div', {
                    key: 'formats',
                    className: 'bg-white rounded-2xl shadow-lg p-6'
                }, [
                    React.createElement('h2', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' }, '📦 All Product Formats'),
                    React.createElement('div', { key: 'grid', className: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' },
                        Object.entries(PRODUCT_FORMATS).map(([format, data]) =>
                            React.createElement('div', {
                                key: format,
                                onClick: () => setSelectedFormat(selectedFormat === format ? null : format),
                                className: `p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
                                    selectedFormat === format ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                                }`
                            }, [
                                React.createElement('div', { key: 'header', className: 'flex items-center gap-2 mb-2' }, [
                                    React.createElement('span', { key: 'icon', className: 'text-2xl' }, data.icon),
                                    React.createElement('span', {
                                        key: 'tier',
                                        className: 'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                                        style: { backgroundColor: data.color + '20', color: data.color }
                                    }, data.tier)
                                ]),
                                React.createElement('div', { key: 'name', className: 'font-bold text-gray-800 text-sm mb-1' }, format),
                                React.createElement('div', { key: 'weekly', className: 'text-2xl font-bold', style: { color: data.color } }, formatNumber(data.weekly)),
                                React.createElement('div', { key: 'label', className: 'text-xs text-gray-500' }, 'weekly imps/unit'),
                                React.createElement('div', { key: 'cpm', className: 'text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100' }, `CPM: $${data.cpm.toFixed(2)} • ${data.multiplier}x mult`)
                            ])
                        )
                    )
                ]),

                // Regions View
                viewMode === 'regions' && React.createElement('div', {
                    key: 'regions',
                    className: 'space-y-6'
                }, [
                    React.createElement('div', {
                        key: 'map',
                        className: 'bg-white rounded-2xl shadow-lg p-6'
                    }, [
                        React.createElement('h2', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' }, '📍 LA Metro Regions'),
                        React.createElement(RegionHeatmap, {
                            regionStats,
                            selectedRegion,
                            onSelectRegion: setSelectedRegion,
                            selectedFormat
                        })
                    ]),
                    React.createElement('div', {
                        key: 'cards',
                        className: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'
                    },
                        Object.values(regionStats).sort((a, b) => b.avgDensity - a.avgDensity).map(region =>
                            React.createElement('div', {
                                key: region.region,
                                onClick: () => setSelectedRegion(selectedRegion === region.region ? null : region.region),
                                className: `bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                                    selectedRegion === region.region ? 'border-indigo-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                                }`
                            }, [
                                React.createElement('div', { key: 'header', className: 'flex items-center gap-2 mb-2' }, [
                                    React.createElement('div', {
                                        key: 'dot',
                                        className: 'w-4 h-4 rounded-full',
                                        style: { backgroundColor: region.color }
                                    }),
                                    React.createElement('span', { key: 'name', className: 'font-bold text-sm text-gray-800 truncate' }, region.label)
                                ]),
                                React.createElement('div', { key: 'density', className: 'text-2xl font-bold text-gray-900' }, formatNumber(region.avgDensity)),
                                React.createElement('div', { key: 'label', className: 'text-xs text-gray-500' }, 'pop/sq mi'),
                                React.createElement('div', { key: 'stats', className: 'text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100' },
                                    `${formatNumber(region.totalPop)} pop • ${region.zips.length} ZIPs`
                                )
                            ])
                        )
                    )
                ]),

                // Markets View
                viewMode === 'markets' && React.createElement('div', {
                    key: 'markets',
                    className: 'space-y-6'
                }, [
                    // Market Selection
                    React.createElement('div', {
                        key: 'market-select',
                        className: 'bg-white rounded-2xl shadow-lg p-6'
                    }, [
                        React.createElement('h2', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' }, '🌎 Select Markets'),
                        React.createElement('div', { key: 'markets', className: 'flex flex-wrap gap-2' },
                            Object.entries(MARKET_DATA).map(([name, data]) =>
                                React.createElement('button', {
                                    key: name,
                                    onClick: () => toggleMarket(name),
                                    className: `px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                        selectedMarkets.includes(name)
                                            ? 'text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`,
                                    style: selectedMarkets.includes(name) ? { backgroundColor: data.color } : {}
                                }, name)
                            )
                        )
                    ]),

                    // Format Selection for Comparison
                    React.createElement('div', {
                        key: 'format-select',
                        className: 'bg-white rounded-2xl shadow-lg p-6'
                    }, [
                        React.createElement('h3', { key: 'title', className: 'font-bold text-gray-900 mb-3' }, 'Select Format for Comparison'),
                        React.createElement('div', { key: 'formats', className: 'flex flex-wrap gap-2' },
                            Object.entries(PRODUCT_FORMATS).map(([name, data]) =>
                                React.createElement('button', {
                                    key: name,
                                    onClick: () => setSelectedFormat(name),
                                    className: `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                        selectedFormat === name
                                            ? 'text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`,
                                    style: selectedFormat === name ? { backgroundColor: data.color } : {}
                                }, data.icon + ' ' + name)
                            )
                        )
                    ]),

                    // Comparison Table
                    selectedMarkets.length > 0 && React.createElement('div', {
                        key: 'comparison',
                        className: 'bg-white rounded-2xl shadow-lg p-6'
                    }, [
                        React.createElement('h2', { key: 'title', className: 'text-lg font-bold text-gray-900 mb-4' },
                            `📊 Market Comparison: ${selectedFormat || 'Bulletin'}`
                        ),
                        React.createElement(MarketComparisonTable, {
                            markets: selectedMarkets,
                            selectedFormat: selectedFormat || 'Bulletin',
                            weeks: campaignWeeks
                        })
                    ])
                ]),

                // Calculator View
                viewMode === 'calculator' && React.createElement('div', {
                    key: 'calculator',
                    className: 'max-w-2xl mx-auto'
                },
                    React.createElement(CampaignCalculator, {})
                )
            ]),

            // Footer
            React.createElement('div', {
                key: 'footer',
                className: 'p-6 text-center text-xs text-gray-400'
            }, [
                '📊 Impressions estimates based on Geopath methodology • ',
                'Census 2022 demographics • ',
                `${Object.keys(LA_ZIP_DATA).length} LA ZIP codes • `,
                `${Object.keys(MARKET_DATA).length} markets`
            ])
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORT TO WINDOW
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAPImpressions = {
        ImpressionsDashboard,
        // Data exports
        LA_ZIP_DATA,
        MARKET_DATA,
        PRODUCT_FORMATS,
        LA_REGIONS,
        // Utility functions
        getProductImpressions,
        estimateZipImpressions,
        calculateCampaignImpressions,
        formatNumber,
        formatCurrency,
        // Components
        BarChart,
        DonutChart,
        RegionHeatmap,
        MarketComparisonTable,
        CampaignCalculator,
    };

    console.log('✅ STAP Impressions Dashboard v2.0 loaded');

})(window);
