// ===================================================================================================
// STAP OPERATIONS PORTAL - DEMO SYSTEM
// Combines guide components (from demoGuide.js) with tips, badges, and mock data generators
// ===================================================================================================

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    // ===================================================================================================
    // IMPORT GUIDE COMPONENTS FROM STANDALONE FILE
    // These are loaded via demoGuide.js which must be included before this file
    // ===================================================================================================
    const GuideComponents = window.STAPDemoGuide || {};
    const DemoActions = GuideComponents.DemoActions || window.DemoActions;
    const Confetti = GuideComponents.Confetti;
    const AnimatedCheckmark = GuideComponents.AnimatedCheckmark;
    const ProgressRing = GuideComponents.ProgressRing;
    const DemoWelcomeModal = GuideComponents.DemoWelcomeModal;
    const DemoGuidePanel = GuideComponents.DemoGuidePanel;
    const resetDemoProgress = GuideComponents.resetDemoProgress || (() => {
        try {
            localStorage.removeItem('stap_demo_progress');
            return true;
        } catch { return false; }
    });

    // ===================================================================================================
    // DEMO TIP - Contextual help boxes
    // ===================================================================================================
    const DemoTip = ({ title, children, type = 'info', showIf = true }) => {
        if (!showIf) return null;

        const configs = {
            info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: '💡' },
            success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: '✅' },
            warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: '⚠️' },
            feature: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', icon: '✨' },
            workflow: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', icon: '🔄' }
        };

        const config = configs[type] || configs.info;

        return React.createElement('div', {
            className: `${config.bg} ${config.border} ${config.text} border rounded-xl p-4 mb-3 text-sm animate-fade-in shadow-sm`
        }, [
            React.createElement('div', {
                key: 'header',
                className: 'font-bold flex items-center gap-2 mb-1'
            }, [
                React.createElement('span', { key: 'icon', className: 'text-lg' }, config.icon),
                React.createElement('span', { key: 'title' }, title),
                React.createElement('span', {
                    key: 'badge',
                    className: 'ml-auto text-[9px] opacity-50 uppercase font-normal tracking-wider'
                }, 'Demo')
            ]),
            React.createElement('div', {
                key: 'content',
                className: 'text-xs opacity-80 leading-relaxed'
            }, children)
        ]);
    };

    // ===================================================================================================
    // FEATURE BADGE - Highlight new/important features
    // ===================================================================================================
    const FeatureBadge = ({ label = 'New', showIf = true, pulse = true }) => {
        if (!showIf) return null;

        return React.createElement('span', {
            className: `ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wide shadow-lg ${pulse ? 'animate-pulse' : ''}`
        }, label);
    };

    // ===================================================================================================
    // MOCK DATA GENERATOR - Creates comprehensive demo campaign data
    // ===================================================================================================
    const generateMockData = () => {
        const today = new Date();
        const formatDate = (d) => `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
        const getRelDate = (days) => {
            const d = new Date(today);
            d.setDate(today.getDate() + days);
            return formatDate(d);
        };
        const getEndDate = (startDays, duration = 28) => getRelDate(startDays + duration);

        // Markets
        const markets = ['Los Angeles, CA', 'Dallas, TX', 'Miami, FL', 'Chicago, IL', 'New York, NY', 'Seattle, WA', 'San Francisco, CA', 'Boston, MA', 'Orlando, FL', 'Las Vegas, NV'];
        const products = ['Transit Shelter', 'Bus Bench', 'Urban Panel', 'Digital Billboard', 'Kiosk', 'Bus King', 'Bus Queen', 'Interior Card', 'Wallscape'];
        const owners = ['Sarah Chen', 'Mike Rodriguez', 'Jennifer Park', 'David Kim', 'Amanda Torres', 'Chris Johnson'];

        // Comprehensive holds array with all stages represented
        const holds = [
            // RFP Stage
            { id: '260102001-0', date: getRelDate(14), end: getEndDate(14), media: 'Transit Shelter', quantity: '75', advertiser: 'Target', client: 'Target Corporation', owner: owners[0], stage: 'RFP', market: markets[0], product: products[0], notes: 'Q1 2026 campaign proposal' },
            { id: '260105002-0', date: getRelDate(21), end: getEndDate(21), media: 'Digital Billboard', quantity: '12', advertiser: 'Spotify', client: 'Spotify USA', owner: owners[1], stage: 'RFP', market: markets[4], product: products[3], notes: 'Premium placement request' },

            // Initial Proposal
            { id: '260101003-0', date: getRelDate(10), end: getEndDate(10), media: 'Bus King', quantity: '40', advertiser: 'Uber', client: 'Uber Technologies', owner: owners[2], stage: 'Initial Proposal', market: markets[0], product: products[5], notes: 'Rideshare promotion' },
            { id: '260103004-0', date: getRelDate(18), end: getEndDate(18), media: 'Urban Panel', quantity: '60', advertiser: 'HBO Max', client: 'Warner Bros Discovery', owner: owners[3], stage: 'Initial Proposal', market: markets[2], product: products[2], notes: 'New series launch' },

            // Client Feedback
            { id: '251228005-0', date: getRelDate(5), end: getEndDate(5), media: 'Transit Shelter', quantity: '50', advertiser: 'Starbucks', client: 'Starbucks Corporation', owner: owners[4], stage: 'Client Feedback', market: markets[5], product: products[0], notes: 'Holiday campaign revisions' },

            // Pending Hold
            { id: '251225006-0', date: getRelDate(3), end: getEndDate(3), media: 'Bus Bench', quantity: '30', advertiser: 'Nike', client: 'Nike Inc', owner: owners[0], stage: 'Pending Hold', market: markets[0], product: products[1], notes: 'Air Max launch pending' },
            { id: '251230007-0', date: getRelDate(7), end: getEndDate(7), media: 'Kiosk', quantity: '25', advertiser: 'Paramount+', client: 'Paramount Global', owner: owners[1], stage: 'Pending Hold', market: markets[3], product: products[4], notes: 'Streaming service promo' },

            // On Hold
            { id: '251220008-0', date: getRelDate(-3), end: getEndDate(-3), media: 'Transit Shelter', quantity: '45', advertiser: 'Toyota', client: 'Toyota USA', owner: owners[2], stage: 'On Hold', market: markets[1], product: products[0], notes: 'Awaiting creative approval', holdReason: 'Creative revision needed' },
            { id: '251215009-0', date: getRelDate(-7), end: getEndDate(-7), media: 'Urban Panel', quantity: '80', advertiser: 'Pepsi', client: 'PepsiCo', owner: owners[3], stage: 'On Hold', market: markets[0], product: products[2], notes: 'Budget reallocation', holdReason: 'Budget review' },
            { id: '251218010-0', date: getRelDate(-5), end: getEndDate(-5), media: 'Wallscape', quantity: '3', advertiser: 'Louis Vuitton', client: 'LVMH', owner: owners[4], stage: 'On Hold', market: markets[4], product: products[8], notes: 'Design change request', holdReason: 'Creative changes' },

            // Pending Client/Finance Approval
            { id: '251222011-0', date: getRelDate(0), end: getEndDate(0), media: 'Digital Billboard', quantity: '8', advertiser: 'Amazon Prime', client: 'Amazon', owner: owners[5], stage: 'Pending Client Approval', market: markets[0], product: products[3], notes: 'Thursday Night Football' },
            { id: '251224012-0', date: getRelDate(2), end: getEndDate(2), media: 'Bus Queen', quantity: '35', advertiser: 'Lyft', client: 'Lyft Inc', owner: owners[0], stage: 'Pending Finance Approval', market: markets[6], product: products[6], notes: 'SF market expansion' },

            // Contracted
            { id: '251210013-0', date: getRelDate(-5), end: getEndDate(-5, 42), media: 'Transit Shelter', quantity: '100', advertiser: 'Netflix', client: 'Netflix Inc', owner: owners[1], stage: 'Contracted', market: markets[0], product: products[0], notes: 'Stranger Things S5 campaign', posterImage: 'https://picsum.photos/seed/netflix-contract/400/600' },
            { id: '251212014-0', date: getRelDate(-3), end: getEndDate(-3, 35), media: 'Urban Panel', quantity: '55', advertiser: 'Apple', client: 'Apple Inc', owner: owners[2], stage: 'Contracted', market: markets[4], product: products[2], notes: 'iPhone 17 teaser', posterImage: 'https://picsum.photos/seed/apple-contract/400/600' },
            { id: '251215015-0', date: getRelDate(1), end: getEndDate(1, 28), media: 'Bus King', quantity: '45', advertiser: 'Disney+', client: 'The Walt Disney Company', owner: owners[3], stage: 'Contracted', market: markets[8], product: products[5], notes: 'Marvel series premiere' },

            // Proofs Approved
            { id: '251205016-0', date: getRelDate(-8), end: getEndDate(-8, 35), media: 'Transit Shelter', quantity: '65', advertiser: 'Samsung', client: 'Samsung Electronics', owner: owners[4], stage: 'Proofs Approved', market: markets[0], product: products[0], notes: 'Galaxy S26 launch', posterImage: 'https://picsum.photos/seed/samsung-proof/400/600' },
            { id: '251208017-0', date: getRelDate(-6), end: getEndDate(-6, 28), media: 'Digital Billboard', quantity: '10', advertiser: 'Meta', client: 'Meta Platforms', owner: owners[5], stage: 'Proofs Approved', market: markets[6], product: products[3], notes: 'Quest 4 VR headset' },

            // Working On It
            { id: '251201018-0', date: getRelDate(-12), end: getEndDate(-12, 42), media: 'Urban Panel', quantity: '90', advertiser: 'Coca-Cola', client: 'The Coca-Cola Company', owner: owners[0], stage: 'Working On It', market: markets[0], product: products[2], notes: 'Summer refresh campaign', posterImage: 'https://picsum.photos/seed/coke-working/400/600' },
            { id: '251203019-0', date: getRelDate(-10), end: getEndDate(-10, 35), media: 'Kiosk', quantity: '40', advertiser: 'Adidas', client: 'Adidas AG', owner: owners[1], stage: 'Working On It', market: markets[3], product: products[4], notes: 'Ultraboost 2026' },

            // Proofs Out For Approval
            { id: '251128020-0', date: getRelDate(-15), end: getEndDate(-15, 28), media: 'Transit Shelter', quantity: '55', advertiser: 'Honda', client: 'Honda Motor Co', owner: owners[2], stage: 'Proofs Out For Approval', market: markets[1], product: products[0], notes: 'CR-V Hybrid campaign', posterImage: 'https://picsum.photos/seed/honda-proofs/400/600' },

            // Artwork Received
            { id: '251125021-0', date: getRelDate(-18), end: getEndDate(-18, 35), media: 'Bus Bench', quantity: '28', advertiser: 'Chipotle', client: 'Chipotle Mexican Grill', owner: owners[3], stage: 'Artwork Received', market: markets[0], product: products[1], notes: 'New menu items launch', posterImage: 'https://picsum.photos/seed/chipotle-art/400/600' },
            { id: '251126022-0', date: getRelDate(-17), end: getEndDate(-17, 28), media: 'Urban Panel', quantity: '70', advertiser: 'Hulu', client: 'The Walt Disney Company', owner: owners[4], stage: 'Artwork Received', market: markets[0], product: products[2], notes: 'Award season campaign' },

            // Material Ready For Install
            { id: '251120023-0', date: getRelDate(-20), end: getEndDate(-20, 42), media: 'Transit Shelter', quantity: '85', advertiser: 'McDonald\'s', client: 'McDonald\'s Corporation', owner: owners[5], stage: 'Material Ready For Install', market: markets[0], product: products[0], notes: 'McRib limited time', posterImage: 'https://picsum.photos/seed/mcdonalds-ready/400/600' },
            { id: '251118024-0', date: getRelDate(-22), end: getEndDate(-22, 35), media: 'Digital Billboard', quantity: '15', advertiser: 'T-Mobile', client: 'T-Mobile US', owner: owners[0], stage: 'Material Ready For Install', market: markets[5], product: products[3], notes: '5G network expansion', posterImage: 'https://picsum.photos/seed/tmobile-ready/400/600' },
            { id: '251119025-0', date: getRelDate(-21), end: getEndDate(-21, 28), media: 'Bus King', quantity: '50', advertiser: 'Peacock', client: 'NBCUniversal', owner: owners[1], stage: 'Material Ready For Install', market: markets[3], product: products[5], notes: 'Olympics coverage promo' },

            // Installed (active campaigns with POP photos needed)
            { id: '251101026-0', date: getRelDate(-35), end: getEndDate(-35, 56), media: 'Transit Shelter', quantity: '120', advertiser: 'Google', client: 'Alphabet Inc', owner: owners[2], stage: 'Installed', market: markets[0], product: products[0], notes: 'Pixel 10 launch', posterImage: 'https://picsum.photos/seed/google-installed/400/600', popStatus: 'Partial', popCount: 87 },
            { id: '251105027-0', date: getRelDate(-30), end: getEndDate(-30, 42), media: 'Urban Panel', quantity: '75', advertiser: 'Microsoft', client: 'Microsoft Corporation', owner: owners[3], stage: 'Installed', market: markets[4], product: products[2], notes: 'Surface Pro campaign', posterImage: 'https://picsum.photos/seed/microsoft-installed/400/600', popStatus: 'Complete', popCount: 75 },
            { id: '251108028-0', date: getRelDate(-28), end: getEndDate(-28, 35), media: 'Bus Queen', quantity: '40', advertiser: 'American Express', client: 'American Express Co', owner: owners[4], stage: 'Installed', market: markets[0], product: products[6], notes: 'Travel rewards promo', posterImage: 'https://picsum.photos/seed/amex-installed/400/600', popStatus: 'In Progress', popCount: 22 },
            { id: '251110029-0', date: getRelDate(-25), end: getEndDate(-25, 28), media: 'Digital Billboard', quantity: '18', advertiser: 'BMW', client: 'BMW Group', owner: owners[5], stage: 'Installed', market: markets[0], product: products[3], notes: 'Electric i5 launch', posterImage: 'https://picsum.photos/seed/bmw-installed/400/600', popStatus: 'Pending', popCount: 0 },
            { id: '251112030-0', date: getRelDate(-23), end: getEndDate(-23, 35), media: 'Kiosk', quantity: '35', advertiser: 'Verizon', client: 'Verizon Communications', owner: owners[0], stage: 'Installed', market: markets[3], product: products[4], notes: 'Black Friday deals', popStatus: 'Partial', popCount: 28 },

            // POP Completed
            { id: '251015031-0', date: getRelDate(-50), end: getEndDate(-50, 42), media: 'Transit Shelter', quantity: '95', advertiser: 'Walmart', client: 'Walmart Inc', owner: owners[1], stage: 'POP Completed', market: markets[0], product: products[0], notes: 'Holiday savings campaign', posterImage: 'https://picsum.photos/seed/walmart-pop/400/600', popStatus: 'Complete', popCount: 95 },
            { id: '251018032-0', date: getRelDate(-47), end: getEndDate(-47, 35), media: 'Urban Panel', quantity: '60', advertiser: 'CVS Health', client: 'CVS Health Corporation', owner: owners[2], stage: 'POP Completed', market: markets[2], product: products[2], notes: 'Flu shot awareness', posterImage: 'https://picsum.photos/seed/cvs-pop/400/600', popStatus: 'Complete', popCount: 60 },
            { id: '251020033-0', date: getRelDate(-45), end: getEndDate(-45, 28), media: 'Bus Bench', quantity: '42', advertiser: 'Chase', client: 'JPMorgan Chase', owner: owners[3], stage: 'POP Completed', market: markets[4], product: products[1], notes: 'Sapphire card launch', posterImage: 'https://picsum.photos/seed/chase-pop/400/600', popStatus: 'Complete', popCount: 42 },

            // Takedown Complete (archived)
            { id: '250915034-0', date: getRelDate(-80), end: getRelDate(-40), media: 'Transit Shelter', quantity: '80', advertiser: 'Delta', client: 'Delta Air Lines', owner: owners[4], stage: 'Takedown Complete', market: markets[0], product: products[0], notes: 'Summer travel campaign', posterImage: 'https://picsum.photos/seed/delta-takedown/400/600', popStatus: 'Complete', popCount: 80 },
            { id: '250920035-0', date: getRelDate(-75), end: getRelDate(-35), media: 'Urban Panel', quantity: '55', advertiser: 'FedEx', client: 'FedEx Corporation', owner: owners[5], stage: 'Takedown Complete', market: markets[1], product: products[2], notes: 'Express shipping promo', posterImage: 'https://picsum.photos/seed/fedex-takedown/400/600', popStatus: 'Complete', popCount: 55 }
        ];

        // Add realistic POP photo data for installed campaigns
        holds.forEach(h => {
            if (h.popCount > 0) {
                h.popPhotos = [];
                for (let i = 0; i < Math.min(h.popCount, 5); i++) {
                    h.popPhotos.push({
                        url: `https://picsum.photos/seed/${h.id}-${i}/800/600`,
                        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
                        location: `${h.market.split(',')[0]} - Site ${100 + i}`,
                        verified: Math.random() > 0.2
                    });
                }
            }
        });

        return { holds, installs: holds };
    };

    // ===================================================================================================
    // DEMO MATERIALS DATA - Sample inventory for Material Receivers
    // ===================================================================================================
    const getDemoMaterials = () => [
        {
            id: 'INV174645',
            receiptNumber: 'INV174645',
            dateReceived: new Date('2025-12-20T09:30:00'),
            description: 'NETFLIX STRANGER THINGS-STF',
            posterCode: 'STF-NETFLIX-S5',
            client: 'NETFLIX',
            advertiser: 'Netflix',
            printer: 'SUPERIOR GRAPHICS LA',
            quantity: 120,
            boxes: 8,
            designs: 3,
            comments: 'RECEIVED 8 BOXES; 3 DESIGNS - KEY ART, ELEVEN, GROUP',
            status: 'Partially Deployed',
            warehouseLocation: 'Bay 2 - Shelf A3',
            matchedCampaign: '251210013-0',
            deployedQty: 45,
            posterImage: 'https://picsum.photos/seed/netflix-stranger/400/500',
            keywords: ['netflix', 'stranger', 'things', 'streaming']
        },
        {
            id: 'INV174640',
            receiptNumber: 'INV174640',
            dateReceived: new Date('2025-12-19T14:15:00'),
            description: 'SAMSUNG GALAXY S26-GAL',
            posterCode: 'GAL-SAM-S26',
            client: 'SAMSUNG',
            advertiser: 'Samsung',
            printer: 'PACIFIC PRINT HOUSE',
            quantity: 85,
            boxes: 5,
            designs: 2,
            comments: 'RECEIVED 5 BOXES; 2 DESIGNS - PRODUCT SHOT, LIFESTYLE',
            status: 'In Warehouse',
            warehouseLocation: 'Bay 1 - Shelf B2',
            matchedCampaign: '251205016-0',
            posterImage: 'https://picsum.photos/seed/samsung-galaxy/400/500',
            keywords: ['samsung', 'galaxy', 'phone', 'tech']
        },
        {
            id: 'INV174635',
            receiptNumber: 'INV174635',
            dateReceived: new Date('2025-12-17T10:00:00'),
            description: 'DISNEY+ MARVEL-DIS',
            posterCode: 'MARVEL-DIS-2026',
            client: 'DISNEY',
            advertiser: 'Disney+',
            printer: 'MAGIC PRINT STUDIOS',
            quantity: 70,
            boxes: 4,
            designs: 2,
            comments: 'RECEIVED 4 BOXES; 2 DESIGNS - DAREDEVIL, THUNDERBOLTS',
            status: 'In Warehouse',
            warehouseLocation: 'Bay 3 - Shelf C1',
            matchedCampaign: '251215015-0',
            posterImage: 'https://picsum.photos/seed/disney-marvel/400/500',
            keywords: ['disney', 'marvel', 'streaming', 'daredevil']
        },
        {
            id: 'INV174630',
            receiptNumber: 'INV174630',
            dateReceived: new Date('2025-12-16T13:20:00'),
            description: 'STARBUCKS HOLIDAY-SBX',
            posterCode: 'HOLIDAY-SBX-2025',
            client: 'STARBUCKS',
            advertiser: 'Starbucks',
            printer: 'COFFEE GRAPHICS',
            quantity: 55,
            boxes: 3,
            designs: 2,
            comments: 'RECEIVED 3 BOXES; 2 DESIGNS - HOLIDAY CUPS, SEASONAL MENU',
            status: 'Fully Deployed',
            warehouseLocation: 'N/A - All Deployed',
            matchedCampaign: '251228005-0',
            deployedQty: 55,
            posterImage: 'https://picsum.photos/seed/starbucks-holiday/400/500',
            keywords: ['starbucks', 'holiday', 'coffee', 'seasonal']
        },
        {
            id: 'INV174625',
            receiptNumber: 'INV174625',
            dateReceived: new Date('2025-12-15T15:45:00'),
            description: 'HBO MAX HOUSE DRAGON-HBO',
            posterCode: 'HOTD-HBO-S3',
            client: 'HBO',
            advertiser: 'HBO Max',
            printer: 'DRAGON PRINT WORKS',
            quantity: 95,
            boxes: 6,
            designs: 3,
            comments: 'RECEIVED 6 BOXES; 3 DESIGNS - KEY ART, DRAGONS, CAST',
            status: 'Partially Deployed',
            warehouseLocation: 'Bay 1 - Shelf D2',
            matchedCampaign: '260103004-0',
            deployedQty: 42,
            posterImage: 'https://picsum.photos/seed/hbo-dragon/400/500',
            keywords: ['hbo', 'max', 'house', 'dragon', 'streaming']
        }
    ];

    // ===================================================================================================
    // EXPORT TO WINDOW
    // ===================================================================================================
    window.STAPDemo = {
        // Components (from demoGuide.js)
        DemoWelcomeModal,
        DemoGuidePanel,
        Confetti,
        AnimatedCheckmark,
        ProgressRing,

        // Components (local)
        DemoTip,
        FeatureBadge,

        // Event system (from demoGuide.js)
        DemoActions,

        // Data generators (local)
        generateMockData,
        getDemoMaterials,

        // Utilities
        resetDemoProgress
    };

    console.log('[STAPDemo] Demo system loaded');

})(window);
