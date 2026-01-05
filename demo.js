// ═══════════════════════════════════════════════════════════════════════
// STAP OPERATIONS PORTAL - DEMO MODE COMPONENTS
// Interactive onboarding with action detection, progress tracking, and celebrations
// ═══════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    // ═══════════════════════════════════════════════════════════════════════
    // DEMO ACTIONS - Event system for detecting user actions
    // ═══════════════════════════════════════════════════════════════════════
    const DemoActions = {
        listeners: {},
        emit(action, data = {}) {
            const specificCount = this.listeners[action]?.length || 0;
            const wildcardCount = this.listeners['*']?.length || 0;
            console.log(`🎯 Demo Action EMIT: "${action}"`, data, `| Listeners: ${specificCount} specific, ${wildcardCount} wildcard`);

            if (this.listeners[action]) {
                this.listeners[action].forEach(cb => cb(data));
            }
            if (this.listeners['*']) {
                this.listeners['*'].forEach(cb => cb(action, data));
            }
        },
        on(action, callback) {
            if (!this.listeners[action]) this.listeners[action] = [];
            this.listeners[action].push(callback);
            console.log(`👂 DemoActions: Registered listener for "${action}" (total: ${this.listeners[action].length})`);
            return () => {
                this.listeners[action] = this.listeners[action].filter(cb => cb !== callback);
                console.log(`🔌 DemoActions: Unregistered listener for "${action}" (remaining: ${this.listeners[action].length})`);
            };
        },
        // Debug helper
        debug() {
            console.log('📊 DemoActions Listeners:', Object.keys(this.listeners).map(k => `${k}: ${this.listeners[k].length}`));
        },
        // Predefined actions
        CLICK_LIVE_SYNC: 'click_live_sync',
        UPLOAD_CSV: 'upload_csv',
        CLICK_STATUS_CARD: 'click_status_card',
        CLICK_FILTER: 'click_filter',
        CLICK_ROW: 'click_row',
        VIEW_CHANGE: 'view_change',
        CLICK_CAMPAIGN_CARD: 'click_campaign_card',
        RUN_OCR: 'run_ocr',
        EXPORT_PDF: 'export_pdf',
        CLICK_MATERIAL: 'click_material'
    };

    // Make it globally available
    window.DemoActions = DemoActions;

    // ═══════════════════════════════════════════════════════════════════════
    // CONFETTI CELEBRATION COMPONENT
    // ═══════════════════════════════════════════════════════════════════════
    const Confetti = ({ active, onComplete }) => {
        const canvasRef = useRef(null);
        const animationRef = useRef(null);
        const isMountedRef = useRef(true);

        useEffect(() => {
            isMountedRef.current = true;
            return () => {
                isMountedRef.current = false;
            };
        }, []);

        useEffect(() => {
            if (!active) return;

            let animationId = null;

            try {
                const canvas = canvasRef.current;
                if (!canvas) {
                    console.warn('Confetti: Canvas ref not available');
                    if (onComplete) onComplete();
                    return;
                }

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.warn('Confetti: Could not get 2D context');
                    if (onComplete) onComplete();
                    return;
                }

                // Set canvas size safely
                const width = window.innerWidth || 800;
                const height = window.innerHeight || 600;
                canvas.width = width;
                canvas.height = height;

                const particles = [];
                const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

                // Create particles
                for (let i = 0; i < 150; i++) {
                    particles.push({
                        x: Math.random() * width,
                        y: Math.random() * height - height,
                        size: Math.random() * 8 + 4,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        speedY: Math.random() * 3 + 2,
                        speedX: Math.random() * 2 - 1,
                        rotation: Math.random() * 360,
                        rotationSpeed: Math.random() * 10 - 5,
                        shape: Math.random() > 0.5 ? 'rect' : 'circle'
                    });
                }

                let frame = 0;
                const maxFrames = 180; // 3 seconds at 60fps

                const animate = () => {
                    // Safety check - stop if unmounted or canvas gone
                    if (!isMountedRef.current || !canvasRef.current) {
                        if (animationId) cancelAnimationFrame(animationId);
                        return;
                    }

                    try {
                        ctx.clearRect(0, 0, width, height);

                        particles.forEach(p => {
                            ctx.save();
                            ctx.translate(p.x, p.y);
                            ctx.rotate(p.rotation * Math.PI / 180);
                            ctx.fillStyle = p.color;

                            if (p.shape === 'rect') {
                                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                            } else {
                                ctx.beginPath();
                                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                                ctx.fill();
                            }

                            ctx.restore();

                            p.y += p.speedY;
                            p.x += p.speedX;
                            p.rotation += p.rotationSpeed;
                            p.speedY += 0.1; // gravity
                        });

                        frame++;
                        if (frame < maxFrames) {
                            animationId = requestAnimationFrame(animate);
                            animationRef.current = animationId;
                        } else {
                            if (isMountedRef.current && onComplete) {
                                onComplete();
                            }
                        }
                    } catch (animError) {
                        console.warn('Confetti animation error:', animError);
                        if (animationId) cancelAnimationFrame(animationId);
                        if (isMountedRef.current && onComplete) onComplete();
                    }
                };

                animate();

            } catch (error) {
                console.warn('Confetti initialization error:', error);
                if (onComplete) onComplete();
            }

            return () => {
                if (animationId) cancelAnimationFrame(animationId);
                if (animationRef.current) cancelAnimationFrame(animationRef.current);
            };
        }, [active, onComplete]);

        if (!active) return null;

        return React.createElement('canvas', {
            ref: canvasRef,
            className: 'fixed inset-0 pointer-events-none z-[200]',
            style: { mixBlendMode: 'multiply' }
        });
    };

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
    // DEMO GUIDE PANEL - Interactive onboarding with action detection
    // ═══════════════════════════════════════════════════════════════════════
    const DemoGuidePanel = ({ isOpen, onClose, currentView, onNavigate, Icon }) => {
        // Debug: Log when component mounts/updates
        useEffect(() => {
            console.log('🎓 DemoGuidePanel mounted/updated:', { isOpen, currentView, Icon: !!Icon });
        }, [isOpen, currentView]);

        const [isMinimized, setIsMinimized] = useState(false);
        const [currentStep, setCurrentStep] = useState(0);
        const [showConfetti, setShowConfetti] = useState(false);
        const [celebrationMessage, setCelebrationMessage] = useState('');
        const [completedSteps, setCompletedSteps] = useState(() => {
            try {
                return JSON.parse(localStorage.getItem('demo_completed_steps') || '{}');
            } catch { return {}; }
        });
        const [recentlyCompleted, setRecentlyCompleted] = useState(null);

        // Guide definitions with action triggers
        const guides = {
            upload: {
                icon: '📤',
                title: 'Data Upload Center',
                color: 'from-blue-500 to-cyan-500',
                steps: [
                    { text: 'Click "Sync Live Data" button', action: 'click_live_sync', hint: 'Green button at the top' },
                    { text: 'Or upload a CSV file', action: 'upload_csv', hint: 'Drag & drop or click upload area' },
                    { text: 'Review the column mapping', action: 'auto', hint: 'System auto-maps columns' },
                    { text: 'Go to Dashboard to see data', action: 'view_change', actionData: 'dashboard', hint: 'Click Dashboard in sidebar' }
                ],
                nextView: 'dashboard',
                celebration: '📤 Upload mastered!'
            },
            dashboard: {
                icon: '📊',
                title: 'Operations Dashboard',
                color: 'from-indigo-500 to-purple-500',
                steps: [
                    { text: 'Click a status card to filter', action: 'click_status_card', hint: 'Try "Delayed" or "In-Progress"' },
                    { text: 'Use the date/market filters', action: 'click_filter', hint: 'Dropdowns above the table' },
                    { text: 'Click a campaign row', action: 'click_row', hint: 'Opens detail modal' },
                    { text: 'Explore the detail modal', action: 'auto', hint: 'View stages, send emails' }
                ],
                nextView: 'popGallery',
                celebration: '📊 Dashboard pro!'
            },
            popGallery: {
                icon: '📷',
                title: 'POP Gallery',
                color: 'from-pink-500 to-rose-500',
                steps: [
                    { text: 'Click a campaign card', action: 'click_campaign_card', hint: 'Expands photo grid' },
                    { text: 'Try the Timeline view', action: 'auto', hint: 'Calendar icon in header' },
                    { text: 'Run AI/OCR on a photo', action: 'run_ocr', hint: 'Analyzes poster text' },
                    { text: 'Flag an issue', action: 'auto', hint: 'Report graffiti or errors' }
                ],
                nextView: 'availability',
                celebration: '📷 Photo expert!'
            },
            availability: {
                icon: '📈',
                title: 'Availability Charting',
                color: 'from-teal-500 to-cyan-500',
                steps: [
                    { text: 'Adjust the date range', action: 'click_filter', hint: 'Use date pickers' },
                    { text: 'Switch between views', action: 'auto', hint: 'Timeline, Map, Geopath tabs' },
                    { text: 'Export to PDF', action: 'export_pdf', hint: 'Customizable sections' },
                    { text: 'Review utilization stats', action: 'auto', hint: 'Check the metrics cards' }
                ],
                nextView: 'materialReceivers',
                celebration: '📈 Analytics wizard!'
            },
            materialReceivers: {
                icon: '📦',
                title: 'Material Receivers',
                color: 'from-orange-500 to-amber-500',
                steps: [
                    { text: 'View the materials table', action: 'auto', hint: 'See all received materials' },
                    { text: 'Click a material row', action: 'click_material', hint: 'View poster preview' },
                    { text: 'Check deployment status', action: 'auto', hint: 'Track installation progress' },
                    { text: 'Link to Google Sheet', action: 'click_live_sync', hint: 'Settings → Sheet URL' }
                ],
                nextView: 'performanceReport',
                celebration: '📦 Materials tracked!'
            },
            performanceReport: {
                icon: '📄',
                title: 'Performance Report',
                color: 'from-emerald-500 to-teal-500',
                steps: [
                    { text: 'Set the date range', action: 'click_filter', hint: 'Filter report period' },
                    { text: 'Review completion rates', action: 'auto', hint: 'Color-coded by market' },
                    { text: 'Export the report', action: 'export_pdf', hint: 'CSV or Print options' },
                    { text: 'Check compliance status', action: 'auto', hint: 'Green = 90%+, Red = <50%' }
                ],
                nextView: 'upload',
                celebration: '📄 Report master!'
            }
        };

        const guide = guides[currentView] || guides.dashboard;
        const totalSteps = guide.steps.length;
        const step = guide.steps[currentStep];

        // Calculate total progress across all views
        const totalAllSteps = Object.values(guides).reduce((sum, g) => sum + g.steps.length, 0);
        const completedAllSteps = Object.keys(completedSteps).filter(k => completedSteps[k]).length;
        const overallProgress = Math.round((completedAllSteps / totalAllSteps) * 100);

        // Reset step when view changes
        useEffect(() => {
            setCurrentStep(0);
        }, [currentView]);

        // Listen for demo actions
        useEffect(() => {
            if (!isOpen) {
                console.log('🔇 DemoGuidePanel: Not listening (panel closed)');
                return;
            }

            const currentStepData = guide.steps[currentStep];
            console.log('👂 DemoGuidePanel: Listening for actions', {
                currentView,
                currentStep,
                expectedAction: currentStepData?.action,
                expectedData: currentStepData?.actionData
            });

            const unsubscribe = DemoActions.on('*', (action, data) => {
                const stepData = guide.steps[currentStep];
                if (!stepData) {
                    console.log('⚠️ No step data for current step:', currentStep);
                    return;
                }

                console.log('📥 Received action:', action, data, '| Expected:', stepData.action, stepData.actionData);

                // Check if action matches current step
                let matches = false;
                if (stepData.action === action) {
                    if (stepData.actionData) {
                        matches = data?.view === stepData.actionData || data?.type === stepData.actionData;
                    } else {
                        matches = true;
                    }
                }

                console.log('🎯 Action match:', matches);

                if (matches) {
                    console.log('✅ Step completed! Marking and advancing...');
                    markStepComplete(currentView, currentStep);
                    // Auto-advance after a short delay
                    setTimeout(() => {
                        if (currentStep < totalSteps - 1) {
                            setCurrentStep(prev => prev + 1);
                        }
                    }, 500);
                }
            });

            return () => {
                console.log('🔌 DemoGuidePanel: Unsubscribing listener');
                unsubscribe();
            };
        }, [isOpen, currentView, currentStep, totalSteps]);

        // Save completed steps to localStorage
        const markStepComplete = (view, stepIndex) => {
            const key = `${view}_${stepIndex}`;
            if (completedSteps[key]) return; // Already completed

            const updated = { ...completedSteps, [key]: true };
            setCompletedSteps(updated);
            setRecentlyCompleted(key);

            // Clear recently completed animation after delay
            setTimeout(() => setRecentlyCompleted(null), 1500);

            try {
                localStorage.setItem('demo_completed_steps', JSON.stringify(updated));
            } catch {}

            // Check if section complete
            const sectionComplete = guide.steps.every((_, i) => updated[`${view}_${i}`]);
            if (sectionComplete) {
                setCelebrationMessage(guide.celebration);
                setShowConfetti(true);
            }

            // Check if all sections complete
            const allComplete = Object.entries(guides).every(([v, g]) =>
                g.steps.every((_, i) => updated[`${v}_${i}`])
            );
            if (allComplete) {
                setCelebrationMessage('🎉 Tour Complete! You\'re a STAP expert!');
                setShowConfetti(true);
            }
        };

        const isStepCompleted = (view, stepIndex) => {
            return completedSteps[`${view}_${stepIndex}`] === true;
        };

        const viewProgress = guide.steps.filter((_, i) => isStepCompleted(currentView, i)).length;

        const goNext = () => {
            if (step.action === 'auto') {
                markStepComplete(currentView, currentStep);
            }
            if (currentStep < totalSteps - 1) {
                setCurrentStep(currentStep + 1);
            } else if (guide.nextView && onNavigate) {
                onNavigate(guide.nextView);
            }
        };

        const goPrev = () => {
            if (currentStep > 0) {
                setCurrentStep(currentStep - 1);
            }
        };

        const skipStep = () => {
            markStepComplete(currentView, currentStep);
            goNext();
        };

        if (!isOpen) return null;

        // Minimized state
        if (isMinimized) {
            return React.createElement('div', { key: 'minimized' }, [
                React.createElement(Confetti, {
                    key: 'confetti',
                    active: showConfetti,
                    onComplete: () => setShowConfetti(false)
                }),
                React.createElement('button', {
                    key: 'btn',
                    onClick: () => setIsMinimized(false),
                    className: 'fixed bottom-24 right-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl flex items-center gap-3 px-4 py-3 z-50 hover:scale-105 transition-transform group'
                }, [
                    React.createElement('span', { key: 'icon', className: 'text-2xl' }, '🎓'),
                    React.createElement('div', { key: 'info', className: 'text-left' }, [
                        React.createElement('div', { key: 'title', className: 'text-white font-bold text-xs' }, 'Demo Guide'),
                        React.createElement('div', { key: 'progress', className: 'text-white/70 text-[10px]' }, `${overallProgress}% complete`)
                    ]),
                    React.createElement('div', {
                        key: 'ring',
                        className: 'w-10 h-10 rounded-full border-3 border-white/30 flex items-center justify-center relative'
                    }, [
                        React.createElement('svg', {
                            key: 'svg',
                            className: 'absolute inset-0 w-10 h-10 -rotate-90'
                        },
                            React.createElement('circle', {
                                cx: 20, cy: 20, r: 16,
                                fill: 'none',
                                stroke: 'white',
                                strokeWidth: 3,
                                strokeDasharray: `${overallProgress} 100`,
                                strokeLinecap: 'round'
                            })
                        ),
                        React.createElement('span', {
                            key: 'pct',
                            className: 'text-white text-[10px] font-bold'
                        }, `${overallProgress}%`)
                    ])
                ])
            ]);
        }

        // Full panel
        return React.createElement('div', { key: 'panel' }, [
            React.createElement(Confetti, {
                key: 'confetti',
                active: showConfetti,
                onComplete: () => setShowConfetti(false)
            }),
            // Celebration toast
            celebrationMessage && showConfetti && React.createElement('div', {
                key: 'toast',
                className: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl px-8 py-6 z-[201] animate-bounce'
            }, [
                React.createElement('div', { key: 'emoji', className: 'text-5xl text-center mb-2' }, '🎉'),
                React.createElement('div', { key: 'msg', className: 'text-xl font-bold text-center text-gray-800' }, celebrationMessage)
            ]),
            React.createElement('div', {
                key: 'main',
                className: 'fixed bottom-24 right-4 w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-scale-in'
            }, [
                // Overall progress bar
                React.createElement('div', {
                    key: 'progress-bar',
                    className: 'h-1.5 bg-gray-100'
                },
                    React.createElement('div', {
                        className: 'h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500',
                        style: { width: `${overallProgress}%` }
                    })
                ),
                // Header
                React.createElement('div', {
                    key: 'header',
                    className: `bg-gradient-to-r ${guide.color} px-4 py-3`
                }, [
                    React.createElement('div', { key: 'top', className: 'flex items-center justify-between mb-3' }, [
                        React.createElement('div', { key: 'left', className: 'flex items-center gap-3' }, [
                            React.createElement('div', {
                                key: 'icon-wrap',
                                className: 'relative'
                            }, [
                                React.createElement('span', { key: 'icon', className: 'text-3xl bg-white/20 rounded-xl p-2 block' }, guide.icon),
                                viewProgress === totalSteps && React.createElement('span', {
                                    key: 'check',
                                    className: 'absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs'
                                }, '✓')
                            ]),
                            React.createElement('div', { key: 'text' }, [
                                React.createElement('h3', { key: 'title', className: 'text-white font-bold text-base' }, guide.title),
                                React.createElement('p', { key: 'sub', className: 'text-white/80 text-xs' },
                                    `${viewProgress}/${totalSteps} steps • ${overallProgress}% overall`
                                )
                            ])
                        ]),
                        React.createElement('div', { key: 'buttons', className: 'flex items-center gap-1' }, [
                            React.createElement('button', {
                                key: 'min',
                                onClick: () => setIsMinimized(true),
                                className: 'text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors',
                                title: 'Minimize'
                            }, Icon && React.createElement(Icon, { name: 'Minimize2', size: 16 })),
                            React.createElement('button', {
                                key: 'close',
                                onClick: onClose,
                                className: 'text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors',
                                title: 'Close'
                            }, Icon && React.createElement(Icon, { name: 'X', size: 16 }))
                        ])
                    ]),
                    // Step indicators
                    React.createElement('div', { key: 'steps-row', className: 'flex items-center gap-2' },
                        guide.steps.map((s, i) => {
                            const completed = isStepCompleted(currentView, i);
                            const isCurrent = i === currentStep;
                            const justCompleted = recentlyCompleted === `${currentView}_${i}`;

                            return React.createElement('button', {
                                key: i,
                                onClick: () => setCurrentStep(i),
                                className: `flex-1 h-10 rounded-lg transition-all duration-300 flex items-center justify-center gap-1 ${
                                    isCurrent
                                        ? 'bg-white text-indigo-600 shadow-lg scale-105'
                                        : completed
                                            ? 'bg-white/30 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                } ${justCompleted ? 'animate-pulse ring-2 ring-green-400' : ''}`
                            }, [
                                completed
                                    ? React.createElement('span', { key: 'check', className: 'text-green-500 font-bold' }, '✓')
                                    : React.createElement('span', { key: 'num', className: 'font-bold text-sm' }, i + 1)
                            ]);
                        })
                    )
                ]),
                // Current step content
                React.createElement('div', { key: 'content', className: 'p-5' }, [
                    // Step card
                    React.createElement('div', {
                        key: 'step-card',
                        className: `rounded-xl p-4 mb-4 transition-all duration-300 ${
                            isStepCompleted(currentView, currentStep)
                                ? 'bg-green-50 border-2 border-green-200'
                                : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100'
                        }`
                    }, [
                        // Status badge
                        React.createElement('div', {
                            key: 'status',
                            className: 'flex items-center justify-between mb-3'
                        }, [
                            React.createElement('span', {
                                key: 'label',
                                className: `text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                                    isStepCompleted(currentView, currentStep)
                                        ? 'bg-green-200 text-green-700'
                                        : step.action === 'auto'
                                            ? 'bg-blue-200 text-blue-700'
                                            : 'bg-amber-200 text-amber-700'
                                }`
                            }, isStepCompleted(currentView, currentStep)
                                ? '✓ Completed'
                                : step.action === 'auto'
                                    ? '👁 Observe'
                                    : '👆 Action Required'
                            ),
                            React.createElement('span', {
                                key: 'step-num',
                                className: 'text-xs text-gray-400'
                            }, `Step ${currentStep + 1} of ${totalSteps}`)
                        ]),
                        // Step text
                        React.createElement('h4', {
                            key: 'text',
                            className: `text-lg font-bold mb-2 ${
                                isStepCompleted(currentView, currentStep) ? 'text-green-700' : 'text-gray-800'
                            }`
                        }, step.text),
                        // Hint
                        React.createElement('p', {
                            key: 'hint',
                            className: 'text-sm text-gray-500 flex items-center gap-2'
                        }, [
                            Icon && React.createElement(Icon, { key: 'icon', name: 'Info', size: 14, className: 'text-indigo-400' }),
                            step.hint
                        ]),
                        // Completed checkmark animation
                        isStepCompleted(currentView, currentStep) && React.createElement('div', {
                            key: 'done',
                            className: 'mt-3 flex items-center gap-2 text-green-600'
                        }, [
                            React.createElement('span', { key: 'icon', className: 'text-xl' }, '🎯'),
                            React.createElement('span', { key: 'text', className: 'text-sm font-medium' }, 'Great job!')
                        ])
                    ]),
                    // Navigation
                    React.createElement('div', {
                        key: 'nav',
                        className: 'flex items-center justify-between'
                    }, [
                        React.createElement('button', {
                            key: 'prev',
                            onClick: goPrev,
                            disabled: currentStep === 0,
                            className: `flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                currentStep === 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`
                        }, [
                            Icon && React.createElement(Icon, { key: 'icon', name: 'ChevronLeft', size: 18 }),
                            'Back'
                        ]),
                        // Skip button (for action steps not yet completed)
                        !isStepCompleted(currentView, currentStep) && step.action !== 'auto' && React.createElement('button', {
                            key: 'skip',
                            onClick: skipStep,
                            className: 'text-xs text-gray-400 hover:text-gray-600 underline'
                        }, 'Skip this step'),
                        React.createElement('button', {
                            key: 'next',
                            onClick: goNext,
                            className: `flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl ${
                                currentStep === totalSteps - 1
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                            }`
                        }, [
                            currentStep === totalSteps - 1 ? 'Next Section' : (step.action === 'auto' ? 'Got it!' : 'Next'),
                            Icon && React.createElement(Icon, { key: 'icon', name: currentStep === totalSteps - 1 ? 'ArrowRight' : 'ChevronRight', size: 18 })
                        ])
                    ])
                ]),
                // Section navigation
                React.createElement('div', {
                    key: 'footer',
                    className: 'px-5 py-4 bg-gray-50 border-t border-gray-100'
                }, [
                    React.createElement('div', {
                        key: 'label',
                        className: 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2'
                    }, [
                        Icon && React.createElement(Icon, { key: 'icon', name: 'Map', size: 12 }),
                        'Tour Sections'
                    ]),
                    React.createElement('div', {
                        key: 'sections',
                        className: 'grid grid-cols-3 gap-2'
                    },
                        Object.entries(guides).map(([key, g]) => {
                            const sectionSteps = g.steps.length;
                            const sectionCompleted = g.steps.filter((_, i) => isStepCompleted(key, i)).length;
                            const isComplete = sectionCompleted === sectionSteps;
                            const isCurrent = key === currentView;

                            return React.createElement('button', {
                                key: key,
                                onClick: () => onNavigate && onNavigate(key),
                                className: `p-2 rounded-xl text-left transition-all ${
                                    isCurrent
                                        ? 'bg-indigo-100 border-2 border-indigo-300'
                                        : isComplete
                                            ? 'bg-green-50 border border-green-200'
                                            : 'bg-white border border-gray-200 hover:border-gray-300'
                                }`
                            }, [
                                React.createElement('div', {
                                    key: 'top',
                                    className: 'flex items-center justify-between mb-1'
                                }, [
                                    React.createElement('span', { key: 'icon', className: 'text-lg' }, g.icon),
                                    isComplete && React.createElement('span', {
                                        key: 'check',
                                        className: 'text-green-500 text-xs'
                                    }, '✓')
                                ]),
                                React.createElement('div', {
                                    key: 'title',
                                    className: `text-[10px] font-bold truncate ${isCurrent ? 'text-indigo-700' : 'text-gray-700'}`
                                }, g.title.split(' ')[0]),
                                React.createElement('div', {
                                    key: 'progress',
                                    className: 'text-[9px] text-gray-400'
                                }, `${sectionCompleted}/${sectionSteps}`)
                            ]);
                        })
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
            keywords: ['insider', 'accident', 'lawyers', 'get', 'true', 'value', '844', 'inside', 'accidentwin']
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
            keywords: ['netflix', 'stranger', 'things', 'season', '5', 'streaming']
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
            keywords: ['nike', 'air', 'max', '2025', 'just', 'do', 'it']
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
            keywords: ['david', 'yurman', 'jewelry', 'collection']
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
            keywords: ['mcdonalds', 'mcrib', 'returns', '2025']
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
        Confetti,
        DemoActions,
        generateMockData,
        getDemoMaterials
    };

})(window);
