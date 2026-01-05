// ═══════════════════════════════════════════════════════════════════════════════
// STAP OPERATIONS PORTAL - COMPLETE DEMO SYSTEM
// Interactive onboarding with welcome slides, guided tours, action detection,
// progress tracking, checkmarks, and celebration effects
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    // ═══════════════════════════════════════════════════════════════════════════════
    // DEMO ACTIONS - Global event system for detecting user interactions
    // ═══════════════════════════════════════════════════════════════════════════════
    const DemoActions = {
        listeners: {},

        // Emit an action event
        emit(action, data = {}) {
            console.log(`🎯 DemoAction: "${action}"`, data);

            // Notify specific listeners
            if (this.listeners[action]) {
                this.listeners[action].forEach(cb => cb(data));
            }
            // Notify wildcard listeners
            if (this.listeners['*']) {
                this.listeners['*'].forEach(cb => cb(action, data));
            }
        },

        // Subscribe to an action
        on(action, callback) {
            if (!this.listeners[action]) this.listeners[action] = [];
            this.listeners[action].push(callback);

            // Return unsubscribe function
            return () => {
                this.listeners[action] = this.listeners[action].filter(cb => cb !== callback);
            };
        },

        // Clear all listeners
        reset() {
            this.listeners = {};
        },

        // Predefined action types
        SYNC_DATA: 'sync_data',
        UPLOAD_CSV: 'upload_csv',
        CLICK_STATUS_CARD: 'click_status_card',
        CLICK_FILTER: 'click_filter',
        CLICK_ROW: 'click_row',
        VIEW_CHANGE: 'view_change',
        CLICK_CAMPAIGN: 'click_campaign',
        RUN_OCR: 'run_ocr',
        EXPORT_PDF: 'export_pdf',
        CLICK_MATERIAL: 'click_material',
        OPEN_MODAL: 'open_modal',
        CLOSE_MODAL: 'close_modal'
    };

    // Make globally available
    window.DemoActions = DemoActions;

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONFETTI CELEBRATION - Canvas-based particle animation
    // ═══════════════════════════════════════════════════════════════════════════════
    const Confetti = ({ active, onComplete, intensity = 'normal' }) => {
        const canvasRef = useRef(null);
        const animationRef = useRef(null);
        const isMountedRef = useRef(true);

        useEffect(() => {
            isMountedRef.current = true;
            return () => { isMountedRef.current = false; };
        }, []);

        useEffect(() => {
            if (!active) return;

            const canvas = canvasRef.current;
            if (!canvas) {
                console.warn('Confetti: Canvas not ready');
                onComplete?.();
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.warn('Confetti: Context not available');
                onComplete?.();
                return;
            }

            // Setup canvas dimensions
            const width = window.innerWidth || 800;
            const height = window.innerHeight || 600;
            canvas.width = width;
            canvas.height = height;

            // Particle configuration
            const particleCount = intensity === 'epic' ? 300 : intensity === 'normal' ? 150 : 75;
            const colors = [
                '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
                '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
            ];
            const shapes = ['rect', 'circle', 'triangle', 'star'];

            // Create particles
            const particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height - height,
                    size: Math.random() * 10 + 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    speedY: Math.random() * 4 + 2,
                    speedX: Math.random() * 4 - 2,
                    rotation: Math.random() * 360,
                    rotationSpeed: Math.random() * 15 - 7.5,
                    shape: shapes[Math.floor(Math.random() * shapes.length)],
                    opacity: 1,
                    wobble: Math.random() * 10
                });
            }

            let frame = 0;
            const maxFrames = intensity === 'epic' ? 300 : 180;

            const drawStar = (ctx, x, y, size) => {
                const spikes = 5;
                const outerRadius = size;
                const innerRadius = size / 2;
                let rot = Math.PI / 2 * 3;
                const step = Math.PI / spikes;

                ctx.beginPath();
                ctx.moveTo(x, y - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius);
                    rot += step;
                    ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius);
                    rot += step;
                }
                ctx.closePath();
                ctx.fill();
            };

            const animate = () => {
                if (!isMountedRef.current || !canvasRef.current) {
                    if (animationRef.current) cancelAnimationFrame(animationRef.current);
                    return;
                }

                try {
                    ctx.clearRect(0, 0, width, height);

                    particles.forEach(p => {
                        ctx.save();
                        ctx.globalAlpha = p.opacity;
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.rotation * Math.PI / 180);
                        ctx.fillStyle = p.color;

                        switch (p.shape) {
                            case 'rect':
                                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                                break;
                            case 'circle':
                                ctx.beginPath();
                                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                                ctx.fill();
                                break;
                            case 'triangle':
                                ctx.beginPath();
                                ctx.moveTo(0, -p.size / 2);
                                ctx.lineTo(p.size / 2, p.size / 2);
                                ctx.lineTo(-p.size / 2, p.size / 2);
                                ctx.closePath();
                                ctx.fill();
                                break;
                            case 'star':
                                drawStar(ctx, 0, 0, p.size / 2);
                                break;
                        }

                        ctx.restore();

                        // Physics
                        p.y += p.speedY;
                        p.x += p.speedX + Math.sin(p.wobble + frame * 0.05) * 0.5;
                        p.rotation += p.rotationSpeed;
                        p.speedY += 0.1; // gravity

                        // Fade out near end
                        if (frame > maxFrames - 60) {
                            p.opacity = Math.max(0, p.opacity - 0.02);
                        }
                    });

                    frame++;
                    if (frame < maxFrames) {
                        animationRef.current = requestAnimationFrame(animate);
                    } else {
                        if (isMountedRef.current) onComplete?.();
                    }
                } catch (err) {
                    console.warn('Confetti error:', err);
                    if (animationRef.current) cancelAnimationFrame(animationRef.current);
                    onComplete?.();
                }
            };

            animate();

            return () => {
                if (animationRef.current) cancelAnimationFrame(animationRef.current);
            };
        }, [active, intensity, onComplete]);

        if (!active) return null;

        return React.createElement('canvas', {
            ref: canvasRef,
            className: 'fixed inset-0 pointer-events-none z-[200]',
            style: { mixBlendMode: 'multiply' }
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // ANIMATED CHECKMARK - SVG checkmark with draw animation
    // ═══════════════════════════════════════════════════════════════════════════════
    const AnimatedCheckmark = ({ size = 24, color = '#10b981', delay = 0 }) => {
        const [animate, setAnimate] = useState(false);

        useEffect(() => {
            const timer = setTimeout(() => setAnimate(true), delay);
            return () => clearTimeout(timer);
        }, [delay]);

        return React.createElement('svg', {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            className: 'inline-block'
        }, [
            React.createElement('circle', {
                key: 'circle',
                cx: 12,
                cy: 12,
                r: 10,
                fill: color,
                className: animate ? 'animate-scale-in' : 'opacity-0'
            }),
            React.createElement('path', {
                key: 'check',
                d: 'M7 13l3 3 7-7',
                fill: 'none',
                stroke: 'white',
                strokeWidth: 2.5,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                style: {
                    strokeDasharray: 20,
                    strokeDashoffset: animate ? 0 : 20,
                    transition: `stroke-dashoffset 0.4s ease ${delay + 200}ms`
                }
            })
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // PROGRESS RING - Circular progress indicator
    // ═══════════════════════════════════════════════════════════════════════════════
    const ProgressRing = ({ progress, size = 60, strokeWidth = 4, color = '#6366f1' }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (progress / 100) * circumference;

        return React.createElement('svg', {
            width: size,
            height: size,
            className: 'transform -rotate-90'
        }, [
            React.createElement('circle', {
                key: 'bg',
                cx: size / 2,
                cy: size / 2,
                r: radius,
                fill: 'none',
                stroke: '#e5e7eb',
                strokeWidth: strokeWidth
            }),
            React.createElement('circle', {
                key: 'progress',
                cx: size / 2,
                cy: size / 2,
                r: radius,
                fill: 'none',
                stroke: color,
                strokeWidth: strokeWidth,
                strokeLinecap: 'round',
                strokeDasharray: circumference,
                strokeDashoffset: offset,
                style: { transition: 'stroke-dashoffset 0.5s ease' }
            })
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // DEMO TIP - Contextual help boxes
    // ═══════════════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════════════
    // FEATURE BADGE - Highlight new/important features
    // ═══════════════════════════════════════════════════════════════════════════════
    const FeatureBadge = ({ label = 'New', showIf = true, pulse = true }) => {
        if (!showIf) return null;

        return React.createElement('span', {
            className: `ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wide shadow-lg ${pulse ? 'animate-pulse' : ''}`
        }, label);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // WELCOME MODAL - Introduction slides for first-time users
    // ═══════════════════════════════════════════════════════════════════════════════
    const DemoWelcomeModal = ({ isOpen, onClose, onStartTour, Icon }) => {
        const [currentSlide, setCurrentSlide] = useState(0);
        const [isAnimating, setIsAnimating] = useState(false);

        if (!isOpen) return null;

        const slides = [
            {
                icon: '🎯',
                iconBg: 'from-indigo-500 to-purple-600',
                title: 'Welcome to STAP Operations',
                subtitle: 'Your Command Center for Transit Advertising',
                description: 'Manage campaigns from contract to completion with real-time tracking, photo verification, and automated compliance reports.',
                features: [
                    { icon: '📊', label: 'Real-time Tracking', desc: 'Monitor all campaigns in one dashboard' },
                    { icon: '📷', label: 'Photo Verification', desc: 'AI-powered POP with OCR analysis' },
                    { icon: '📈', label: 'Availability Charts', desc: 'PDF exports with utilization metrics' },
                    { icon: '📄', label: 'Compliance Reports', desc: 'Automated performance documentation' }
                ]
            },
            {
                icon: '⚙️',
                iconBg: 'from-blue-500 to-cyan-600',
                title: 'Navigate with Gears',
                subtitle: 'Three Interconnected Workflows',
                description: 'The animated gear sidebar represents different aspects of your daily operations. Hover to reveal options.',
                features: [
                    { icon: '🔵', label: 'Modules (Blue)', desc: 'Dashboard, Stages, POP Gallery' },
                    { icon: '🟣', label: 'Pipeline (Purple)', desc: 'Delayed, In-Progress, Installed' },
                    { icon: '⚫', label: 'History (Black)', desc: 'Expired, Past Due, Analytics' }
                ],
                tip: 'Click the < arrow to collapse sidebar into a compact mini-bar'
            },
            {
                icon: '📈',
                iconBg: 'from-emerald-500 to-teal-600',
                title: 'Track Campaign Lifecycle',
                subtitle: 'From Hold to Installation to POP',
                description: 'Follow every campaign through stages with automated status updates, deadline alerts, and progress tracking.',
                features: [
                    { icon: '⏳', label: 'Delayed Flights', desc: 'Campaigns needing immediate attention' },
                    { icon: '🔄', label: 'In-Progress', desc: 'Currently being installed' },
                    { icon: '📅', label: 'Timeline View', desc: 'Photos organized by date' },
                    { icon: '📸', label: 'POP Gallery', desc: 'Complete photo documentation' }
                ]
            },
            {
                icon: '🚀',
                iconBg: 'from-pink-500 to-rose-600',
                title: 'Ready to Explore?',
                subtitle: 'Sample Data Pre-loaded',
                description: 'We\'ve loaded realistic campaign data so you can try every feature. In production, you\'ll upload Salesforce CSV exports or sync with Google Sheets.',
                features: [
                    { icon: '🟣', label: 'Purple Badges', desc: 'Highlight key features to try' },
                    { icon: '📖', label: 'Guide Panel', desc: 'Step-by-step instructions' },
                    { icon: '✓', label: 'Progress Tracking', desc: 'Checkmarks as you complete steps' },
                    { icon: '🎉', label: 'Celebrations', desc: 'Confetti when you master a section' }
                ],
                isFinal: true
            }
        ];

        const slide = slides[currentSlide];

        const goToSlide = (index) => {
            if (isAnimating || index === currentSlide) return;
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentSlide(index);
                setIsAnimating(false);
            }, 150);
        };

        const nextSlide = () => {
            if (currentSlide < slides.length - 1) {
                goToSlide(currentSlide + 1);
            }
        };

        const prevSlide = () => {
            if (currentSlide > 0) {
                goToSlide(currentSlide - 1);
            }
        };

        return React.createElement('div', {
            className: 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4'
        },
            React.createElement('div', {
                className: `bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`
            }, [
                // Header with gradient
                React.createElement('div', {
                    key: 'header',
                    className: `bg-gradient-to-r ${slide.iconBg} px-8 py-6 relative overflow-hidden`
                }, [
                    // Decorative circles
                    React.createElement('div', {
                        key: 'deco1',
                        className: 'absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full'
                    }),
                    React.createElement('div', {
                        key: 'deco2',
                        className: 'absolute -bottom-20 -left-10 w-60 h-60 bg-white/5 rounded-full'
                    }),
                    // Content
                    React.createElement('div', {
                        key: 'content',
                        className: 'relative flex items-start justify-between'
                    }, [
                        React.createElement('div', { key: 'left', className: 'flex items-center gap-4' }, [
                            React.createElement('div', {
                                key: 'icon',
                                className: 'text-5xl bg-white/20 backdrop-blur rounded-2xl p-3 shadow-lg'
                            }, slide.icon),
                            React.createElement('div', { key: 'text' }, [
                                React.createElement('h2', {
                                    key: 'title',
                                    className: 'text-white font-bold text-2xl mb-1'
                                }, slide.title),
                                React.createElement('p', {
                                    key: 'subtitle',
                                    className: 'text-white/80 text-sm'
                                }, slide.subtitle)
                            ])
                        ]),
                        React.createElement('button', {
                            key: 'close',
                            onClick: onClose,
                            className: 'text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-all'
                        }, '✕')
                    ])
                ]),

                // Body
                React.createElement('div', { key: 'body', className: 'p-8' }, [
                    React.createElement('p', {
                        key: 'desc',
                        className: 'text-gray-600 mb-6 leading-relaxed'
                    }, slide.description),

                    // Features grid
                    React.createElement('div', {
                        key: 'features',
                        className: 'grid grid-cols-2 gap-3 mb-6'
                    }, slide.features.map((f, i) =>
                        React.createElement('div', {
                            key: i,
                            className: 'flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group'
                        }, [
                            React.createElement('span', {
                                key: 'icon',
                                className: 'text-2xl group-hover:scale-110 transition-transform'
                            }, f.icon),
                            React.createElement('div', { key: 'text' }, [
                                React.createElement('div', {
                                    key: 'label',
                                    className: 'font-semibold text-gray-800 text-sm'
                                }, f.label),
                                React.createElement('div', {
                                    key: 'desc',
                                    className: 'text-gray-500 text-xs'
                                }, f.desc)
                            ])
                        ])
                    )),

                    // Tip if present
                    slide.tip && React.createElement('div', {
                        key: 'tip',
                        className: 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3'
                    }, [
                        React.createElement('span', { key: 'icon', className: 'text-xl' }, '💡'),
                        React.createElement('p', { key: 'text', className: 'text-sm text-amber-900' }, slide.tip)
                    ])
                ]),

                // Footer
                React.createElement('div', {
                    key: 'footer',
                    className: 'px-8 py-5 bg-gray-50 border-t flex items-center justify-between'
                }, [
                    // Slide indicators
                    React.createElement('div', { key: 'dots', className: 'flex items-center gap-2' },
                        slides.map((_, i) =>
                            React.createElement('button', {
                                key: i,
                                onClick: () => goToSlide(i),
                                className: `h-2.5 rounded-full transition-all duration-300 ${
                                    i === currentSlide
                                        ? 'bg-indigo-600 w-8'
                                        : 'bg-gray-300 hover:bg-gray-400 w-2.5'
                                }`
                            })
                        )
                    ),

                    // Navigation buttons
                    React.createElement('div', { key: 'buttons', className: 'flex items-center gap-3' }, [
                        currentSlide > 0 && React.createElement('button', {
                            key: 'back',
                            onClick: prevSlide,
                            className: 'px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors flex items-center gap-1 hover:bg-gray-100 rounded-xl'
                        }, [
                            React.createElement('span', { key: 'arrow' }, '←'),
                            ' Back'
                        ]),

                        slide.isFinal ?
                            React.createElement('button', {
                                key: 'start',
                                onClick: () => { onClose(); onStartTour?.(); },
                                className: 'px-8 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-purple-200 hover:shadow-xl hover:scale-105'
                            }, ['Start Exploring ', React.createElement('span', { key: 'icon' }, '🚀')])
                            :
                            React.createElement('button', {
                                key: 'next',
                                onClick: nextSlide,
                                className: 'px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-200'
                            }, ['Next ', React.createElement('span', { key: 'arrow' }, '→')])
                    ])
                ])
            ])
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // DEMO GUIDE PANEL - Interactive step-by-step instructions
    // ═══════════════════════════════════════════════════════════════════════════════
    const DemoGuidePanel = ({ isOpen, onClose, currentView, onNavigate, Icon }) => {
        const [isMinimized, setIsMinimized] = useState(false);
        const [currentStep, setCurrentStep] = useState(0);
        const [showConfetti, setShowConfetti] = useState(false);
        const [confettiIntensity, setConfettiIntensity] = useState('normal');
        const [celebrationMessage, setCelebrationMessage] = useState('');
        const [recentlyCompleted, setRecentlyCompleted] = useState(null);

        // Load completed steps from localStorage
        const [completedSteps, setCompletedSteps] = useState(() => {
            try {
                return JSON.parse(localStorage.getItem('stap_demo_progress') || '{}');
            } catch { return {}; }
        });

        // Guide definitions for each view
        const guides = {
            upload: {
                icon: '📤',
                title: 'Data Upload Center',
                color: 'from-blue-500 to-cyan-500',
                steps: [
                    {
                        text: 'Click "Sync Live Data" to connect Google Sheets',
                        action: 'sync_data',
                        hint: 'Green button at the top - connects to your live data source',
                        type: 'action'
                    },
                    {
                        text: 'Or upload a CSV file manually',
                        action: 'upload_csv',
                        hint: 'Drag & drop or click the upload area',
                        type: 'action'
                    },
                    {
                        text: 'System auto-maps columns to fields',
                        action: null,
                        hint: 'Campaign ID, Start Date, Advertiser, etc. are detected',
                        type: 'observe'
                    },
                    {
                        text: 'Navigate to Dashboard to see your data',
                        action: 'view_change',
                        actionData: 'dashboard',
                        hint: 'Click Dashboard in the gear sidebar',
                        type: 'action'
                    }
                ],
                celebration: '📤 Upload Complete!'
            },
            dashboard: {
                icon: '📊',
                title: 'Operations Dashboard',
                color: 'from-indigo-500 to-purple-500',
                steps: [
                    {
                        text: 'Click a status card to filter campaigns',
                        action: 'click_status_card',
                        hint: 'Try "Delayed" to see campaigns needing attention',
                        type: 'action'
                    },
                    {
                        text: 'Use date and market filters',
                        action: 'click_filter',
                        hint: 'Dropdowns above the data table',
                        type: 'action'
                    },
                    {
                        text: 'Click any campaign row for details',
                        action: 'click_row',
                        hint: 'Opens the detail modal with full information',
                        type: 'action'
                    },
                    {
                        text: 'Explore the detail modal features',
                        action: null,
                        hint: 'Change stages, add notes, send emails',
                        type: 'observe'
                    }
                ],
                celebration: '📊 Dashboard Mastered!'
            },
            popGallery: {
                icon: '📷',
                title: 'POP Gallery',
                color: 'from-pink-500 to-rose-500',
                steps: [
                    {
                        text: 'Click a campaign card to expand photos',
                        action: 'click_campaign',
                        hint: 'Shows all photos for that campaign',
                        type: 'action'
                    },
                    {
                        text: 'Try the Timeline view',
                        action: null,
                        hint: 'Calendar icon in header - photos by date',
                        type: 'observe'
                    },
                    {
                        text: 'Run AI/OCR analysis on a photo',
                        action: 'run_ocr',
                        hint: 'Extracts text from poster images',
                        type: 'action'
                    },
                    {
                        text: 'Flag issues like graffiti or damage',
                        action: null,
                        hint: 'Report problems for follow-up',
                        type: 'observe'
                    }
                ],
                celebration: '📷 Gallery Expert!'
            },
            availability: {
                icon: '📈',
                title: 'Availability Charting',
                color: 'from-teal-500 to-emerald-500',
                steps: [
                    {
                        text: 'Adjust the date range',
                        action: 'click_filter',
                        hint: 'Use the date pickers at the top',
                        type: 'action'
                    },
                    {
                        text: 'Switch between view modes',
                        action: null,
                        hint: 'Timeline, Map, and Geopath tabs',
                        type: 'observe'
                    },
                    {
                        text: 'Export availability to PDF',
                        action: 'export_pdf',
                        hint: 'Customizable sections and branding',
                        type: 'action'
                    },
                    {
                        text: 'Review utilization statistics',
                        action: null,
                        hint: 'Check the metrics cards for insights',
                        type: 'observe'
                    }
                ],
                celebration: '📈 Charting Wizard!'
            },
            materialReceivers: {
                icon: '📦',
                title: 'Material Receivers',
                color: 'from-orange-500 to-amber-500',
                steps: [
                    {
                        text: 'Browse the materials inventory',
                        action: null,
                        hint: 'All received posters and creatives',
                        type: 'observe'
                    },
                    {
                        text: 'Click a material to preview',
                        action: 'click_material',
                        hint: 'See poster image and deployment status',
                        type: 'action'
                    },
                    {
                        text: 'Check deployment progress',
                        action: null,
                        hint: 'Track how many are installed',
                        type: 'observe'
                    },
                    {
                        text: 'Link to Google Sheet for live updates',
                        action: 'sync_data',
                        hint: 'Settings → Paste your Sheet URL',
                        type: 'action'
                    }
                ],
                celebration: '📦 Materials Pro!'
            },
            performanceReport: {
                icon: '📄',
                title: 'Performance Report',
                color: 'from-emerald-500 to-green-500',
                steps: [
                    {
                        text: 'Select the reporting period',
                        action: 'click_filter',
                        hint: 'Filter by date range',
                        type: 'action'
                    },
                    {
                        text: 'Review completion rates by market',
                        action: null,
                        hint: 'Color-coded: Green 90%+, Red <50%',
                        type: 'observe'
                    },
                    {
                        text: 'Export or print the report',
                        action: 'export_pdf',
                        hint: 'CSV download or print options',
                        type: 'action'
                    },
                    {
                        text: 'Check overall compliance status',
                        action: null,
                        hint: 'Summary metrics at the top',
                        type: 'observe'
                    }
                ],
                celebration: '📄 Reporting Master!'
            }
        };

        const guide = guides[currentView] || guides.dashboard;
        const steps = guide.steps;
        const totalSteps = steps.length;

        // Calculate progress
        const viewProgress = steps.filter((_, i) => completedSteps[`${currentView}_${i}`]).length;
        const totalAllSteps = Object.values(guides).reduce((sum, g) => sum + g.steps.length, 0);
        const completedAllSteps = Object.keys(completedSteps).filter(k => completedSteps[k]).length;
        const overallProgress = Math.round((completedAllSteps / totalAllSteps) * 100);

        // Reset step when view changes
        useEffect(() => {
            setCurrentStep(0);
        }, [currentView]);

        // Listen for demo actions
        useEffect(() => {
            if (!isOpen) return;

            const unsubscribe = DemoActions.on('*', (action, data) => {
                const step = steps[currentStep];
                if (!step || !step.action) return;

                let matches = false;
                if (step.action === action) {
                    if (step.actionData) {
                        matches = data?.view === step.actionData || data?.type === step.actionData;
                    } else {
                        matches = true;
                    }
                }

                if (matches && !completedSteps[`${currentView}_${currentStep}`]) {
                    markStepComplete(currentView, currentStep);
                    // Auto-advance after brief delay
                    setTimeout(() => {
                        if (currentStep < totalSteps - 1) {
                            setCurrentStep(prev => prev + 1);
                        }
                    }, 600);
                }
            });

            return unsubscribe;
        }, [isOpen, currentView, currentStep, totalSteps, steps, completedSteps]);

        // Mark step complete and save
        const markStepComplete = (view, stepIndex) => {
            const key = `${view}_${stepIndex}`;
            if (completedSteps[key]) return;

            const updated = { ...completedSteps, [key]: true };
            setCompletedSteps(updated);
            setRecentlyCompleted(key);

            setTimeout(() => setRecentlyCompleted(null), 2000);

            try {
                localStorage.setItem('stap_demo_progress', JSON.stringify(updated));
            } catch {}

            // Check section completion
            const sectionDone = guide.steps.every((_, i) => updated[`${view}_${i}`]);
            if (sectionDone) {
                setCelebrationMessage(guide.celebration);
                setConfettiIntensity('normal');
                setShowConfetti(true);
            }

            // Check all sections complete
            const allDone = Object.entries(guides).every(([v, g]) =>
                g.steps.every((_, i) => updated[`${v}_${i}`])
            );
            if (allDone) {
                setCelebrationMessage('🎉 Tour Complete! You\'re a STAP Expert!');
                setConfettiIntensity('epic');
                setShowConfetti(true);
            }
        };

        const isStepDone = (view, stepIndex) => completedSteps[`${view}_${stepIndex}`] === true;

        const goNext = () => {
            // Auto-complete observe steps
            if (steps[currentStep]?.type === 'observe') {
                markStepComplete(currentView, currentStep);
            }
            if (currentStep < totalSteps - 1) {
                setCurrentStep(currentStep + 1);
            } else if (guide.celebration && onNavigate) {
                // Move to next section
                const viewKeys = Object.keys(guides);
                const currentIndex = viewKeys.indexOf(currentView);
                if (currentIndex < viewKeys.length - 1) {
                    onNavigate(viewKeys[currentIndex + 1]);
                }
            }
        };

        const goPrev = () => {
            if (currentStep > 0) setCurrentStep(currentStep - 1);
        };

        const skipStep = () => {
            markStepComplete(currentView, currentStep);
            goNext();
        };

        if (!isOpen) return null;

        // Minimized view
        if (isMinimized) {
            return React.createElement('div', {}, [
                React.createElement(Confetti, {
                    key: 'confetti',
                    active: showConfetti,
                    intensity: confettiIntensity,
                    onComplete: () => setShowConfetti(false)
                }),
                React.createElement('button', {
                    key: 'mini',
                    onClick: () => setIsMinimized(false),
                    className: 'fixed bottom-24 right-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl flex items-center gap-3 px-5 py-4 z-50 hover:scale-105 transition-transform border border-white/20'
                }, [
                    React.createElement('span', { key: 'icon', className: 'text-2xl' }, '🎓'),
                    React.createElement('div', { key: 'info', className: 'text-left' }, [
                        React.createElement('div', { key: 'title', className: 'text-white font-bold text-sm' }, 'Demo Guide'),
                        React.createElement('div', { key: 'progress', className: 'text-white/70 text-xs' }, `${overallProgress}% complete`)
                    ]),
                    React.createElement('div', { key: 'ring', className: 'relative' }, [
                        React.createElement(ProgressRing, {
                            key: 'progress-ring',
                            progress: overallProgress,
                            size: 44,
                            strokeWidth: 4,
                            color: '#fff'
                        }),
                        React.createElement('span', {
                            key: 'pct',
                            className: 'absolute inset-0 flex items-center justify-center text-white text-xs font-bold'
                        }, `${overallProgress}%`)
                    ])
                ])
            ]);
        }

        const step = steps[currentStep];

        // Full panel
        return React.createElement('div', {}, [
            React.createElement(Confetti, {
                key: 'confetti',
                active: showConfetti,
                intensity: confettiIntensity,
                onComplete: () => setShowConfetti(false)
            }),

            // Celebration toast
            celebrationMessage && showConfetti && React.createElement('div', {
                key: 'toast',
                className: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl px-10 py-8 z-[201] animate-bounce border-4 border-indigo-100'
            }, [
                React.createElement('div', { key: 'emoji', className: 'text-6xl text-center mb-3' }, '🎉'),
                React.createElement('div', { key: 'msg', className: 'text-2xl font-bold text-center bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent' }, celebrationMessage)
            ]),

            // Main panel
            React.createElement('div', {
                key: 'panel',
                className: 'fixed bottom-24 right-4 w-[440px] bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden'
            }, [
                // Overall progress bar
                React.createElement('div', { key: 'progress-bar', className: 'h-1.5 bg-gray-100' },
                    React.createElement('div', {
                        className: 'h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700',
                        style: { width: `${overallProgress}%` }
                    })
                ),

                // Header
                React.createElement('div', {
                    key: 'header',
                    className: `bg-gradient-to-r ${guide.color} px-5 py-4`
                }, [
                    // Title row
                    React.createElement('div', { key: 'title-row', className: 'flex items-center justify-between mb-4' }, [
                        React.createElement('div', { key: 'left', className: 'flex items-center gap-3' }, [
                            React.createElement('div', { key: 'icon-wrap', className: 'relative' }, [
                                React.createElement('span', {
                                    key: 'icon',
                                    className: 'text-3xl bg-white/20 backdrop-blur rounded-xl p-2 block'
                                }, guide.icon),
                                viewProgress === totalSteps && React.createElement('span', {
                                    key: 'complete',
                                    className: 'absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs shadow-lg'
                                }, '✓')
                            ]),
                            React.createElement('div', { key: 'text' }, [
                                React.createElement('h3', { key: 'title', className: 'text-white font-bold text-lg' }, guide.title),
                                React.createElement('p', { key: 'sub', className: 'text-white/80 text-xs' },
                                    `Step ${currentStep + 1} of ${totalSteps} • ${overallProgress}% overall`
                                )
                            ])
                        ]),
                        React.createElement('div', { key: 'buttons', className: 'flex items-center gap-1' }, [
                            React.createElement('button', {
                                key: 'min',
                                onClick: () => setIsMinimized(true),
                                className: 'text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-all',
                                title: 'Minimize'
                            }, '−'),
                            React.createElement('button', {
                                key: 'close',
                                onClick: onClose,
                                className: 'text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-all',
                                title: 'Close'
                            }, '✕')
                        ])
                    ]),

                    // Step indicators
                    React.createElement('div', { key: 'steps', className: 'flex items-center gap-2' },
                        steps.map((s, i) => {
                            const done = isStepDone(currentView, i);
                            const active = i === currentStep;
                            const recent = recentlyCompleted === `${currentView}_${i}`;

                            return React.createElement('button', {
                                key: i,
                                onClick: () => setCurrentStep(i),
                                className: `flex-1 h-11 rounded-xl transition-all duration-300 flex items-center justify-center ${
                                    active
                                        ? 'bg-white text-indigo-600 shadow-lg scale-105 font-bold'
                                        : done
                                            ? 'bg-white/30 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                } ${recent ? 'ring-2 ring-green-400 ring-offset-2' : ''}`
                            }, done
                                ? React.createElement(AnimatedCheckmark, { size: 20, color: active ? '#10b981' : '#fff' })
                                : React.createElement('span', { className: 'font-bold' }, i + 1)
                            );
                        })
                    )
                ]),

                // Step content
                React.createElement('div', { key: 'content', className: 'p-5' }, [
                    // Current step card
                    React.createElement('div', {
                        key: 'step-card',
                        className: `rounded-2xl p-5 mb-4 transition-all duration-300 ${
                            isStepDone(currentView, currentStep)
                                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200'
                                : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100'
                        }`
                    }, [
                        // Status badge
                        React.createElement('div', { key: 'status', className: 'flex items-center justify-between mb-3' }, [
                            React.createElement('span', {
                                key: 'badge',
                                className: `text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                                    isStepDone(currentView, currentStep)
                                        ? 'bg-green-200 text-green-700'
                                        : step.type === 'observe'
                                            ? 'bg-blue-200 text-blue-700'
                                            : 'bg-amber-200 text-amber-700'
                                }`
                            }, isStepDone(currentView, currentStep)
                                ? '✓ Completed'
                                : step.type === 'observe'
                                    ? '👁 Observe'
                                    : '👆 Action Required'
                            )
                        ]),

                        // Step text
                        React.createElement('h4', {
                            key: 'text',
                            className: `text-lg font-bold mb-2 ${
                                isStepDone(currentView, currentStep) ? 'text-green-700' : 'text-gray-800'
                            }`
                        }, step.text),

                        // Hint
                        React.createElement('p', {
                            key: 'hint',
                            className: 'text-sm text-gray-500 flex items-start gap-2'
                        }, [
                            React.createElement('span', { key: 'icon', className: 'text-indigo-400' }, 'ℹ️'),
                            step.hint
                        ]),

                        // Completed message
                        isStepDone(currentView, currentStep) && React.createElement('div', {
                            key: 'done-msg',
                            className: 'mt-4 flex items-center gap-2 text-green-600 bg-green-100 rounded-lg px-3 py-2'
                        }, [
                            React.createElement('span', { key: 'icon', className: 'text-xl' }, '🎯'),
                            React.createElement('span', { key: 'text', className: 'text-sm font-medium' }, 'Great job! Step completed.')
                        ])
                    ]),

                    // Navigation buttons
                    React.createElement('div', { key: 'nav', className: 'flex items-center justify-between' }, [
                        React.createElement('button', {
                            key: 'prev',
                            onClick: goPrev,
                            disabled: currentStep === 0,
                            className: `flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                currentStep === 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`
                        }, ['← Back']),

                        // Skip button for action steps
                        !isStepDone(currentView, currentStep) && step.type === 'action' && React.createElement('button', {
                            key: 'skip',
                            onClick: skipStep,
                            className: 'text-xs text-gray-400 hover:text-gray-600 underline'
                        }, 'Skip'),

                        React.createElement('button', {
                            key: 'next',
                            onClick: goNext,
                            className: `flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl ${
                                currentStep === totalSteps - 1
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                            }`
                        }, [
                            currentStep === totalSteps - 1 ? 'Next Section' : (step.type === 'observe' ? 'Got it!' : 'Next'),
                            ' →'
                        ])
                    ])
                ]),

                // Section navigation footer
                React.createElement('div', {
                    key: 'footer',
                    className: 'px-5 py-4 bg-gray-50 border-t border-gray-100'
                }, [
                    React.createElement('div', {
                        key: 'label',
                        className: 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2'
                    }, ['🗺️ Tour Sections']),

                    React.createElement('div', {
                        key: 'sections',
                        className: 'grid grid-cols-3 gap-2'
                    }, Object.entries(guides).map(([key, g]) => {
                        const sectionSteps = g.steps.length;
                        const sectionDone = g.steps.filter((_, i) => isStepDone(key, i)).length;
                        const isComplete = sectionDone === sectionSteps;
                        const isCurrent = key === currentView;

                        return React.createElement('button', {
                            key: key,
                            onClick: () => onNavigate?.(key),
                            className: `p-2.5 rounded-xl text-left transition-all ${
                                isCurrent
                                    ? 'bg-indigo-100 border-2 border-indigo-300 shadow-md'
                                    : isComplete
                                        ? 'bg-green-50 border border-green-200'
                                        : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                            }`
                        }, [
                            React.createElement('div', { key: 'top', className: 'flex items-center justify-between mb-1' }, [
                                React.createElement('span', { key: 'icon', className: 'text-lg' }, g.icon),
                                isComplete && React.createElement('span', {
                                    key: 'check',
                                    className: 'text-green-500 text-sm'
                                }, '✓')
                            ]),
                            React.createElement('div', {
                                key: 'title',
                                className: `text-[10px] font-bold truncate ${isCurrent ? 'text-indigo-700' : 'text-gray-700'}`
                            }, g.title.split(' ')[0]),
                            React.createElement('div', {
                                key: 'progress',
                                className: 'text-[9px] text-gray-400 mt-0.5'
                            }, `${sectionDone}/${sectionSteps}`)
                        ]);
                    }))
                ])
            ])
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // MOCK DATA GENERATOR - Creates realistic demo campaign data
    // ═══════════════════════════════════════════════════════════════════════════════
    const generateMockData = () => {
        const today = new Date();
        const formatDate = (d) => `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
        const getRelDate = (days) => {
            const d = new Date(today);
            d.setDate(today.getDate() + days);
            return formatDate(d);
        };

        const holds = [
            { id: 'DEMO-001', start: getRelDate(-10), media: 'Transit Shelters', quantity: '50', advertiser: 'Coca Cola', owner: 'John Doe', stage: 'Material Ready For Install' },
            { id: 'DEMO-002', start: getRelDate(-5), media: 'Bus Bench', quantity: '20', advertiser: 'Nike', owner: 'Jane Smith', stage: 'Proofs Approved' },
            { id: 'DEMO-003', start: getRelDate(8), media: 'Digital Screen', quantity: '10', advertiser: 'Apple', owner: 'John Doe', stage: 'Contracted' },
            { id: 'DEMO-004', start: getRelDate(0), media: 'Billboard', quantity: '5', advertiser: 'Samsung', owner: 'Jane Smith', stage: 'Installed' },
            { id: 'DEMO-005', start: getRelDate(30), media: 'Shelter', quantity: '15', advertiser: 'Call Jacob', owner: 'Demo User', stage: 'Contracted' },
            { id: 'DEMO-006', start: getRelDate(-65), media: 'Urban Panel', quantity: '100', advertiser: 'Netflix', owner: 'Demo User', stage: 'Working On It' },
            { id: 'DEMO-007', start: getRelDate(2), media: 'Kiosk', quantity: '12', advertiser: 'Local Gym', owner: 'John Doe', stage: 'Art Work Received' }
        ];

        const installs = [
            { campaign: 'DEMO-006', start: getRelDate(-65), product: 'Urban Panel', quantity: '100', install: '45', advertiser: 'Netflix', owner: 'Demo User', stage: 'Working On It' },
            { campaign: 'DEMO-004', start: getRelDate(0), product: 'Billboard', quantity: '5', install: '5', advertiser: 'Samsung', owner: 'Jane Smith', stage: 'Installed' },
            { campaign: 'DEMO-008', start: getRelDate(-90), product: 'Shelter', quantity: '10', install: '10', advertiser: 'Old Campaign', owner: 'Jane Smith', stage: 'POP Completed', end: getRelDate(-40) }
        ];

        return { holds, installs };
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // DEMO MATERIALS - Sample material receiver inventory data
    // ═══════════════════════════════════════════════════════════════════════════════
    const getDemoMaterials = () => [
        {
            id: 'INV174705',
            receiptNumber: 'INV174705',
            dateReceived: new Date('2025-12-31T08:14:00'),
            description: 'GET TRUE VALUE-AL',
            posterCode: 'GET TRUE VALUE-AL',
            client: 'ACCIDENT LAWYERS',
            advertiser: 'Insider Accident Lawyers',
            printer: 'CIRCLE GRAPHICS-P',
            quantity: 11,
            boxes: 1,
            designs: 1,
            comments: 'RECEIVED 1 BOX; 1 DESIGN ON 12.30.25',
            status: 'Received',
            warehouseLocation: 'Bay 3 - Shelf A2',
            matchedCampaign: '251230001-0',
            posterImage: 'https://picsum.photos/seed/accident-lawyers/400/500',
            keywords: ['insider', 'accident', 'lawyers', 'get', 'true', 'value']
        },
        {
            id: 'INV174688',
            receiptNumber: 'INV174688',
            dateReceived: new Date('2025-12-30T14:22:00'),
            description: 'STRANGER THINGS S5-NF',
            posterCode: 'STRANGER-S5-NF',
            client: 'NETFLIX',
            advertiser: 'Netflix',
            printer: 'VISION GRAPHICS',
            quantity: 250,
            boxes: 12,
            designs: 3,
            comments: 'RECEIVED 12 BOXES; 3 DESIGNS - MAIN CAST, LOGO, TEASER',
            status: 'In Warehouse',
            warehouseLocation: 'Bay 1 - Pallets 1-3',
            matchedCampaign: '258905855-0',
            posterImage: 'https://picsum.photos/seed/netflix-stranger/400/500',
            keywords: ['netflix', 'stranger', 'things', 'season', '5']
        },
        {
            id: 'INV174690',
            receiptNumber: 'INV174690',
            dateReceived: new Date('2025-12-29T09:45:00'),
            description: 'AIR MAX 2025-NK',
            posterCode: 'AIRMAX-2025-NK',
            client: 'NIKE',
            advertiser: 'Nike',
            printer: 'COLORCRAFT INC',
            quantity: 75,
            boxes: 4,
            designs: 2,
            comments: 'RECEIVED 4 BOXES; 2 DESIGNS - PRODUCT SHOT, LIFESTYLE',
            status: 'Partially Deployed',
            warehouseLocation: 'Bay 2 - Shelf B1',
            matchedCampaign: '250929011-0',
            deployedQty: 45,
            posterImage: 'https://picsum.photos/seed/nike-airmax/400/500',
            keywords: ['nike', 'air', 'max', '2025']
        },
        {
            id: 'INV174685',
            receiptNumber: 'INV174685',
            dateReceived: new Date('2025-12-28T11:30:00'),
            description: 'iPHONE 16 PRO-APL',
            posterCode: 'IP16PRO-APL',
            client: 'APPLE',
            advertiser: 'Apple',
            printer: 'PREMIUM PRINT CO',
            quantity: 50,
            boxes: 3,
            designs: 1,
            comments: 'RECEIVED 3 BOXES; 1 DESIGN - PRODUCT HERO',
            status: 'Fully Deployed',
            warehouseLocation: 'N/A - All Deployed',
            matchedCampaign: '251115003-0',
            deployedQty: 50,
            posterImage: 'https://picsum.photos/seed/apple-iphone/400/500',
            keywords: ['apple', 'iphone', '16', 'pro']
        },
        {
            id: 'INV174680',
            receiptNumber: 'INV174680',
            dateReceived: new Date('2025-12-27T16:00:00'),
            description: 'DAVID YURMAN JEWELRY-DY',
            posterCode: 'JEWELRY-DY-2026',
            client: 'DAVID YURMAN',
            advertiser: 'David Yurman',
            printer: 'LUXE GRAPHICS',
            quantity: 25,
            boxes: 2,
            designs: 1,
            comments: 'RECEIVED 2 BOXES; 1 DESIGN - SPRING COLLECTION',
            status: 'Fully Deployed',
            warehouseLocation: 'N/A - All Deployed',
            matchedCampaign: '250922043-0',
            deployedQty: 25,
            posterImage: 'https://picsum.photos/seed/david-yurman/400/500',
            keywords: ['david', 'yurman', 'jewelry']
        },
        {
            id: 'INV174675',
            receiptNumber: 'INV174675',
            dateReceived: new Date('2025-12-26T10:15:00'),
            description: 'GALAXY S25 ULTRA-SAM',
            posterCode: 'GS25U-SAM',
            client: 'SAMSUNG',
            advertiser: 'Samsung',
            printer: 'DIGITAL PRINT WORKS',
            quantity: 100,
            boxes: 6,
            designs: 2,
            comments: 'RECEIVED 6 BOXES; 2 DESIGNS - PRODUCT, LIFESTYLE',
            status: 'Partially Deployed',
            warehouseLocation: 'Bay 2 - Shelf C3',
            matchedCampaign: '250830022-0',
            deployedQty: 68,
            posterImage: 'https://picsum.photos/seed/samsung-galaxy/400/500',
            keywords: ['samsung', 'galaxy', 's25', 'ultra']
        },
        {
            id: 'INV174670',
            receiptNumber: 'INV174670',
            dateReceived: new Date('2025-12-24T08:00:00'),
            description: 'COCA-COLA SUMMER-CC',
            posterCode: 'SUMMER-CC-2025',
            client: 'COCA-COLA',
            advertiser: 'Coca-Cola',
            printer: 'CLASSIC PRINT',
            quantity: 40,
            boxes: 2,
            designs: 1,
            comments: 'RECEIVED 2 BOXES; 1 DESIGN - SUMMER REFRESH',
            status: 'In Warehouse',
            warehouseLocation: 'Bay 4 - Shelf D1',
            matchedCampaign: '251201044-0',
            posterImage: 'https://picsum.photos/seed/coca-cola/400/500',
            keywords: ['coca', 'cola', 'summer', 'refresh']
        },
        {
            id: 'INV174665',
            receiptNumber: 'INV174665',
            dateReceived: new Date('2025-12-23T13:45:00'),
            description: 'MCRIB RETURNS-MCD',
            posterCode: 'MCRIB-2025-MCD',
            client: 'MCDONALDS',
            advertiser: 'McDonalds',
            printer: 'GOLDEN ARCH PRINT',
            quantity: 35,
            boxes: 2,
            designs: 1,
            comments: 'RECEIVED 2 BOXES; 1 DESIGN - MCRIB PROMO',
            status: 'Partially Deployed',
            warehouseLocation: 'Bay 3 - Shelf B2',
            matchedCampaign: '251010033-0',
            deployedQty: 28,
            posterImage: 'https://picsum.photos/seed/mcdonalds/400/500',
            keywords: ['mcdonalds', 'mcrib', 'returns']
        }
    ];

    // ═══════════════════════════════════════════════════════════════════════════════
    // RESET DEMO PROGRESS - Clear all saved progress
    // ═══════════════════════════════════════════════════════════════════════════════
    const resetDemoProgress = () => {
        try {
            localStorage.removeItem('stap_demo_progress');
            console.log('🔄 Demo progress reset');
            return true;
        } catch {
            return false;
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORT TO WINDOW
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAPDemo = {
        // Components
        DemoTip,
        FeatureBadge,
        DemoWelcomeModal,
        DemoGuidePanel,
        Confetti,
        AnimatedCheckmark,
        ProgressRing,

        // Event system
        DemoActions,

        // Data generators
        generateMockData,
        getDemoMaterials,

        // Utilities
        resetDemoProgress
    };

    console.log('✅ STAP Demo System loaded');

})(window);
