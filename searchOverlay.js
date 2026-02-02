// ═══════════════════════════════════════════════════════════════════════════════
// STAP Search Overlay - Global Campaign Search
// External module for LA STAP Operations Portal
// Fullscreen search overlay with keyboard navigation
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useRef } = React;

    // Get Icon from global export
    const Icon = window.STAP_Icon || (({ name, size, className }) =>
        React.createElement('span', { title: name, className }, '?')
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEARCH OVERLAY COMPONENT
    // ═══════════════════════════════════════════════════════════════════════════════
    const SearchOverlay = ({ isOpen, onClose, allData = [], onSelectCampaign }) => {
        const [query, setQuery] = useState('');
        const [results, setResults] = useState([]);
        const [selectedIndex, setSelectedIndex] = useState(0);
        const [showAll, setShowAll] = useState(false);
        const inputRef = useRef(null);

        // Focus input when overlay opens
        useEffect(() => {
            if (isOpen && inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
            if (!isOpen) {
                setQuery('');
                setResults([]);
                setShowAll(false);
            }
        }, [isOpen]);

        // Search logic - queries all campaign fields
        useEffect(() => {
            if (query.length >= 2 && allData?.length) {
                const needle = query.toLowerCase();
                const matches = allData.filter(c =>
                    (c.advertiser || '').toLowerCase().includes(needle) ||
                    (c.name || '').toLowerCase().includes(needle) ||
                    (c.id || '').toLowerCase().includes(needle) ||
                    (c.product || c.media || '').toLowerCase().includes(needle) ||
                    (c.market || '').toLowerCase().includes(needle) ||
                    (c.owner || '').toLowerCase().includes(needle)
                );
                setResults(matches);
                setSelectedIndex(0);
            } else {
                setResults([]);
            }
        }, [query, allData]);

        // Keyboard navigation
        const handleKeyDown = (e) => {
            const displayedResults = showAll ? results.slice(0, 100) : results.slice(0, 10);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, displayedResults.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && displayedResults[selectedIndex]) {
                e.preventDefault();
                onSelectCampaign(displayedResults[selectedIndex]);
                onClose();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        // Don't render if not open
        if (!isOpen) return null;

        const displayedResults = showAll ? results.slice(0, 100) : results.slice(0, 10);

        // Helper function for stage colors
        const getStageColor = (stage) => {
            const s = (stage || '').toLowerCase();
            if (s.includes('hold')) return 'bg-red-100 text-red-700';
            if (s === 'installed') return 'bg-green-100 text-green-700';
            if (s.includes('material')) return 'bg-yellow-100 text-yellow-700';
            if (s.includes('pop')) return 'bg-blue-100 text-blue-700';
            if (s.includes('takedown') || s.includes('complete')) return 'bg-emerald-100 text-emerald-700';
            if (s.includes('contract')) return 'bg-indigo-100 text-indigo-700';
            if (s.includes('rfp') || s.includes('proposal')) return 'bg-gray-100 text-gray-600';
            return 'bg-gray-100 text-gray-700';
        };

        return (
            <div
                className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <div className="w-full max-w-2xl px-4">
                    {/* Header */}
                    <div className="text-center mb-4">
                        <h2 className="text-white text-lg font-semibold flex items-center justify-center gap-2">
                            <Icon name="Search" size={20} className="text-purple-400" />
                            Campaign Search
                        </h2>
                        <p className="text-gray-400 text-sm">Search across all campaigns • Cmd+K to open anytime</p>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                        <Icon name="Search" size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search campaigns, advertisers, markets..."
                            className="w-full pl-14 pr-12 py-5 text-xl bg-white rounded-2xl shadow-2xl border-0 focus:outline-none focus:ring-4 focus:ring-purple-500/30"
                            autoComplete="off"
                        />
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                            <Icon name="X" size={20} />
                        </button>
                    </div>

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="mt-3 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
                            <div className="px-4 py-2 bg-gray-50 border-b text-sm text-gray-500 font-medium flex justify-between items-center sticky top-0">
                                <span>{results.length} campaign{results.length !== 1 ? 's' : ''} found</span>
                                <span className="text-xs text-gray-400">↑↓ navigate • Enter select • Esc close</span>
                            </div>
                            {displayedResults.map((result, idx) => (
                                <div
                                    key={`${result.id}-${result.date}-${idx}`}
                                    onClick={() => { onSelectCampaign(result); onClose(); }}
                                    className={`px-4 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors ${idx === selectedIndex ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-gray-900 truncate flex items-center gap-2">
                                            {result.advertiser}
                                            {result.isPremium && <span className="text-amber-500">⭐</span>}
                                        </div>
                                        <div className="text-sm text-gray-500 truncate">{result.name}</div>
                                        <div className="text-xs text-gray-400 truncate mt-0.5">
                                            {result.id} • {result.market || 'No Market'} • {result.owner || 'No Owner'}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getStageColor(result.stage)}`}>
                                            {result.stage || 'No Stage'}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            Qty: {result.qty || 0} • Installed: {result.installed || 0}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {/* Show All / Show Less */}
                            {results.length > 10 && (
                                <button
                                    onClick={() => setShowAll(!showAll)}
                                    className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium text-center transition-colors"
                                >
                                    {showAll ? 'Show less' : `Show all ${results.length} results`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* No Results */}
                    {query.length >= 2 && results.length === 0 && (
                        <div className="mt-3 bg-white rounded-2xl shadow-2xl p-8 text-center">
                            <Icon name="SearchX" size={48} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500">No campaigns found for "{query}"</p>
                            <p className="text-sm text-gray-400 mt-1">Try searching by advertiser, campaign name, ID, or market</p>
                        </div>
                    )}

                    {/* Hint when empty */}
                    {query.length < 2 && (
                        <div className="mt-4 text-center text-gray-400 text-sm">
                            Type at least 2 characters to search
                        </div>
                    )}

                    {/* Quick Tips */}
                    {query.length < 2 && (
                        <div className="mt-6 grid grid-cols-3 gap-3">
                            <div className="bg-white/10 rounded-xl p-3 text-center">
                                <div className="text-purple-300 text-xs font-medium mb-1">Search by</div>
                                <div className="text-white text-sm">Advertiser</div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3 text-center">
                                <div className="text-purple-300 text-xs font-medium mb-1">Search by</div>
                                <div className="text-white text-sm">Campaign ID</div>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3 text-center">
                                <div className="text-purple-300 text-xs font-medium mb-1">Search by</div>
                                <div className="text-white text-sm">Market</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORTS - Available globally
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAPSearchOverlay = SearchOverlay;

    console.log('✅ STAP Search Overlay loaded');

})(window);
