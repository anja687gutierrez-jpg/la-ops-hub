(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useCallback } = React;

    // ════════════════════════════════════════════════════════════════════════
    // 1. GMAIL-PROOF EMAIL ENGINE (The "Table" Strategy)
    // ════════════════════════════════════════════════════════════════════════
    const generateEmailSafeHtml = (data, settings, weather) => {
        const styles = {
            container: 'font-family: Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;',
            header: 'background-color: #f8f9fa; padding: 20px; border-bottom: 3px solid #0052cc;',
            sectionTitle: 'font-size: 16px; font-weight: bold; color: #0052cc; padding: 15px 0 5px 0; border-bottom: 1px solid #eee;',
            table: 'width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;',
            th: 'background-color: #f1f3f4; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; color: #555;',
            td: 'padding: 8px; border-bottom: 1px solid #eee; vertical-align: top;',
            weatherBadge: 'display: inline-block; padding: 4px 8px; background: #e8f0fe; color: #1967d2; border-radius: 4px; font-size: 11px; margin-right: 5px;'
        };

        const renderSection = (title, items, color = '#0052cc') => {
            if (!items || items.length === 0) return '';

            const rows = items.map(item => `
                <tr>
                    <td style="${styles.td}">
                        <strong>${item.advertiser}</strong><br/>
                        <span style="color: #777;">${item.name || 'N/A'}</span>
                    </td>
                    ${settings.showMarketColumn ? `<td style="${styles.td}">${item.market?.split(',')[0] || '-'}</td>` : ''}
                    ${settings.showProductColumn ? `<td style="${styles.td}">${(item.product || '').replace('Transit Shelters-', '')}</td>` : ''}
                    <td style="${styles.td}">${item.date || item.startDate || '-'}</td>
                    ${settings.showOwnerColumn ? `<td style="${styles.td}">${item.owner || '-'}</td>` : ''}
                </tr>
            `).join('');

            return `
                <tr><td colspan="5" style="${styles.sectionTitle}; color: ${color};">${title} (${items.length})</td></tr>
                <tr>
                    <td colspan="5">
                        <table border="0" cellpadding="0" cellspacing="0" style="${styles.table}">
                            <thead>
                                <tr>
                                    <th style="${styles.th}">Campaign</th>
                                    ${settings.showMarketColumn ? `<th style="${styles.th}">Market</th>` : ''}
                                    ${settings.showProductColumn ? `<th style="${styles.th}">Media</th>` : ''}
                                    <th style="${styles.th}">Date</th>
                                    ${settings.showOwnerColumn ? `<th style="${styles.th}">Owner</th>` : ''}
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </td>
                </tr>
            `;
        };

        // Weather Widget (Table Based)
        let weatherHtml = '';
        if (settings.showWeather && weather.length > 0) {
            const wItems = weather.map(w =>
                `<span style="${styles.weatherBadge}">${w.day}: ${w.temp}° ${w.condition}</span>`
            ).join('');
            weatherHtml = `<div style="padding: 10px 0;">${wItems}</div>`;
        }

        return `
            <!DOCTYPE html>
            <html>
            <body style="margin:0; padding:0; background-color: #ffffff;">
                <center>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="${styles.container}">
                        <tr>
                            <td style="${styles.header}">
                                <h2 style="margin:0; color: #1a1a1a;">${settings.mainTitle}</h2>
                                ${weatherHtml}
                                <p style="font-size: 11px; color: #888; margin-top: 5px;">Generated on ${new Date().toLocaleDateString()}</p>
                            </td>
                        </tr>
                        ${settings.sections.delayed ? renderSection(settings.titles.delayed, data.delayedFlights, '#d93025') : ''}
                        ${settings.sections.inProgress ? renderSection(settings.titles.inProgress, data.inProgressFlights, '#1a73e8') : ''}
                        ${settings.sections.upcoming ? renderSection(settings.titles.upcoming, data.upcoming, '#e37400') : ''}
                        ${settings.sections.installed ? renderSection(settings.titles.installed, data.fullyInstalledThisWeek, '#188038') : ''}
                        ${settings.sections.removal ? renderSection(settings.titles.removal, data.expiredFlights, '#5f6368') : ''}
                    </table>
                </center>
            </body>
            </html>
        `;
    };

    // ════════════════════════════════════════════════════════════════════════
    // 2. THE BRAIN (Logic Hook)
    // ════════════════════════════════════════════════════════════════════════
    const useDigestManager = (initialData, isOpen) => {
        const [rawEditableData, setRawEditableData] = useState(null);
        const [deletedItems, setDeletedItems] = useState([]);
        const [digestMarkets, setDigestMarkets] = useState([]);
        const [digestProducts, setDigestProducts] = useState([]);

        // Reset when modal opens/closes or data updates
        useEffect(() => {
            if (isOpen && initialData) {
                setRawEditableData(JSON.parse(JSON.stringify(initialData))); // Deep clone
                setDeletedItems([]);
            }
        }, [initialData, isOpen]);

        // Smart Filtering
        const filteredData = useMemo(() => {
            if (!rawEditableData) return null;

            const filterItem = (item) => {
                const mMatch = digestMarkets.length === 0 || digestMarkets.some(m => item.market?.includes(m) || m === 'West Coast' && ['Los Angeles', 'Seattle'].some(c => item.market.includes(c)));
                const pMatch = digestProducts.length === 0 || digestProducts.some(p => item.product?.includes(p));
                return mMatch && pMatch;
            };

            const processSection = (arr) => (arr || []).filter(filterItem);

            return {
                delayedFlights: processSection(rawEditableData.delayedFlights),
                inProgressFlights: processSection(rawEditableData.inProgressFlights),
                upcoming: processSection(rawEditableData.upcoming),
                fullyInstalledThisWeek: processSection(rawEditableData.fullyInstalledThisWeek),
                expiredFlights: processSection(rawEditableData.expiredFlights),
                recentInstalls: processSection(rawEditableData.recentInstalls)
            };
        }, [rawEditableData, digestMarkets, digestProducts]);

        // Actions
        const deleteRow = (sectionKey, index) => {
            const item = filteredData[sectionKey][index]; // Get from filtered view
            // In a real app, you'd match by ID, but index is okay for this ephemeral tool
            setRawEditableData(prev => ({
                ...prev,
                [sectionKey]: prev[sectionKey].filter(x => x !== item)
            }));
            setDeletedItems(prev => [...prev, { item, sectionKey }]);
        };

        const restoreLast = () => {
            if (deletedItems.length === 0) return;
            const last = deletedItems[deletedItems.length - 1];
            setRawEditableData(prev => ({
                ...prev,
                [last.sectionKey]: [last.item, ...prev[last.sectionKey]]
            }));
            setDeletedItems(prev => prev.slice(0, -1));
        };

        const addManualEntry = (sectionKey, entry) => {
            setRawEditableData(prev => ({
                ...prev,
                [sectionKey]: [{ ...entry, isManual: true }, ...prev[sectionKey]]
            }));
        };

        return {
            data: filteredData,
            filters: { digestMarkets, setDigestMarkets, digestProducts, setDigestProducts },
            actions: { deleteRow, restoreLast, addManualEntry, hasDeleted: deletedItems.length > 0 }
        };
    };

    // ════════════════════════════════════════════════════════════════════════
    // 3. THE VIEW (UI Component)
    // ════════════════════════════════════════════════════════════════════════
    const DigestModal = ({ isOpen, onClose, processedData, filterOptions, currentMarket }) => {
        // Dependencies
        const [IconComponent, setIconComponent] = useState(() => window.STAP_Icon || (() => null));

        // State
        const [settings, setSettings] = useState({
            mainTitle: "Daily Operations Digest",
            showWeather: true,
            showMarketColumn: true,
            showProductColumn: true,
            showOwnerColumn: true,
            sections: { delayed: true, inProgress: true, upcoming: true, installed: true, removal: true },
            titles: { delayed: "Delayed/Overdue", inProgress: "In-Progress", upcoming: "Upcoming", installed: "Installed", removal: "Removals" }
        });

        const { data, filters, actions } = useDigestManager(processedData, isOpen);
        const [copied, setCopied] = useState(false);
        const [htmlContent, setHtmlContent] = useState('');

        // Generate HTML when data changes
        useEffect(() => {
            if (data && isOpen) {
                // Mock Weather for now - normally fetched
                const weather = [{ day: 'Today', temp: '72', condition: 'Sunny' }];
                const html = generateEmailSafeHtml(data, settings, weather);
                setHtmlContent(html);
            }
        }, [data, settings, isOpen]);

        const handleCopy = () => {
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const item = new ClipboardItem({ 'text/html': blob });
            navigator.clipboard.write([item]).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(() => alert('Copy failed. Please select text manually.'));
        };

        if (!isOpen || !data) return null;
        const Icon = IconComponent;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-[1400px] w-full h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                            <Icon name="Mail" size={20} className="text-blue-600" /> Daily Digest Generator
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={handleCopy} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                <Icon name={copied ? "Check" : "Copy"} size={16} />
                                {copied ? 'Copied!' : 'Copy for Gmail'}
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><Icon name="X" size={20} /></button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* LEFT: Controls */}
                        <div className="w-80 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Filters</h4>
                            <select
                                className="w-full mb-2 p-2 rounded border text-sm"
                                onChange={(e) => e.target.value && filters.setDigestMarkets([...filters.digestMarkets, e.target.value])}
                            >
                                <option value="">Add Market...</option>
                                {(filterOptions?.markets || []).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>

                            <div className="flex flex-wrap gap-1 mb-4">
                                {filters.digestMarkets.map(m => (
                                    <span key={m} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        {m.split(',')[0]}
                                        <button onClick={() => filters.setDigestMarkets(filters.digestMarkets.filter(x => x !== m))}>×</button>
                                    </span>
                                ))}
                            </div>

                            <hr className="my-4"/>

                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Edit Sections</h4>
                            {Object.entries(settings.sections).map(([key, isActive]) => (
                                <label key={key} className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={() => setSettings(s => ({ ...s, sections: { ...s.sections, [key]: !isActive } }))}
                                    />
                                    {settings.titles[key]}
                                </label>
                            ))}
                        </div>

                        {/* MIDDLE: Interactive List (The Editor) */}
                        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
                            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-500">PREVIEW & EDIT DATA</span>
                                {actions.hasDeleted && (
                                    <button onClick={actions.restoreLast} className="text-xs text-blue-600 font-medium hover:underline">Undo Delete</button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                                {Object.entries(data).map(([key, items]) => {
                                    const sectionKey = key.replace('Flights', '').replace('fully', '').replace('ThisWeek', ''); // lazy mapping
                                    // Map data keys to settings keys roughly
                                    const settingKey = key.includes('delayed') ? 'delayed' :
                                                       key.includes('inProgress') ? 'inProgress' :
                                                       key.includes('upcoming') ? 'upcoming' :
                                                       key.includes('Installed') ? 'installed' : 'removal';

                                    if (!settings.sections[settingKey] || !items.length) return null;

                                    return (
                                        <div key={key}>
                                            <h5 className="text-xs font-bold text-blue-600 mb-2 uppercase">{settings.titles[settingKey]}</h5>
                                            {items.map((item, idx) => (
                                                <div key={idx} className="group flex justify-between items-start p-2 mb-1 bg-gray-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded text-xs transition-all">
                                                    <div className="truncate pr-2">
                                                        <div className="font-medium">{item.advertiser}</div>
                                                        <div className="text-gray-400">{item.product}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => actions.deleteRow(key, idx)}
                                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Icon name="X" size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT: Real Email Preview */}
                        <div className="flex-1 bg-gray-100 p-8 overflow-y-auto flex justify-center">
                            <div className="w-full max-w-[800px] bg-white shadow-xl min-h-[600px]">
                                <iframe
                                    srcDoc={htmlContent}
                                    className="w-full h-full min-h-[800px] border-none"
                                    title="Email Preview"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Export
    window.STAPDigestModal = { DigestModal };
    console.log('✅ STAP DigestModal Loaded (Optimized)');

})(window);
