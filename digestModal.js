// ═══════════════════════════════════════════════════════════════════════════════
// DIGEST MODAL - Daily Operations Digest Email Generator
// Extracted from index.html for Babel optimization
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo } = React;

    // Dependencies - will be injected from main app
    let Icon = null;
    let generateDigestHtml = null;
    let fetchLiveWeather = null;
    let WEATHER_FORECAST = [];

    const initDependencies = () => {
        Icon = window.STAP_Icon || (({ name, size = 20, className = "" }) =>
            React.createElement('span', { className }, `[${name}]`)
        );
        generateDigestHtml = window.STAP_generateDigestHtml || (() => '<p>Digest unavailable</p>');
        fetchLiveWeather = window.STAP_fetchLiveWeather || (async () => []);
        WEATHER_FORECAST = window.STAP_WEATHER_FORECAST || [];
    };

    // Market and Product Group Constants
    const DIGEST_MARKET_GROUPS = {
        'West Coast': ['Los Angeles', 'San Francisco', 'Seattle', 'San Diego', 'Portland', 'Sacramento'],
        'East Coast': ['New York', 'Boston', 'Philadelphia', 'Washington', 'Baltimore', 'Newark'],
        'Southwest': ['Dallas', 'Houston', 'Phoenix', 'Austin', 'San Antonio', 'Denver'],
        'Southeast': ['Miami', 'Orlando', 'Atlanta', 'Tampa', 'Charlotte', 'Nashville'],
        'Midwest': ['Chicago', 'Detroit', 'Minneapolis', 'Cleveland', 'Indianapolis', 'Columbus']
    };

    const DIGEST_PRODUCT_GROUPS = {
        'All Digital': ['Digital Network', 'Digital Panel', 'Digital Domination', 'Digital'],
        'All Static Panels': ['Panel-Targeted', 'Panel-Network', 'Panel-Icon'],
        'Premium Units': ['Domination', 'Full Wrap', 'Embellishment', 'Icon']
    };

    const DigestModal = ({ isOpen, onClose, processedData, filterOptions, currentMarket }) => {
        useEffect(() => { initDependencies(); }, []);

        const [htmlContent, setHtmlContent] = useState('');
        const [copied, setCopied] = useState(false);
        const [showSettings, setShowSettings] = useState(true);
        const [liveWeather, setLiveWeather] = useState([]);
        const [isLoadingWeather, setIsLoadingWeather] = useState(false);
        const recipient = 'agutierrez@vectormedia.com';

        // Multi-select filter state
        const [digestMarkets, setDigestMarkets] = useState([]);
        const [digestProducts, setDigestProducts] = useState([]);

        // Digest settings state
        const [digestSettings, setDigestSettings] = useState({
            mainTitle: "Daily Operations Digest",
            showWeather: true,
            tempUnit: (window.STAP_getTempUnit && window.STAP_getTempUnit()) || 'F',
            weatherLocation: (window.STAP_getWeatherLocation && window.STAP_getWeatherLocation()) || 'Los Angeles, CA',
            showProductColumn: true,
            showMarketColumn: true,
            showOwnerColumn: true,
            showFirstInstallColumn: true,
            showProductionIcon: true,
            compactMode: false,
            sections: {
                summary: true,
                productionBreakdown: true,
                delayed: true,
                inProgress: true,
                upcoming: true,
                installed: true,
                recent: true,
                pipeline: true,
                removal: true
            },
            titles: {
                delayed: "Delayed or Overdue Flights",
                inProgress: "In-Progress Flights",
                upcoming: "Upcoming",
                installed: "Installed",
                recent: "Recent Completed Installs",
                pipeline: "Pipeline Snapshot (This Week)",
                removal: "Removal Dates (Past 45 days)"
            }
        });

        // Filter helpers
        const addMarketFilter = (value) => {
            if (value && !digestMarkets.includes(value)) {
                setDigestMarkets([...digestMarkets, value]);
            }
        };
        const removeMarketFilter = (value) => {
            setDigestMarkets(digestMarkets.filter(m => m !== value));
        };
        const addProductFilter = (value) => {
            if (value && !digestProducts.includes(value)) {
                setDigestProducts([...digestProducts, value]);
            }
        };
        const removeProductFilter = (value) => {
            setDigestProducts(digestProducts.filter(p => p !== value));
        };
        const clearAllDigestFilters = () => {
            setDigestMarkets([]);
            setDigestProducts([]);
        };

        // Fetch live weather - priority: saved location > digest market filter > active market filter
        useEffect(() => {
            const loadWeather = async () => {
                if (!isOpen) return;
                setIsLoadingWeather(true);
                try {
                    initDependencies();
                    // Priority chain: user's saved weather setting > digest filter > active market > fallback
                    const savedLocation = digestSettings.weatherLocation ||
                        (window.STAP_getWeatherLocation && window.STAP_getWeatherLocation());
                    const marketForWeather = savedLocation ||
                        (digestMarkets.length > 0 ? digestMarkets[0] : null) ||
                        currentMarket ||
                        'Los Angeles, CA';
                    const data = await fetchLiveWeather(marketForWeather);
                    setLiveWeather(data);
                } catch (err) {
                    console.error('Weather fetch failed:', err);
                    setLiveWeather(WEATHER_FORECAST);
                }
                setIsLoadingWeather(false);
            };
            loadWeather();
        }, [isOpen, digestMarkets, currentMarket, digestSettings.weatherLocation]);

        // Editable digest data state
        const [editableData, setEditableData] = useState(null);
        const [deletedItems, setDeletedItems] = useState([]);
        const [editRowsCollapsed, setEditRowsCollapsed] = useState(false);
        const [showAddModal, setShowAddModal] = useState(false);
        const [addModalSection, setAddModalSection] = useState(null);
        const [newEntry, setNewEntry] = useState({
            id: '', advertiser: '', name: '', market: '', product: '', owner: '', date: '', stage: '', progress: ''
        });

        // Filter processedData by markets and products
        const filteredDigestData = useMemo(() => {
            if (!processedData) return null;

            const hasMarketFilters = digestMarkets.length > 0;
            const hasProductFilters = digestProducts.length > 0;

            if (!hasMarketFilters && !hasProductFilters) {
                return processedData;
            }

            const matchesMarket = (item) => {
                if (!hasMarketFilters) return true;
                return digestMarkets.some(filter => {
                    if (DIGEST_MARKET_GROUPS[filter]) {
                        const cities = DIGEST_MARKET_GROUPS[filter];
                        return cities.some(city => item.market?.toLowerCase().includes(city.toLowerCase()));
                    }
                    return item.market === filter;
                });
            };

            const matchesProduct = (item) => {
                if (!hasProductFilters) return true;
                const itemProduct = item.product || item.media || '';
                return digestProducts.some(filter => {
                    if (DIGEST_PRODUCT_GROUPS[filter]) {
                        const keywords = DIGEST_PRODUCT_GROUPS[filter];
                        return keywords.some(kw => itemProduct.toLowerCase().includes(kw.toLowerCase()));
                    }
                    return itemProduct === filter;
                });
            };

            const filterArray = (arr) => {
                if (!arr) return [];
                return arr.filter(item => matchesMarket(item) && matchesProduct(item));
            };

            // --- Digest-specific filters (applied synchronously in useMemo, not async useEffect) ---
            const EXCLUDED_STAGES = ['installed', 'photos taken', 'pop completed', 'takedown complete', 'canceled', 'cancelled', 'pending hold', 'on hold', 'rfp', 'initial proposal'];
            const STALE_ONLY_STAGES = ['contracted', 'proofs approved', 'out for approval'];
            const hasCharted = (item) => item.adjustedQty && item.adjustedQty > 0;
            const now = new Date(); now.setHours(0,0,0,0);
            const diffToMonday = 1 - (now.getDay() || 7);
            const thisMonday = new Date(now); thisMonday.setDate(now.getDate() + diffToMonday); thisMonday.setHours(0,0,0,0);
            const thisSunday = new Date(thisMonday); thisSunday.setDate(thisMonday.getDate() + 6); thisSunday.setHours(23,59,59,999);

            // Delay/pastDue filter: stage exclusions + stale-only + must have charted
            const filterDelay = (arr) => filterArray(arr).filter(item => {
                if (!hasCharted(item)) return false;
                const stageLower = (item.stage || '').toLowerCase();
                if (EXCLUDED_STAGES.includes(stageLower)) return false;
                if (STALE_ONLY_STAGES.includes(stageLower)) {
                    // Contracted campaigns due this week bypass the 30-day stale rule
                    const startDate = item.dateObj instanceof Date ? item.dateObj : (item.dateObj ? new Date(item.dateObj) : null);
                    if (!startDate) return false;
                    if (stageLower === 'contracted' && startDate >= thisMonday && startDate <= thisSunday) return true;
                    return Math.floor((now - startDate) / (1000 * 60 * 60 * 24)) >= 30;
                }
                return true;
            });

            // All other sections: must have charted qty
            const filterCharted = (arr) => filterArray(arr).filter(hasCharted);

            const filteredAll = filterArray(processedData.all);
            const pipelineCounts = {};
            filteredAll.forEach(item => {
                const stage = item.stage || 'Unknown';
                pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;
            });
            const filteredPipeline = Object.entries(pipelineCounts)
                .map(([stage, count]) => ({ stage, count }))
                .sort((a, b) => b.count - a.count);

            return {
                ...processedData,
                all: filteredAll,
                delayedFlights: filterDelay(processedData.delayedFlights),
                pastDue: filterDelay(processedData.pastDue),
                inProgressFlights: filterCharted(processedData.inProgressFlights),
                upcoming: filterCharted(processedData.upcoming),
                fullyInstalledThisWeek: filterCharted(processedData.fullyInstalledThisWeek),
                recentInstalls: filterCharted(processedData.recentInstalls),
                expiredFlights: filterCharted(processedData.expiredFlights),
                pipelineSummary: filteredPipeline
            };
        }, [processedData, digestMarkets, digestProducts]);

        // Initialize editable data ONCE when modal opens — never overwrite after manual edits
        useEffect(() => {
            if (filteredDigestData && editableData === null) {
                setEditableData({
                    delayedFlights: [...(filteredDigestData.delayedFlights || [])],
                    inProgressFlights: [...(filteredDigestData.inProgressFlights || [])],
                    upcoming: [...(filteredDigestData.upcoming || [])],
                    fullyInstalledThisWeek: [...(filteredDigestData.fullyInstalledThisWeek || [])],
                    recentInstalls: [...(filteredDigestData.recentInstalls || [])],
                    expiredFlights: [...(filteredDigestData.expiredFlights || [])],
                    pastDue: [...(filteredDigestData.pastDue || [])],
                    pipelineSummary: [...(filteredDigestData.pipelineSummary || [])]
                });
            }
        }, [filteredDigestData]);

        // Delete row from a section
        const deleteRow = (section, index) => {
            const deletedItem = editableData[section][index];
            setDeletedItems(prev => [...prev, {
                item: deletedItem,
                section,
                originalIndex: index,
                timestamp: Date.now()
            }]);
            setEditableData(prev => ({
                ...prev,
                [section]: prev[section].filter((_, i) => i !== index)
            }));
        };

        // Undo last delete
        const undoLastDelete = () => {
            if (deletedItems.length === 0) return;
            const lastDeleted = deletedItems[deletedItems.length - 1];
            setEditableData(prev => {
                const sectionData = [...(prev[lastDeleted.section] || [])];
                const insertIndex = Math.min(lastDeleted.originalIndex, sectionData.length);
                sectionData.splice(insertIndex, 0, lastDeleted.item);
                return {
                    ...prev,
                    [lastDeleted.section]: sectionData
                };
            });
            setDeletedItems(prev => prev.slice(0, -1));
        };

        // Restore all deleted items
        const restoreAllDeleted = () => {
            if (deletedItems.length === 0) return;
            const restoredBySections = {};
            deletedItems.forEach(({ item, section }) => {
                if (!restoredBySections[section]) {
                    restoredBySections[section] = [];
                }
                restoredBySections[section].push(item);
            });

            setEditableData(prev => {
                const updated = { ...prev };
                Object.entries(restoredBySections).forEach(([section, items]) => {
                    updated[section] = [...(prev[section] || []), ...items];
                });
                return updated;
            });
            setDeletedItems([]);
        };

        // Reset deleted items when modal closes
        useEffect(() => {
            if (!isOpen) {
                setDeletedItems([]);
                setEditableData(null);
            }
        }, [isOpen]);

        // Open add modal for a section
        const openAddModal = (section) => {
            setAddModalSection(section);
            setNewEntry({
                id: 'MANUAL-' + Date.now(),
                advertiser: '',
                name: '',
                market: 'Los Angeles - STAP',
                product: 'Transit Shelters-Panel-Targeted',
                owner: '',
                date: new Date().toLocaleDateString(),
                endDate: new Date().toLocaleDateString(),
                stage: section === 'delayed' ? 'Material Ready' :
                       section === 'inProgress' ? 'In-Progress' :
                       section === 'upcoming' ? 'Material Ready' :
                       section === 'installed' ? 'Installation Complete' :
                       section === 'recent' ? 'Installation Complete' :
                       section === 'removal' ? 'Expired' : 'Unknown',
                progress: '50%',
                adjustedQty: 1,
                isManual: true
            });
            setShowAddModal(true);
        };

        // Add new entry to section
        const addNewEntry = () => {
            if (!newEntry.advertiser) {
                alert('Please enter an advertiser name');
                return;
            }

            const sectionMap = {
                'delayed': 'delayedFlights',
                'inProgress': 'inProgressFlights',
                'upcoming': 'upcoming',
                'installed': 'fullyInstalledThisWeek',
                'recent': 'recentInstalls',
                'removal': 'expiredFlights'
            };

            const sectionKey = sectionMap[addModalSection];
            if (sectionKey) {
                setEditableData(prev => ({
                    ...prev,
                    [sectionKey]: [...(prev[sectionKey] || []), { ...newEntry }]
                }));
            }
            setShowAddModal(false);
        };

        // Reset edits to original filtered data
        const resetEdits = () => {
            if (filteredDigestData) {
                setEditableData({
                    delayedFlights: [...(filteredDigestData.delayedFlights || [])],
                    inProgressFlights: [...(filteredDigestData.inProgressFlights || [])],
                    upcoming: [...(filteredDigestData.upcoming || [])],
                    fullyInstalledThisWeek: [...(filteredDigestData.fullyInstalledThisWeek || [])],
                    recentInstalls: [...(filteredDigestData.recentInstalls || [])],
                    expiredFlights: [...(filteredDigestData.expiredFlights || [])],
                    pastDue: [...(filteredDigestData.pastDue || [])],
                    pipelineSummary: [...(filteredDigestData.pipelineSummary || [])]
                });
            }
        };

        // Check if any manual edits have been made
        const hasManualEdits = useMemo(() => {
            if (!editableData || !filteredDigestData) return false;
            return (
                editableData.delayedFlights?.length !== filteredDigestData.delayedFlights?.length ||
                editableData.inProgressFlights?.length !== filteredDigestData.inProgressFlights?.length ||
                editableData.upcoming?.length !== filteredDigestData.upcoming?.length ||
                editableData.fullyInstalledThisWeek?.length !== filteredDigestData.fullyInstalledThisWeek?.length ||
                editableData.recentInstalls?.length !== filteredDigestData.recentInstalls?.length ||
                editableData.expiredFlights?.length !== filteredDigestData.expiredFlights?.length ||
                editableData.delayedFlights?.some(item => item.isManual) ||
                editableData.inProgressFlights?.some(item => item.isManual) ||
                editableData.upcoming?.some(item => item.isManual) ||
                editableData.fullyInstalledThisWeek?.some(item => item.isManual) ||
                editableData.recentInstalls?.some(item => item.isManual) ||
                editableData.expiredFlights?.some(item => item.isManual)
            );
        }, [editableData, filteredDigestData]);

        // Use editable data for HTML generation
        const dataForHtml = useMemo(() => {
            if (!editableData || !filteredDigestData) return filteredDigestData;
            return {
                ...filteredDigestData,
                delayedFlights: editableData.delayedFlights,
                inProgressFlights: editableData.inProgressFlights,
                upcoming: editableData.upcoming,
                fullyInstalledThisWeek: editableData.fullyInstalledThisWeek,
                recentInstalls: editableData.recentInstalls,
                expiredFlights: editableData.expiredFlights,
                pastDue: editableData.pastDue,
                pipelineSummary: editableData.pipelineSummary
            };
        }, [editableData, filteredDigestData]);

        useEffect(() => {
            if (isOpen && dataForHtml && liveWeather.length > 0) {
                initDependencies();
                const html = generateDigestHtml(dataForHtml, liveWeather, digestSettings);
                setHtmlContent(html);
            }
        }, [isOpen, dataForHtml, liveWeather, digestSettings]);

        // Copy Logic
        const handleCopy = () => {
            const type = 'text/html';
            const blob = new Blob([htmlContent], { type });
            const data = [new ClipboardItem({ [type]: blob })];

            navigator.clipboard.write(data).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
                console.error(err);
                alert('Could not copy directly. Please select the text in the preview and press Ctrl+C.');
            });
        };

        const handleOpenMailClient = () => {
            const filterParts = [];
            if (digestMarkets.length > 0) filterParts.push(digestMarkets.map(m => m.split(',')[0]).join(', '));
            if (digestProducts.length > 0) filterParts.push(digestProducts.join(', '));
            const filterSuffix = filterParts.length > 0 ? ` (${filterParts.join(' | ')})` : '';
            const subject = `LA STAP - ${digestSettings.mainTitle}${filterSuffix} - ${new Date().toLocaleDateString()}`;
            window.open(`mailto:${recipient}?subject=${encodeURIComponent(subject)}`, '_blank');
        };

        const toggleSection = (key) => {
            setDigestSettings(prev => ({
                ...prev,
                sections: { ...prev.sections, [key]: !prev.sections[key] }
            }));
        };

        const updateSectionTitle = (key, val) => {
            setDigestSettings(prev => ({
                ...prev,
                titles: { ...prev.titles, [key]: val }
            }));
        };

        if (!isOpen) return null;

        initDependencies();

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-[1400px] w-full overflow-hidden animate-scale-in flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <Icon name="Mail" size={20} className="text-blue-600" /> Daily Digest Preview
                            {(digestMarkets.length > 0 || digestProducts.length > 0) && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                    {filteredDigestData?.all?.length || 0} campaigns
                                </span>
                            )}
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${showSettings ? 'bg-blue-100 text-blue-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Icon name="Sliders" size={16} /> Customize Template
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                                <Icon name="X" size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative flex">
                        {/* Settings Panel */}
                        {showSettings && (
                            <div className="w-96 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4 animate-fade-in flex flex-col gap-5 shadow-inner">
                                {/* Filter Data */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                        <Icon name="Filter" size={14} /> Filter Data
                                    </h4>

                                    {/* Market Multi-Select */}
                                    <div className="mb-3">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Markets</label>
                                        <select
                                            value=""
                                            onChange={e => { if (e.target.value) addMarketFilter(e.target.value); }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            <option value="">+ Add Market Filter...</option>
                                            <optgroup label="Regions">
                                                {Object.keys(DIGEST_MARKET_GROUPS).map(region => (
                                                    <option key={region} value={region} disabled={digestMarkets.includes(region)}>
                                                        {region}
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Individual Markets">
                                                {(filterOptions?.markets || []).map(m => (
                                                    <option key={m} value={m} disabled={digestMarkets.includes(m)}>
                                                        {m.split(',')[0]}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        {digestMarkets.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {digestMarkets.map(m => (
                                                    <span key={m} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                        <Icon name="MapPin" size={10} />
                                                        {DIGEST_MARKET_GROUPS[m] ? m : m.split(',')[0]}
                                                        <button onClick={() => removeMarketFilter(m)} className="hover:bg-blue-200 rounded-full p-0.5">
                                                            <Icon name="X" size={10} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Product Multi-Select */}
                                    <div className="mb-3">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Products / Media</label>
                                        <select
                                            value=""
                                            onChange={e => { if (e.target.value) addProductFilter(e.target.value); }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            <option value="">+ Add Product Filter...</option>
                                            <optgroup label="Categories">
                                                {Object.keys(DIGEST_PRODUCT_GROUPS).map(cat => (
                                                    <option key={cat} value={cat} disabled={digestProducts.includes(cat)}>
                                                        {cat}
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Individual Products">
                                                {(filterOptions?.products || []).map(p => (
                                                    <option key={p} value={p} disabled={digestProducts.includes(p)}>
                                                        {p.replace('Transit Shelter-', '').replace('Transit Shelters-', '')}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        {digestProducts.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {digestProducts.map(p => (
                                                    <span key={p} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                                        <Icon name="Package" size={10} />
                                                        {p.replace('Transit Shelter-', '').replace('Transit Shelters-', '')}
                                                        <button onClick={() => removeProductFilter(p)} className="hover:bg-purple-200 rounded-full p-0.5">
                                                            <Icon name="X" size={10} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Filter Summary */}
                                    {(digestMarkets.length > 0 || digestProducts.length > 0) && (
                                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                                                <Icon name="Filter" size={12} />
                                                Showing {filteredDigestData?.all?.length || 0} of {processedData?.all?.length || 0} campaigns
                                            </p>
                                            <button
                                                onClick={clearAllDigestFilters}
                                                className="text-xs text-red-600 hover:underline mt-1 font-medium"
                                            >
                                                Clear All Filters
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <hr className="border-gray-200" />

                                {/* General Settings */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                        <Icon name="Settings" size={14} /> General Settings
                                    </h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Email Title</label>
                                            <input
                                                type="text"
                                                value={digestSettings.mainTitle}
                                                onChange={e => setDigestSettings(prev => ({ ...prev, mainTitle: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={digestSettings.showWeather}
                                                onChange={e => setDigestSettings(prev => ({ ...prev, showWeather: e.target.checked }))}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            Show Weather Widget {isLoadingWeather && <span className="text-xs text-blue-500">(Loading...)</span>}
                                        </label>
                                        <div className="flex items-center gap-2 text-sm text-gray-700 ml-6">
                                            <span>Temperature:</span>
                                            <button
                                                onClick={() => {
                                                    const newUnit = digestSettings.tempUnit === 'F' ? 'C' : 'F';
                                                    setDigestSettings(prev => ({ ...prev, tempUnit: newUnit }));
                                                    if (window.STAP_setTempUnit) window.STAP_setTempUnit(newUnit);
                                                }}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                    digestSettings.tempUnit === 'F'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                °F
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const newUnit = digestSettings.tempUnit === 'C' ? 'F' : 'C';
                                                    setDigestSettings(prev => ({ ...prev, tempUnit: newUnit }));
                                                    if (window.STAP_setTempUnit) window.STAP_setTempUnit(newUnit);
                                                }}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                    digestSettings.tempUnit === 'C'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                °C
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-700 ml-6">
                                            <span>Location:</span>
                                            <select
                                                value={digestSettings.weatherLocation}
                                                onChange={e => {
                                                    setDigestSettings(prev => ({ ...prev, weatherLocation: e.target.value }));
                                                    if (window.STAP_setWeatherLocation) window.STAP_setWeatherLocation(e.target.value);
                                                }}
                                                className="px-2 py-1 rounded text-xs border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                {Object.keys(window.STAP_MARKET_COORDINATES || {}).sort().map(city => (
                                                    <option key={city} value={city}>{city}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-gray-200" />

                                {/* Table Columns */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                        <Icon name="Columns" size={14} /> Table Columns
                                    </h4>
                                    <div className="space-y-2">
                                        {[
                                            { key: 'showProductColumn', label: 'Show Product/Media Column' },
                                            { key: 'showMarketColumn', label: 'Show Market Column' },
                                            { key: 'showOwnerColumn', label: 'Show Owner Column' },
                                            { key: 'showFirstInstallColumn', label: 'Show 1st Install Column' },
                                            { key: 'showProductionIcon', label: 'Show In-House Icon (🏠)' },
                                            { key: 'compactMode', label: 'Compact Mode (smaller tables)' }
                                        ].map(opt => (
                                            <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={digestSettings[opt.key]}
                                                    onChange={e => setDigestSettings(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-gray-200" />

                                {/* Sections & Titles */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                        <Icon name="Layout" size={14} /> Sections & Titles
                                    </h4>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer font-medium">
                                            <input
                                                type="checkbox"
                                                checked={digestSettings.sections.summary}
                                                onChange={() => toggleSection('summary')}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            Top Summary Grid (Delayed, In-Progress, etc.)
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer font-medium">
                                            <input
                                                type="checkbox"
                                                checked={digestSettings.sections.productionBreakdown}
                                                onChange={() => toggleSection('productionBreakdown')}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            Production Source Breakdown
                                        </label>
                                        <hr className="border-gray-200" />
                                        {[
                                            { key: 'delayed', label: 'Delayed Flights', icon: 'Flame' },
                                            { key: 'inProgress', label: 'In-Progress Flights', icon: 'Rocket' },
                                            { key: 'upcoming', label: 'Upcoming Flights', icon: 'Sun' },
                                            { key: 'installed', label: 'Installed This Week', icon: 'Medal' },
                                            { key: 'recent', label: 'Recently Completed', icon: 'CheckSquare' },
                                            { key: 'pipeline', label: 'Pipeline Summary', icon: 'BarChart' },
                                            { key: 'removal', label: 'Removal Dates', icon: 'Lightbulb' },
                                        ].map(sec => (
                                            <div key={sec.key} className={`p-2 rounded-lg border transition-colors ${digestSettings.sections[sec.key] ? 'bg-white border-gray-200' : 'bg-gray-100 border-transparent opacity-60'}`}>
                                                <label className="flex items-center gap-2 text-sm text-gray-900 font-medium cursor-pointer mb-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={digestSettings.sections[sec.key]}
                                                        onChange={() => toggleSection(sec.key)}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <Icon name={sec.icon} size={14} className="text-gray-500" />
                                                    {sec.label}
                                                </label>
                                                {digestSettings.sections[sec.key] && (
                                                    <input
                                                        type="text"
                                                        value={digestSettings.titles[sec.key]}
                                                        onChange={e => updateSectionTitle(sec.key, e.target.value)}
                                                        className="w-full px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 focus:border-blue-400 outline-none ml-6"
                                                        placeholder="Section Title..."
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <hr className="border-gray-200" />

                                {/* Manual Edits Section */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                        <Icon name="Edit3" size={14} /> Manual Edits
                                    </h4>

                                    {hasManualEdits && (
                                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                                                <Icon name="AlertCircle" size={12} />
                                                You have unsaved manual edits
                                            </p>
                                            <button
                                                onClick={resetEdits}
                                                className="text-xs text-amber-600 hover:underline mt-1 font-medium"
                                            >
                                                Reset to Original Data
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-500 mb-3">
                                        Add or remove rows from each section. Changes appear in the preview immediately.
                                    </p>

                                    <div className="space-y-2">
                                        {[
                                            { key: 'delayed', dataKey: 'delayedFlights', label: 'Delayed' },
                                            { key: 'inProgress', dataKey: 'inProgressFlights', label: 'In-Progress' },
                                            { key: 'upcoming', dataKey: 'upcoming', label: 'Upcoming' },
                                            { key: 'installed', dataKey: 'fullyInstalledThisWeek', label: 'Installed' },
                                            { key: 'recent', dataKey: 'recentInstalls', label: 'Recent' },
                                            { key: 'removal', dataKey: 'expiredFlights', label: 'Removal' },
                                        ].map(sec => (
                                            <div key={sec.key} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-gray-700">{sec.label}</span>
                                                    <span className="text-xs text-gray-400">
                                                        ({editableData?.[sec.dataKey]?.length || 0} rows)
                                                    </span>
                                                    {editableData?.[sec.dataKey]?.some(item => item.isManual) && (
                                                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">edited</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => openAddModal(sec.key)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                                >
                                                    <Icon name="Plus" size={12} /> Add
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Edit Data Panel — collapsible sidebar */}
                        {showSettings && editableData && (
                            editRowsCollapsed ? (
                                <div
                                    className="w-8 bg-gray-50 border-r border-gray-200 flex flex-col items-center cursor-pointer hover:bg-gray-100 transition-colors shrink-0"
                                    onClick={() => setEditRowsCollapsed(false)}
                                    title="Expand Edit Rows"
                                >
                                    <div className="pt-3 pb-2">
                                        <Icon name="ChevronRight" size={14} className="text-gray-400" />
                                    </div>
                                    <div className="writing-mode-vertical text-xs font-bold text-gray-400 tracking-wider" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                                        EDIT ROWS
                                    </div>
                                </div>
                            ) : (
                            <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex flex-col shrink-0">
                                <div className="p-3 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 cursor-pointer select-none" onClick={() => setEditRowsCollapsed(true)} title="Collapse panel">
                                            <Icon name="ChevronLeft" size={16} className="text-gray-400" /> Edit Rows
                                        </h4>
                                        {deletedItems.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={undoLastDelete}
                                                    className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                                                    title="Undo last delete"
                                                >
                                                    <Icon name="RotateCcw" size={12} /> Undo
                                                </button>
                                                <button
                                                    onClick={restoreAllDeleted}
                                                    className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                                                    title={`Restore all ${deletedItems.length} deleted items`}
                                                >
                                                    <Icon name="RefreshCw" size={12} /> All ({deletedItems.length})
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Click X to remove a row from the email
                                        {deletedItems.length > 0 && (
                                            <span className="text-amber-600 ml-1">- {deletedItems.length} deleted</span>
                                        )}
                                    </p>
                                </div>

                                <div className="p-3 space-y-4 flex-1">
                                    {[
                                        { key: 'delayed', dataKey: 'delayedFlights', label: 'Delayed', color: 'red' },
                                        { key: 'inProgress', dataKey: 'inProgressFlights', label: 'In-Progress', color: 'blue' },
                                        { key: 'upcoming', dataKey: 'upcoming', label: 'Upcoming', color: 'amber' },
                                        { key: 'installed', dataKey: 'fullyInstalledThisWeek', label: 'Installed', color: 'green' },
                                        { key: 'recent', dataKey: 'recentInstalls', label: 'Recent', color: 'teal' },
                                        { key: 'removal', dataKey: 'expiredFlights', label: 'Removal', color: 'gray' },
                                    ].map(sec => digestSettings.sections[sec.key] && (
                                        <div key={sec.key}>
                                            <div className="flex items-center justify-between mb-2">
                                                <h5 className={`text-xs font-bold text-${sec.color}-600 uppercase`}>{sec.label}</h5>
                                                <span className="text-[10px] text-gray-400">{editableData?.[sec.dataKey]?.length || 0}</span>
                                            </div>
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {(editableData?.[sec.dataKey] || []).map((item, idx) => (
                                                    <div key={idx} className={`flex items-center justify-between p-1.5 rounded text-xs ${item.isManual ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                                                        <div className="truncate flex-1 mr-2">
                                                            <span className="font-medium text-gray-800">{item.advertiser}</span>
                                                            <span className="text-gray-400 ml-1">#{item.id?.slice(-6)}</span>
                                                            {item.isManual && <span className="ml-1 text-amber-600">(manual)</span>}
                                                        </div>
                                                        <button
                                                            onClick={() => deleteRow(sec.dataKey, idx)}
                                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0"
                                                            title="Remove from email"
                                                        >
                                                            <Icon name="X" size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {(editableData?.[sec.dataKey] || []).length === 0 && (
                                                    <p className="text-xs text-gray-400 italic py-2 text-center">No entries</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            )
                        )}

                        {/* Preview Iframe */}
                        <div className="flex-1 bg-gray-100 relative">
                            <iframe
                                srcDoc={htmlContent}
                                className="w-full h-full border-0"
                                title="Email Preview"
                            />
                        </div>
                    </div>

                    {/* Add Entry Modal */}
                    {showAddModal && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Icon name="Plus" size={20} className="text-blue-600" />
                                    Add Manual Entry
                                    <span className="text-xs font-normal text-gray-500 ml-2">
                                        ({addModalSection})
                                    </span>
                                </h3>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Advertiser *</label>
                                            <input
                                                type="text"
                                                value={newEntry.advertiser}
                                                onChange={e => setNewEntry(prev => ({ ...prev, advertiser: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Company Name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Campaign Name</label>
                                            <input
                                                type="text"
                                                value={newEntry.name}
                                                onChange={e => setNewEntry(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Campaign Name"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Market</label>
                                            <select
                                                value={newEntry.market}
                                                onChange={e => setNewEntry(prev => ({ ...prev, market: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                {(filterOptions?.markets || ['Los Angeles - STAP', 'New York, NY', 'Dallas, TX', 'Miami, FL', 'Chicago, IL']).map(m => (
                                                    <option key={m} value={m}>{m.split(',')[0]}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Media Type</label>
                                            <select
                                                value={newEntry.product}
                                                onChange={e => setNewEntry(prev => ({ ...prev, product: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                {(filterOptions?.products || ['Transit Shelters-Panel-Targeted', 'Transit Shelters-Panel-Network', 'Digital Network']).map(p => (
                                                    <option key={p} value={p}>{p.replace('Transit Shelters-', '').replace('Transit Shelter-', '')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
                                            <input
                                                type="text"
                                                value={newEntry.owner}
                                                onChange={e => setNewEntry(prev => ({ ...prev, owner: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Owner Name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                                            <input
                                                type="text"
                                                value={newEntry.date}
                                                onChange={e => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="MM/DD/YY"
                                            />
                                        </div>
                                    </div>

                                    {addModalSection === 'inProgress' && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Progress</label>
                                            <input
                                                type="text"
                                                value={newEntry.progress}
                                                onChange={e => setNewEntry(prev => ({ ...prev, progress: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="e.g., 50%"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={addNewEntry}
                                        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                        Add Entry
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                        <p className="text-sm text-gray-500 italic flex items-center gap-1">
                            <Icon name="AlertTriangle" size={14} />
                            Tip: Copy here, then Paste into Outlook/Gmail.
                            {hasManualEdits && <span className="ml-2 text-amber-600 font-medium">(includes manual edits)</span>}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCopy}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                <Icon name={copied ? "CheckCircle" : "Copy"} size={18} />
                                {copied ? 'Copied to Clipboard!' : '1. Copy Table'}
                            </button>
                            <button
                                onClick={handleOpenMailClient}
                                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <Icon name="Send" size={18} /> 2. Open Mail & Paste
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Export to window
    window.STAPDigestModal = {
        DigestModal,
        setDependencies: (deps) => {
            if (deps.Icon) window.STAP_Icon = deps.Icon;
            if (deps.generateDigestHtml) window.STAP_generateDigestHtml = deps.generateDigestHtml;
            if (deps.fetchLiveWeather) window.STAP_fetchLiveWeather = deps.fetchLiveWeather;
            if (deps.WEATHER_FORECAST) window.STAP_WEATHER_FORECAST = deps.WEATHER_FORECAST;
        }
    };

    console.log('✅ STAP DigestModal component loaded');

})(window);
