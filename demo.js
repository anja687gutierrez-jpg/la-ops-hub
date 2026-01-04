// ═══════════════════════════════════════════════════════════════════════
// STAP OPERATIONS PORTAL - DEMO MODE COMPONENTS
// This file contains all demo/guide components and mock data generators
// Load this file only when demo mode is needed
// ═══════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';
    
    const { useState, useEffect, useMemo, useRef } = React;
    
    // ═══════════════════════════════════════════════════════════════════════
    // DEMO TIP COMPONENT - Reusable info boxes
    // ═══════════════════════════════════════════════════════════════════════
    const DemoTip = ({ title, children, type = 'info', showIf = true }) => {
        if (!showIf) return null;
        
        const styles = {
            info: 'bg-blue-50 border-blue-300 text-blue-800',
            success: 'bg-green-50 border-green-300 text-green-800',
            warning: 'bg-amber-50 border-amber-300 text-amber-800',
            feature: 'bg-purple-50 border-purple-300 text-purple-800',
            workflow: 'bg-indigo-50 border-indigo-300 text-indigo-800'
        };
        
        const icons = {
            info: '💡',
            success: '✅',
            warning: '⚠️',
            feature: '✨',
            workflow: '🔄'
        };
        
        return React.createElement('div', { 
            className: `${styles[type]} border rounded-lg p-3 mb-3 text-sm animate-fade-in` 
        }, [
            React.createElement('div', { 
                key: 'header',
                className: 'font-bold flex items-center gap-2 mb-1' 
            }, [
                React.createElement('span', { key: 'icon' }, icons[type]),
                React.createElement('span', { key: 'title' }, title),
                React.createElement('span', { 
                    key: 'badge',
                    className: 'ml-auto text-[10px] opacity-60 uppercase' 
                }, 'Demo Tip')
            ]),
            React.createElement('div', { 
                key: 'content',
                className: 'text-xs opacity-90' 
            }, children)
        ]);
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // FEATURE BADGE - Highlight new/important features
    // ═══════════════════════════════════════════════════════════════════════
    const FeatureBadge = ({ label, showIf = true }) => {
        if (!showIf) return null;
        return React.createElement('span', {
            className: 'ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[9px] font-bold rounded-full uppercase animate-pulse'
        }, label);
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // WELCOME MODAL - First-time user experience
    // ═══════════════════════════════════════════════════════════════════════
    const DemoWelcomeModal = ({ isOpen, onClose, onStartTour, Icon }) => {
        const [currentSlide, setCurrentSlide] = useState(0);
        
        if (!isOpen) return null;
        
        const slides = [
            {
                icon: '🎯',
                title: 'Welcome to STAP Operations Portal',
                subtitle: 'Your Command Center for Transit Advertising',
                description: 'This interactive demo will guide you through key features that help operations teams manage campaigns, track installations, and generate compliance reports.',
                features: [
                    { icon: '📊', text: 'Real-time campaign tracking' },
                    { icon: '📷', text: 'Photo verification with AI/OCR' },
                    { icon: '📈', text: 'Availability charting with PDF export' },
                    { icon: '📄', text: 'Automated compliance reports' }
                ]
            },
            {
                icon: '⚙️',
                title: 'Navigate with the Gear System',
                subtitle: 'Three Gears, Three Workflows',
                description: 'The sidebar features interconnected gears representing different aspects of your daily operations:',
                features: [
                    { icon: '🔵', text: 'MODULES - Dashboard, Update Stages, POP Gallery' },
                    { icon: '🟣', text: 'PIPELINE - Delayed, In-Progress, Installed' },
                    { icon: '⚫', text: 'HISTORY - Expired, Past Due, Analytics' }
                ],
                tip: '💡 Hover over each gear to reveal navigation options. Click the < button to collapse.'
            },
            {
                icon: '📈',
                title: 'Track Your Campaigns',
                subtitle: 'From Hold to Installation to POP',
                description: 'Follow campaigns through every stage with real-time status updates, progress tracking, and automated alerts.',
                features: [
                    { icon: '⏳', text: 'Delayed Flights - Needs immediate attention' },
                    { icon: '🔄', text: 'In-Progress - Currently being installed' },
                    { icon: '📅', text: 'Timeline View - Photos organized by date' },
                    { icon: '📸', text: 'POP Gallery - Photo documentation' }
                ]
            },
            {
                icon: '🚀',
                title: 'Ready to Explore?',
                subtitle: 'Sample Data Pre-loaded for Demo',
                description: 'We\'ve loaded realistic campaign data so you can explore all features. In production, upload your Salesforce CSV exports.',
                features: [
                    { icon: '🟣', text: 'Purple badges highlight key features' },
                    { icon: '📖', text: 'Guide panel explains each view' },
                    { icon: '🔄', text: 'Toggle guide on/off with bottom button' },
                    { icon: '🚪', text: '"Exit Demo" returns to login screen' }
                ],
                cta: true
            }
        ];
        
        const slide = slides[currentSlide];
        
        return React.createElement('div', {
            className: 'fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in'
        }, 
            React.createElement('div', {
                className: 'bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in'
            }, [
                // Header
                React.createElement('div', {
                    key: 'header',
                    className: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-5'
                }, 
                    React.createElement('div', { className: 'flex items-center justify-between' }, [
                        React.createElement('div', { key: 'left', className: 'flex items-center gap-4' }, [
                            React.createElement('span', { key: 'icon', className: 'text-4xl bg-white/20 rounded-xl p-2' }, slide.icon),
                            React.createElement('div', { key: 'text' }, [
                                React.createElement('h2', { key: 'title', className: 'text-white font-bold text-xl' }, slide.title),
                                React.createElement('p', { key: 'sub', className: 'text-white/80 text-sm' }, slide.subtitle)
                            ])
                        ]),
                        React.createElement('button', {
                            key: 'close',
                            onClick: onClose,
                            className: 'text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg'
                        }, Icon && React.createElement(Icon, { name: 'X', size: 24 }))
                    ])
                ),
                // Content
                React.createElement('div', { key: 'content', className: 'p-6' }, [
                    React.createElement('p', { key: 'desc', className: 'text-gray-600 mb-6 text-sm leading-relaxed' }, slide.description),
                    React.createElement('div', { key: 'features', className: 'grid grid-cols-2 gap-3 mb-6' },
                        slide.features.map((feature, i) => 
                            React.createElement('div', {
                                key: i,
                                className: 'flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors'
                            }, [
                                React.createElement('span', { key: 'icon', className: 'text-2xl' }, feature.icon),
                                React.createElement('span', { key: 'text', className: 'text-sm text-gray-700 font-medium' }, feature.text)
                            ])
                        )
                    ),
                    slide.tip && React.createElement('div', {
                        key: 'tip',
                        className: 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3'
                    }, [
                        Icon && React.createElement(Icon, { key: 'icon', name: 'Lightbulb', size: 20, className: 'text-amber-600 flex-shrink-0 mt-0.5' }),
                        React.createElement('span', { key: 'text', className: 'text-sm text-amber-900' }, slide.tip)
                    ])
                ]),
                // Footer
                React.createElement('div', {
                    key: 'footer',
                    className: 'px-6 py-4 bg-gray-50 border-t flex items-center justify-between'
                }, [
                    React.createElement('div', { key: 'dots', className: 'flex items-center gap-2' },
                        slides.map((_, i) => 
                            React.createElement('button', {
                                key: i,
                                onClick: () => setCurrentSlide(i),
                                className: `h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'bg-indigo-600 w-8' : 'bg-gray-300 hover:bg-gray-400 w-2'}`
                            })
                        )
                    ),
                    React.createElement('div', { key: 'buttons', className: 'flex items-center gap-3' }, [
                        currentSlide > 0 && React.createElement('button', {
                            key: 'back',
                            onClick: () => setCurrentSlide(currentSlide - 1),
                            className: 'px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors flex items-center gap-1'
                        }, [
                            Icon && React.createElement(Icon, { key: 'icon', name: 'ArrowLeft', size: 16 }),
                            ' Back'
                        ]),
                        currentSlide < slides.length - 1 ? 
                            React.createElement('button', {
                                key: 'next',
                                onClick: () => setCurrentSlide(currentSlide + 1),
                                className: 'px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200'
                            }, ['Next ', Icon && React.createElement(Icon, { key: 'icon', name: 'ArrowRight', size: 16 })])
                            :
                            React.createElement('button', {
                                key: 'start',
                                onClick: () => { onClose(); if (onStartTour) onStartTour(); },
                                className: 'px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-purple-200'
                            }, ['Start Exploring ', Icon && React.createElement(Icon, { key: 'icon', name: 'Rocket', size: 16 })])
                    ])
                ])
            ])
        );
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // DEMO GUIDE PANEL - Floating contextual help
    // ═══════════════════════════════════════════════════════════════════════
    const DemoGuidePanel = ({ isOpen, onClose, currentView, onNavigate, Icon }) => {
        const [isMinimized, setIsMinimized] = useState(false);
        
        if (!isOpen) return null;
        
        const guides = {
            upload: {
                icon: '📤',
                title: 'Data Upload Center',
                color: 'from-blue-500 to-cyan-500',
                steps: [
                    { text: 'Click "Live Sync" for Google Sheets connection', highlight: true },
                    { text: 'Or upload Master Export CSV manually' },
                    { text: 'Smart column matching handles format variations' },
                    { text: 'Dashboard auto-populates with campaign data' }
                ],
                tips: [
                    'Export from Salesforce as CSV for best results',
                    'System detects ghost bookings automatically',
                    'Data persists until you click "Reset Data"'
                ]
            },
            dashboard: {
                icon: '📊',
                title: 'Operations Dashboard',
                color: 'from-indigo-500 to-purple-500',
                steps: [
                    { text: 'Status cards show campaign counts at a glance', highlight: true },
                    { text: 'Click any card to filter the table below' },
                    { text: 'Use header filters for date, market, product' },
                    { text: 'Click a row to see details & send emails' }
                ],
                tips: [
                    'Delayed = past start date, not yet installed',
                    'In-Progress = has installs within 2 months',
                    'Weather widget helps plan outdoor work'
                ]
            },
            popGallery: {
                icon: '📷',
                title: 'POP Gallery',
                color: 'from-pink-500 to-rose-500',
                steps: [
                    { text: 'Campaign cards show photo progress', highlight: true },
                    { text: 'Click a card to expand all photos' },
                    { text: 'Use Timeline view (calendar icon) to see photos by date', highlight: true },
                    { text: 'AI Analysis verifies correct advertiser' },
                    { text: 'Flag issues like graffiti or wrong poster' }
                ],
                tips: [
                    'Timeline view shows installation dates per campaign',
                    'Link local folder for real install photos',
                    'OCR extracts text from poster images',
                    'Export to Performance Report for compliance'
                ]
            },
            availabilityCharting: {
                icon: '📈',
                title: 'Availability Charting',
                color: 'from-teal-500 to-cyan-500',
                steps: [
                    { text: 'View inventory utilization across date ranges', highlight: true },
                    { text: 'Filter by Market, Media Type, and Date Range' },
                    { text: 'Toggle Timeline, Map, or Geopath views' },
                    { text: 'Export PDF with customizable sections', highlight: true }
                ],
                tips: [
                    'PDF Export lets you choose which sections to include',
                    'Map view shows utilization by geography',
                    'Geopath tab shows impression estimates',
                    'Use date quick-picks for common ranges'
                ]
            },
            materialReceivers: {
                icon: '📦',
                title: 'Material Receivers',
                color: 'from-orange-500 to-amber-500',
                steps: [
                    { text: 'Track materials from receipt to deployment', highlight: true },
                    { text: 'Status: Received → Warehouse → Deployed' },
                    { text: 'Click receipt for poster preview & details' },
                    { text: 'Auto-match receipts to campaigns' }
                ],
                tips: [
                    'Link Google Sheet for real-time data',
                    'Keywords help verify POP photos',
                    'Deployment % tracks installation progress'
                ]
            },
            performanceReport: {
                icon: '📄',
                title: 'Performance Report',
                color: 'from-emerald-500 to-teal-500',
                steps: [
                    { text: 'Generate city compliance documentation', highlight: true },
                    { text: 'Filter by date range and market' },
                    { text: 'By-market breakdown shows completion rates' },
                    { text: 'Export to CSV or Print for submission' }
                ],
                tips: [
                    'Green ≥90%, Yellow 50-89%, Red <50%',
                    'Print layout optimized for official forms',
                    'Include photos as installation evidence'
                ]
            }
        };
        
        const guide = guides[currentView] || guides.dashboard;
        
        if (isMinimized) {
            return React.createElement('button', {
                onClick: () => setIsMinimized(false),
                className: 'fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-xl flex items-center justify-center z-50 hover:scale-110 transition-transform group animate-bounce',
                title: 'Show Demo Guide'
            }, [
                React.createElement('span', { key: 'icon', className: 'text-2xl' }, '🎓'),
                React.createElement('span', {
                    key: 'badge',
                    className: 'absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-[10px] font-bold text-amber-900 animate-pulse'
                }, '?')
            ]);
        }
        
        return React.createElement('div', {
            className: 'fixed bottom-24 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-scale-in'
        }, [
            // Header
            React.createElement('div', {
                key: 'header',
                className: `bg-gradient-to-r ${guide.color} px-4 py-3`
            },
                React.createElement('div', { className: 'flex items-center justify-between' }, [
                    React.createElement('div', { key: 'left', className: 'flex items-center gap-3' }, [
                        React.createElement('span', { key: 'icon', className: 'text-2xl bg-white/20 rounded-lg p-1.5' }, guide.icon),
                        React.createElement('div', { key: 'text' }, [
                            React.createElement('h3', { key: 'title', className: 'text-white font-bold text-sm' }, guide.title),
                            React.createElement('p', { key: 'sub', className: 'text-white/70 text-[10px]' }, 'Demo Guide')
                        ])
                    ]),
                    React.createElement('div', { key: 'buttons', className: 'flex items-center gap-1' }, [
                        React.createElement('button', {
                            key: 'min',
                            onClick: () => setIsMinimized(true),
                            className: 'text-white/60 hover:text-white p-1.5 hover:bg-white/10 rounded transition-colors',
                            title: 'Minimize'
                        }, Icon && React.createElement(Icon, { name: 'Minus', size: 14 })),
                        React.createElement('button', {
                            key: 'close',
                            onClick: onClose,
                            className: 'text-white/60 hover:text-white p-1.5 hover:bg-white/10 rounded transition-colors',
                            title: 'Close'
                        }, Icon && React.createElement(Icon, { name: 'X', size: 14 }))
                    ])
                ])
            ),
            // Content
            React.createElement('div', { key: 'content', className: 'p-4 max-h-72 overflow-auto' }, [
                React.createElement('div', { key: 'steps', className: 'mb-4' }, [
                    React.createElement('div', {
                        key: 'label',
                        className: 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1'
                    }, [
                        Icon && React.createElement(Icon, { key: 'icon', name: 'ListOrdered', size: 12 }),
                        ' How it works'
                    ]),
                    React.createElement('div', { key: 'list', className: 'space-y-1.5' },
                        guide.steps.map((step, i) =>
                            React.createElement('div', {
                                key: i,
                                className: `flex items-start gap-2 p-2 rounded-lg transition-colors ${step.highlight ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50'}`
                            }, [
                                React.createElement('span', {
                                    key: 'num',
                                    className: `flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.highlight ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`
                                }, i + 1),
                                React.createElement('span', { key: 'text', className: 'text-xs text-gray-700' }, step.text)
                            ])
                        )
                    )
                ]),
                guide.tips && React.createElement('div', { key: 'tips' }, [
                    React.createElement('div', {
                        key: 'label',
                        className: 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1'
                    }, [
                        Icon && React.createElement(Icon, { key: 'icon', name: 'Lightbulb', size: 12 }),
                        ' Pro Tips'
                    ]),
                    React.createElement('div', { key: 'list', className: 'space-y-1' },
                        guide.tips.map((tip, i) =>
                            React.createElement('div', {
                                key: i,
                                className: 'text-[11px] text-gray-600 flex items-start gap-2'
                            }, [
                                React.createElement('span', { key: 'dot', className: 'text-amber-500' }, '•'),
                                tip
                            ])
                        )
                    )
                ])
            ])
        ]);
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // MOCK DATA GENERATOR - Creates realistic demo data
    // ═══════════════════════════════════════════════════════════════════════
    const generateMockData = () => {
        const today = new Date();
        const formatDate = (d) => `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
        
        const getRelDate = (days) => {
            const d = new Date(today);
            d.setDate(today.getDate() + days);
            return formatDate(d);
        };

        const holds = [
            { 'id': 'DEMO-001', 'start': getRelDate(-10), 'media': 'Transit Shelters', 'quantity': '50', 'advertiser': 'Coca Cola', 'owner': 'John Doe', 'stage': 'Material Ready For Install' },
            { 'id': 'DEMO-002', 'start': getRelDate(-5), 'media': 'Bus Bench', 'quantity': '20', 'advertiser': 'Nike', 'owner': 'Jane Smith', 'stage': 'Proofs Approved' },
            { 'id': 'DEMO-003', 'start': getRelDate(8), 'media': 'Digital Screen', 'quantity': '10', 'advertiser': 'Apple', 'owner': 'John Doe', 'stage': 'Contracted' },
            { 'id': 'DEMO-004', 'start': getRelDate(0), 'media': 'Billboard', 'quantity': '5', 'advertiser': 'Samsung', 'owner': 'Jane Smith', 'stage': 'Installed' },
            { 'id': 'DEMO-005', 'start': getRelDate(30), 'media': 'Shelter', 'quantity': '15', 'advertiser': 'Call Jacob', 'owner': 'Demo User', 'stage': 'Contracted' },
            { 'id': 'DEMO-006', 'start': getRelDate(-65), 'media': 'Urban Panel', 'quantity': '100', 'advertiser': 'Netflix', 'owner': 'Demo User', 'stage': 'Working On It' },
            { 'id': 'DEMO-007', 'start': getRelDate(2), 'media': 'Kiosk', 'quantity': '12', 'advertiser': 'Local Gym', 'owner': 'John Doe', 'stage': 'Art Work Received' },
        ];

        const installs = [
            { 'campaign': 'DEMO-006', 'start': getRelDate(-65), 'product': 'Urban Panel', 'quantity': '100', 'install': '45', 'advertiser': 'Netflix', 'owner': 'Demo User', 'stage': 'Working On It' },
            { 'campaign': 'DEMO-004', 'start': getRelDate(0), 'product': 'Billboard', 'quantity': '5', 'install': '5', 'advertiser': 'Samsung', 'owner': 'Jane Smith', 'stage': 'Installed' },
            { 'campaign': 'DEMO-008', 'start': getRelDate(-90), 'product': 'Shelter', 'quantity': '10', 'install': '10', 'advertiser': 'Old Campaign', 'owner': 'Jane Smith', 'stage': 'POP Completed', 'end': getRelDate(-40) }
        ];

        return { holds, installs };
    };
    
    // ═══════════════════════════════════════════════════════════════════════
    // DEMO MATERIALS - Sample material receiver data
    // ═══════════════════════════════════════════════════════════════════════
    const getDemoMaterials = () => [
        {
            id: 'demo-1',
            receiptNumber: 'RCV-2024-001',
            dateReceived: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            description: 'Netflix Campaign Posters',
            posterCode: 'NFLX-2024-Q1',
            client: 'Netflix',
            advertiser: 'Netflix',
            printer: 'ABC Print Co',
            quantity: 150,
            boxes: 3,
            designs: 2,
            status: 'Deployed',
            warehouseLocation: 'Bay A-12',
            campaignId: '251230001-0',
            matchedCampaign: '251230001-0',
            productionSource: 'in-house',
            comments: 'Delivered on time, good quality'
        },
        {
            id: 'demo-2',
            receiptNumber: 'RCV-2024-002',
            dateReceived: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            description: 'Disney+ Streaming Launch',
            posterCode: 'DIS-STRM-001',
            client: 'Disney',
            advertiser: 'Disney',
            printer: 'XYZ Graphics',
            quantity: 200,
            boxes: 4,
            designs: 3,
            status: 'Material Ready for Install',
            warehouseLocation: 'Bay B-05',
            campaignId: '258905855-0',
            matchedCampaign: '258905855-0',
            productionSource: 'in-house',
            comments: ''
        },
        {
            id: 'demo-3',
            receiptNumber: 'RCV-2024-003',
            dateReceived: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            description: 'Apple iPhone 16 Pro',
            posterCode: 'APPL-IP16-PRO',
            client: 'Apple',
            advertiser: 'Apple',
            printer: 'Premium Print',
            quantity: 100,
            boxes: 2,
            designs: 1,
            status: 'Received at Warehouse',
            warehouseLocation: 'Bay C-01',
            productionSource: 'client',
            comments: 'Client-produced materials'
        }
    ];
    
    // ═══════════════════════════════════════════════════════════════════════
    // EXPORT TO WINDOW
    // ═══════════════════════════════════════════════════════════════════════
    window.STAPDemo = {
        DemoTip,
        FeatureBadge,
        DemoWelcomeModal,
        DemoGuidePanel,
        generateMockData,
        getDemoMaterials
    };
    
})(window);
