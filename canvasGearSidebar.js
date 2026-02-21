// ═══════════════════════════════════════════════════════════════════════════
// CANVAS GEAR SIDEBAR - External Component
// Animated gear navigation system for LA STAP Operations Portal
// ═══════════════════════════════════════════════════════════════════════════
(function() {
    'use strict';

    const { useRef, useEffect, useState } = React;

    // ═══════════════════════════════════════════════════════════════════════════
    // CANVAS GEAR SIDEBAR - Animated navigation with three interlocking gears
    // NOTE: Canvas gears only work for vertical (left/right) positions.
    // For horizontal positions (top/bottom), the parent renders HorizontalMiniBar instead.
    // ═══════════════════════════════════════════════════════════════════════════
    const CanvasGearSidebar = ({ view, setView, onLogout, onOpenDigest, onReset, onResetEmailLogs, onOpenSheetSettings, isCollapsed, setIsCollapsed, position = 'left', onOpenPositionPicker }) => {
        // Early return for horizontal positions - canvas gears require vertical layout
        if (position === 'top' || position === 'bottom') {
            return null;
        }

        const canvasRef = useRef(null);
        const animationRef = useRef(null);
        const stateRef = useRef({
            gearRotation: 0,
            targetGearAngle: 0,
            currentGearAngle: 0,
            // Pipeline gear state
            pipelineGearAngle: 0,
            targetPipelineAngle: 0,
            currentPipelineAngle: 0,
            // History gear state
            historyGearAngle: 0,
            targetHistoryAngle: 0,
            currentHistoryAngle: 0,
            systemReady: true, // Start ready immediately - no loading delay needed
            initTime: 0,
            hoveredNode: null,
            hoveredPipelineNode: null,
            hoveredHistoryNode: null,
            hoveredButton: null,
            hoveredLogo: false, // Track logo hover
            logoClickCount: 0, // Track logo clicks for secret feature
            logoClickTimer: null, // Timer to reset click count
            // Gear hover states (for showing/hiding orbital icons)
            mainGearHovered: false,
            pipelineGearHovered: false,
            historyGearHovered: false,
            // Fade animation values (0-1)
            mainIconsOpacity: 0,
            pipelineIconsOpacity: 0,
            historyIconsOpacity: 0,
            mouse: { x: 0, y: 0, clicked: false },
            lastTime: performance.now(),
            // Date/time updates
            currentTime: new Date(),
            // Live weather data
            weatherTemp: null,
            weatherCondition: null,
            weatherLoaded: false,
        });

        // Titanium Theme
        const T = {
            bgDark: '#020617',
            bgMid: '#0f172a',
            bgLight: '#1e293b',
            metalDim: '#334155',
            metalMid: '#94a3b8',
            metalBright: '#e2e8f0',
            accent: '#38bdf8',
            accentGlow: 'rgba(56, 189, 248, 0.25)',
            accentAlt: '#a78bfa',  // Purple for pipeline
            accentAltGlow: 'rgba(167, 139, 250, 0.25)',
            textMain: '#f1f5f9',
            textSub: '#64748b',
            textDim: '#475569',
        };

        // MAIN GEAR - Navigation nodes (11 items, ~33° apart)
        const navNodes = [
            { id: 'dashboard', label: 'DASHBOARD', angle: -90 },
            { id: 'master', label: 'INSTALLATIONS', angle: -57 },
            { id: 'holdReport', label: 'HOLD REPORT', angle: -24 },
            { id: 'availability', label: 'AVAILABILITY', angle: 9 },
            { id: 'riskAnalysis', label: 'RISK CENTER', angle: 42 },
            { id: 'specialMedia', label: 'SPECIALTY', angle: 75 },
            { id: 'popGallery', label: 'POP GALLERY', angle: 108 },
            { id: 'materialReceivers', label: 'MATERIALS', angle: 141 },
            { id: 'creativeHub', label: 'CREATIVE HUB', angle: 174 },
            { id: 'performanceReport', label: 'PERFORMANCE', angle: 207 },
            { id: 'aiAssistant', label: 'AI ASSISTANT', angle: 240 },
        ];

        // PIPELINE GEAR - Secondary navigation (10 items)
        const pipelineNodes = [
            { id: 'delayedFlights', label: 'DELAYED', angle: -90 },
            { id: 'onHoldCampaigns', label: 'ON HOLD', angle: -54 },
            { id: 'inProgressFlights', label: 'IN-PROGRESS', angle: -18 },
            { id: 'fullyInstalledThisWeek', label: 'INSTALLED', angle: 18 },
            { id: 'rotations', label: 'ROTATIONS', angle: 54 },
            { id: 'thisWeek', label: 'THIS WEEK', angle: 90 },
            { id: 'upcoming', label: 'UPCOMING', angle: 126 },
            { id: 'materialReadyFuture', label: 'MAT READY', angle: 162 },
            { id: 'nextMonth', label: 'NEXT MONTH', angle: 198 },
            { id: 'pipelineSummary', label: 'SUMMARY', angle: 234 },
        ];

        // HISTORY GEAR - Tertiary navigation (7 items, ~51° apart)
        const historyNodes = [
            { id: 'search', label: 'SEARCH', angle: -90 },
            { id: 'pendingRemovals', label: 'REMOVALS', angle: -39 },
            { id: 'activeInstalls', label: 'ACTIVE', angle: 12 },
            { id: 'awaitingPop', label: 'AWAIT POP', angle: 63 },
            { id: 'completedCampaigns', label: 'COMPLETED', angle: 114 },
            { id: 'lostOpportunities', label: 'LOST', angle: 165 },
            { id: 'impressions', label: 'IMPRESS', angle: 216 },
        ];

        const icons = {
            // Main gear icons
            search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',  // Magnifying glass
            dashboard: 'M3 3h7v9H3V3zm11 0h7v5h-7V3zm0 9h7v9h-7v-9zM3 16h7v5H3v-5z',
            holdReport: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 5a2 2 0 012-2h2a2 2 0 012 2 M12 12h4 M12 16h4 M8 12h.01 M8 16h.01',
            availability: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
            riskAnalysis: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01',
            master: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',  // Edit/pencil icon for stage updates
            specialMedia: 'M3 11l18-5v12L3 13v-2z M11.6 16.8a3 3 0 11-5.8-1.6',
            popGallery: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z',
            materialReceivers: 'M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
            creativeHub: 'M12 3l1.5 3.7 3.9.6-2.8 2.8.7 3.9-3.3-1.8-3.3 1.8.7-3.9L6.6 7.3l3.9-.6L12 3z M5 16l.8 1.9 2 .3-1.4 1.4.4 2L5 20.5l-1.8 1.1.4-2-1.4-1.4 2-.3L5 16z M19 16l.8 1.9 2 .3-1.4 1.4.4 2-1.8-1.1-1.8 1.1.4-2-1.4-1.4 2-.3L19 16z',
            performanceReport: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
            aiAssistant: 'M12 8V4H8 M2 14a2 2 0 002 2h12l4 4V4a2 2 0 00-2-2H4a2 2 0 00-2 2z',
            // Pipeline gear icons
            delayedFlights: 'M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z',
            onHoldCampaigns: 'M10 9v6 M14 9v6 M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
            inProgressFlights: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
            fullyInstalledThisWeek: 'M6 9H4.5a2.5 2.5 0 010-5H6 M18 9h1.5a2.5 2.5 0 000-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22 M18 2H6v7a6 6 0 1012 0V2z',
            rotations: 'M17 1l4 4-4 4 M3 11V9a4 4 0 014-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 01-4 4H3',
            thisWeek: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
            upcoming: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
            materialReadyFuture: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
            nextMonth: 'M12 6v6l4 2 M2 12a10 10 0 1020 0 10 10 0 00-20 0z',
            pipelineSummary: 'M18 20V10 M12 20V4 M6 20v-6',
            // History gear icons
            pendingRemovals: 'M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6',
            expiredFlights: 'M9 18h6 M10 22h4 M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z',
            pastDue: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
            recentInstalls: 'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
            activeInstalls: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
            completedCampaigns: 'M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3',
            awaitingPop: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z',
            lostOpportunities: 'M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0 M15 9l-6 6 M9 9l6 6',
            impressions: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10m-3 0a3 3 0 106 0 3 3 0 10-6 0',
        };

        const drawIcon = (ctx, pathData, x, y, size, color) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(size / 24, size / 24);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const path = new Path2D(pathData);
            ctx.stroke(path);
            ctx.restore();
        };

        const drawGear = (ctx, x, y, radius, teeth, rotation) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            ctx.beginPath();
            const toothDepth = radius * 0.12;

            for (let i = 0; i < teeth; i++) {
                const angle = (i / teeth) * Math.PI * 2;
                const nextAngle = ((i + 1) / teeth) * Math.PI * 2;
                const midAngle = (angle + nextAngle) / 2;

                const innerR = radius - toothDepth;
                const outerR = radius;

                const t1 = angle + (nextAngle - angle) * 0.2;
                const t2 = angle + (nextAngle - angle) * 0.4;
                const v1 = angle + (nextAngle - angle) * 0.6;
                const v2 = angle + (nextAngle - angle) * 0.8;

                if (i === 0) {
                    ctx.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
                }

                ctx.quadraticCurveTo(
                    Math.cos(t1) * (outerR + 2), Math.sin(t1) * (outerR + 2),
                    Math.cos(t2) * outerR, Math.sin(t2) * outerR
                );
                ctx.quadraticCurveTo(
                    Math.cos(midAngle) * (innerR - 2), Math.sin(midAngle) * (innerR - 2),
                    Math.cos(v1) * innerR, Math.sin(v1) * innerR
                );
                ctx.quadraticCurveTo(
                    Math.cos(v2) * (innerR - 2), Math.sin(v2) * (innerR - 2),
                    Math.cos(nextAngle) * outerR, Math.sin(nextAngle) * outerR
                );
            }
            ctx.closePath();

            ctx.fillStyle = T.bgMid;
            ctx.fill();
            ctx.strokeStyle = T.metalMid;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner circles
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = T.metalDim;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.restore();
        };

        const drawGearMarker = (ctx, x, y, radius, angle, color = T.accent) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            // Marker positioned OUTSIDE the gear teeth, pointing outward
            const markerY = -radius - 8;  // Outside the gear
            ctx.beginPath();
            ctx.moveTo(-6, markerY);
            ctx.lineTo(6, markerY);
            ctx.lineTo(0, markerY + 15);  // Arrow pointing inward to gear
            ctx.closePath();

            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.restore();
        };

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Fetch live weather data on mount
            const loadWeather = async () => {
                try {
                    const location = (window.STAP_getWeatherLocation && window.STAP_getWeatherLocation()) || 'Los Angeles, CA';
                    if (window.STAP_fetchLiveWeather) {
                        const data = await window.STAP_fetchLiveWeather(location);
                        if (data && data.length > 0) {
                            stateRef.current.weatherTemp = data[0].temp;
                            stateRef.current.weatherCondition = data[0].condition;
                            stateRef.current.weatherLoaded = true;
                        }
                    }
                } catch (e) {
                    console.error('Sidebar weather fetch failed:', e);
                }
            };
            loadWeather();

            const ctx = canvas.getContext('2d');
            const sidebarWidth = 320;

            // MAIN GEAR config (Modules)
            const mainOrbitRadius = 90;
            const mainNodeRadius = 18;
            const mainGearSize = 45;
            const mainGearTeeth = 18;

            // PIPELINE GEAR config (smaller, interlocking)
            const pipelineOrbitRadius = 72;
            const pipelineNodeRadius = 16;
            const pipelineGearSize = 35;
            const pipelineGearTeeth = 14;

            // HISTORY GEAR config (smallest)
            const historyOrbitRadius = 55;
            const historyNodeRadius = 14;
            const historyGearSize = 26;
            const historyGearTeeth = 11;

            const render = () => {
                const now = performance.now();
                const dt = (now - stateRef.current.lastTime) / 1000;
                stateRef.current.lastTime = now;

                // Update state
                stateRef.current.gearRotation += dt;
                stateRef.current.initTime += dt;

                // Update time every second
                stateRef.current.currentTime = new Date();

                if (!stateRef.current.systemReady && stateRef.current.initTime > 1.5) {
                    stateRef.current.systemReady = true;
                }

                // Main gear angle smoothing
                const diff = stateRef.current.targetGearAngle - stateRef.current.currentGearAngle;
                stateRef.current.currentGearAngle += diff * 0.08;

                // Pipeline gear angle smoothing
                const pipelineDiff = stateRef.current.targetPipelineAngle - stateRef.current.currentPipelineAngle;
                stateRef.current.currentPipelineAngle += pipelineDiff * 0.08;

                // History gear angle smoothing
                const historyDiff = stateRef.current.targetHistoryAngle - stateRef.current.currentHistoryAngle;
                stateRef.current.currentHistoryAngle += historyDiff * 0.08;

                // ═══════════════════════════════════════════════════════════════
                // GEAR HOVER DETECTION - Check if mouse is near each gear
                // ═══════════════════════════════════════════════════════════════
                const mouse = stateRef.current.mouse;

                const h = canvas.height;

                // FOOTER FIXED AT BOTTOM - calculate footer height first
                const footerHeight = 178;  // Space for date/time + buttons + position toggle
                const footerStartY = h - footerHeight;

                // THREE GEAR POSITIONS - Vertically stacked with MORE spacing
                const gearAreaTop = 70;
                const gearAreaBottom = footerStartY - 5;
                const gearAreaHeight = gearAreaBottom - gearAreaTop;

                // Distribute gears evenly
                const mainCenterX = sidebarWidth / 2;
                const mainCenterY = gearAreaTop + gearAreaHeight * 0.22;  // MODULES - moved down

                // Pipeline gear - true center
                const meshGap1 = 18;
                const pipelineCenterX = sidebarWidth / 2;
                const pipelineCenterY = gearAreaTop + gearAreaHeight * 0.52;  // PIPELINE - centered

                // History gear - lower, closer to footer
                const meshGap2 = 15;
                const historyCenterX = sidebarWidth / 2;
                const historyCenterY = gearAreaTop + gearAreaHeight * 0.85;  // HISTORY - further down

                // ═══════════════════════════════════════════════════════════════
                // HOVER DETECTION - Check if mouse is over each gear's orbit area
                // Only ONE gear can be active at a time (closest one wins)
                // ═══════════════════════════════════════════════════════════════
                const mainDist = Math.hypot(mouse.x - mainCenterX, mouse.y - mainCenterY);
                const pipelineDist = Math.hypot(mouse.x - pipelineCenterX, mouse.y - pipelineCenterY);
                const historyDist = Math.hypot(mouse.x - historyCenterX, mouse.y - historyCenterY);

                // Determine which gear is closest (exclusive hover)
                const mainInRange = mainDist < mainOrbitRadius + 30;
                const pipelineInRange = pipelineDist < pipelineOrbitRadius + 25;
                const historyInRange = historyDist < historyOrbitRadius + 22;

                // Only one gear can be hovered - priority to closest
                let activeGear = null;
                if (mainInRange && (!pipelineInRange || mainDist < pipelineDist) && (!historyInRange || mainDist < historyDist)) {
                    activeGear = 'main';
                } else if (pipelineInRange && (!historyInRange || pipelineDist < historyDist)) {
                    activeGear = 'pipeline';
                } else if (historyInRange) {
                    activeGear = 'history';
                }

                stateRef.current.mainGearHovered = activeGear === 'main';
                stateRef.current.pipelineGearHovered = activeGear === 'pipeline';
                stateRef.current.historyGearHovered = activeGear === 'history';

                // Animate opacity (FAST fade in/out for snappy response)
                const fadeInSpeed = 0.25;
                const fadeOutSpeed = 0.35;  // Even faster fade out

                stateRef.current.mainIconsOpacity += stateRef.current.mainGearHovered
                    ? fadeInSpeed : -fadeOutSpeed;
                stateRef.current.pipelineIconsOpacity += stateRef.current.pipelineGearHovered
                    ? fadeInSpeed : -fadeOutSpeed;
                stateRef.current.historyIconsOpacity += stateRef.current.historyGearHovered
                    ? fadeInSpeed : -fadeOutSpeed;

                // Clamp opacity values
                stateRef.current.mainIconsOpacity = Math.max(0, Math.min(1, stateRef.current.mainIconsOpacity));
                stateRef.current.pipelineIconsOpacity = Math.max(0, Math.min(1, stateRef.current.pipelineIconsOpacity));
                stateRef.current.historyIconsOpacity = Math.max(0, Math.min(1, stateRef.current.historyIconsOpacity));

                // Clear
                ctx.clearRect(0, 0, sidebarWidth, h);

                // Background gradient
                const bgGrad = ctx.createRadialGradient(mainCenterX, h/2, 0, mainCenterX, h/2, h * 0.7);
                bgGrad.addColorStop(0, T.bgLight);
                bgGrad.addColorStop(1, T.bgDark);
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, sidebarWidth, h);

                // Scan lines
                ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
                for (let i = 0; i < h; i += 3) {
                    ctx.fillRect(0, i, sidebarWidth, 1);
                }

                // Right border
                ctx.strokeStyle = T.metalDim;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sidebarWidth, 0);
                ctx.lineTo(sidebarWidth, h);
                ctx.stroke();

                // Header
                ctx.fillStyle = T.textSub;
                ctx.font = '300 11px Montserrat, Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('LOS ANGELES OPS', mainCenterX, 24);

                ctx.fillStyle = T.textMain;
                ctx.font = '600 18px Montserrat, Inter, sans-serif';
                ctx.fillText('VECTOR', mainCenterX - 48, 48);
                ctx.fillStyle = T.accent;
                ctx.fillText('MEDIA', mainCenterX + 40, 48);

                // ═══════════════════════════════════════════════════════════════
                // MAIN GEAR - MODULES
                // ═══════════════════════════════════════════════════════════════

                // Main orbit ring (only show when hovered)
                const mainOpacity = stateRef.current.mainIconsOpacity;
                if (mainOpacity > 0.01) {
                    ctx.globalAlpha = mainOpacity * 0.5;
                    ctx.strokeStyle = T.metalDim;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 6]);
                    ctx.beginPath();
                    ctx.arc(mainCenterX, mainCenterY, mainOrbitRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Connection lines to main nodes
                    ctx.strokeStyle = T.metalDim;
                    ctx.lineWidth = 0.5;
                    navNodes.forEach(node => {
                        const rad = node.angle * Math.PI / 180;
                        const nx = mainCenterX + Math.cos(rad) * mainOrbitRadius;
                        const ny = mainCenterY + Math.sin(rad) * mainOrbitRadius;
                        ctx.beginPath();
                        ctx.moveTo(mainCenterX, mainCenterY);
                        ctx.lineTo(nx, ny);
                        ctx.stroke();
                    });
                    ctx.globalAlpha = 1;
                }

                // Calculate gear angles - all three mesh together
                let mainGearAngle, pipelineGearAngle, historyGearAngle;
                if (!stateRef.current.systemReady) {
                    mainGearAngle = stateRef.current.gearRotation * 0.12;
                    // Pipeline spins opposite (meshed!)
                    pipelineGearAngle = -stateRef.current.gearRotation * 0.12 * (mainGearTeeth / pipelineGearTeeth);
                    // History spins same as main (meshed with pipeline)
                    historyGearAngle = stateRef.current.gearRotation * 0.12 * (mainGearTeeth / historyGearTeeth);
                } else {
                    mainGearAngle = stateRef.current.currentGearAngle * Math.PI / 180;
                    pipelineGearAngle = stateRef.current.currentPipelineAngle * Math.PI / 180;
                    historyGearAngle = stateRef.current.currentHistoryAngle * Math.PI / 180;
                }

                // Draw MAIN gear
                drawGear(ctx, mainCenterX, mainCenterY, mainGearSize, mainGearTeeth, mainGearAngle);

                // Main gear marker (cyan) - only show when hovering main nodes
                if (stateRef.current.systemReady && stateRef.current.hoveredNode) {
                    drawGearMarker(ctx, mainCenterX, mainCenterY, mainGearSize, mainGearAngle, T.accent);
                }

                // Main central hub (glows when hovered)
                const mainHubHovered = stateRef.current.mainGearHovered;

                if (mainHubHovered) {
                    ctx.shadowColor = T.accent;
                    ctx.shadowBlur = 20;
                }

                ctx.beginPath();
                ctx.arc(mainCenterX, mainCenterY, 34, 0, Math.PI * 2);
                ctx.fillStyle = T.bgDark;
                ctx.globalAlpha = 0.95;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;

                ctx.beginPath();
                ctx.arc(mainCenterX, mainCenterY, 30, 0, Math.PI * 2);
                ctx.strokeStyle = mainHubHovered ? T.accent : T.metalDim;
                ctx.lineWidth = mainHubHovered ? 2 : 1;
                ctx.stroke();

                // Main hub text
                if (stateRef.current.systemReady) {
                    const hovered = stateRef.current.hoveredNode;
                    const displayText = hovered ? hovered.label : 'MODULES';

                    ctx.fillStyle = mainHubHovered ? T.accent : (hovered ? T.textMain : T.textSub);
                    ctx.font = mainHubHovered || hovered ? '600 12px Montserrat, Inter, sans-serif' : '400 11px Montserrat, Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(displayText, mainCenterX, mainCenterY + 4);
                } else {
                    ctx.fillStyle = T.textSub;
                    ctx.font = '300 10px Montserrat, Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('LOADING', mainCenterX, mainCenterY + 4);
                }

                // ═══════════════════════════════════════════════════════════════
                // GEAR MESH CONNECTIONS - Visual links between all three gears
                // ═══════════════════════════════════════════════════════════════

                // Mesh point 1: Main → Pipeline (midpoint between gears)
                const meshPointY1 = (mainCenterY + mainGearSize + pipelineCenterY - pipelineGearSize) / 2;
                ctx.strokeStyle = T.metalDim;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(mainCenterX, mainCenterY + mainGearSize);
                ctx.lineTo(pipelineCenterX, pipelineCenterY - pipelineGearSize);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(mainCenterX, meshPointY1, 4, 0, Math.PI * 2);
                ctx.fillStyle = T.accent;
                ctx.shadowColor = T.accent;
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Mesh point 2: Pipeline → History (midpoint between gears)
                const meshPointY2 = (pipelineCenterY + pipelineGearSize + historyCenterY - historyGearSize) / 2;
                ctx.strokeStyle = T.metalDim;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pipelineCenterX, pipelineCenterY + pipelineGearSize);
                ctx.lineTo(historyCenterX, historyCenterY - historyGearSize);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(pipelineCenterX, meshPointY2, 3, 0, Math.PI * 2);
                ctx.fillStyle = T.accentAlt;
                ctx.shadowColor = T.accentAlt;
                ctx.shadowBlur = 6;
                ctx.fill();
                ctx.shadowBlur = 0;

                // ═══════════════════════════════════════════════════════════════
                // PIPELINE GEAR - SECONDARY (below, interlocking)
                // ═══════════════════════════════════════════════════════════════

                // Pipeline orbit ring (only show when hovered)
                const pipelineOpacity = stateRef.current.pipelineIconsOpacity;
                if (pipelineOpacity > 0.01) {
                    ctx.globalAlpha = pipelineOpacity * 0.5;
                    ctx.strokeStyle = T.metalDim;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([2, 4]);
                    ctx.beginPath();
                    ctx.arc(pipelineCenterX, pipelineCenterY, pipelineOrbitRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Connection lines to pipeline nodes
                    ctx.strokeStyle = T.metalDim;
                    ctx.lineWidth = 0.5;
                    pipelineNodes.forEach(node => {
                        const rad = node.angle * Math.PI / 180;
                        const nx = pipelineCenterX + Math.cos(rad) * pipelineOrbitRadius;
                        const ny = pipelineCenterY + Math.sin(rad) * pipelineOrbitRadius;
                        ctx.beginPath();
                        ctx.moveTo(pipelineCenterX, pipelineCenterY);
                        ctx.lineTo(nx, ny);
                        ctx.stroke();
                    });
                    ctx.globalAlpha = 1;
                }

                // Draw PIPELINE gear (spinning opposite)
                drawGear(ctx, pipelineCenterX, pipelineCenterY, pipelineGearSize, pipelineGearTeeth, pipelineGearAngle);

                // Pipeline gear marker (purple) - only show when hovering pipeline nodes
                if (stateRef.current.systemReady && stateRef.current.hoveredPipelineNode) {
                    drawGearMarker(ctx, pipelineCenterX, pipelineCenterY, pipelineGearSize, pipelineGearAngle, T.accentAlt);
                }

                // Pipeline central hub (glows when hovered)
                const pipelineHubHovered = stateRef.current.pipelineGearHovered;

                if (pipelineHubHovered) {
                    ctx.shadowColor = T.accentAlt;
                    ctx.shadowBlur = 18;
                }

                ctx.beginPath();
                ctx.arc(pipelineCenterX, pipelineCenterY, 25, 0, Math.PI * 2);
                ctx.fillStyle = T.bgDark;
                ctx.globalAlpha = 0.95;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;

                ctx.beginPath();
                ctx.arc(pipelineCenterX, pipelineCenterY, 22, 0, Math.PI * 2);
                ctx.strokeStyle = pipelineHubHovered ? T.accentAlt : T.metalDim;
                ctx.lineWidth = pipelineHubHovered ? 2 : 1;
                ctx.stroke();

                // Pipeline hub text
                if (stateRef.current.systemReady) {
                    const hovered = stateRef.current.hoveredPipelineNode;
                    const displayText = hovered ? hovered.label : 'PIPELINE';

                    ctx.fillStyle = pipelineHubHovered ? T.accentAlt : (hovered ? T.accentAlt : T.textSub);
                    ctx.font = pipelineHubHovered || hovered ? '600 10px Montserrat, Inter, sans-serif' : '400 10px Montserrat, Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(displayText, pipelineCenterX, pipelineCenterY + 4);
                }

                // ═══════════════════════════════════════════════════════════════
                // MAIN NAVIGATION NODES (only visible when gear is hovered)
                // ═══════════════════════════════════════════════════════════════
                stateRef.current.hoveredNode = null;

                if (mainOpacity > 0.01) {
                    navNodes.forEach(node => {
                        const rad = node.angle * Math.PI / 180;
                        const nx = mainCenterX + Math.cos(rad) * mainOrbitRadius;
                        const ny = mainCenterY + Math.sin(rad) * mainOrbitRadius;

                        const dist = Math.hypot(mouse.x - nx, mouse.y - ny);
                        const isHovered = dist < (mainNodeRadius + 5) && stateRef.current.systemReady && mainOpacity > 0.5;
                        const isActive = view === node.id;

                        if (isHovered) {
                            stateRef.current.hoveredNode = node;
                            stateRef.current.targetGearAngle = node.angle + 90;
                        }

                        ctx.globalAlpha = mainOpacity;
                        ctx.beginPath();
                        ctx.arc(nx, ny, mainNodeRadius, 0, Math.PI * 2);

                        if (isActive) {
                            ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
                            ctx.shadowColor = T.accent;
                            ctx.shadowBlur = 15;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                            ctx.strokeStyle = T.accent;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        } else if (isHovered) {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                            ctx.shadowColor = T.accentGlow;
                            ctx.shadowBlur = 10;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                            ctx.strokeStyle = T.metalMid;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }

                        const iconColor = isActive ? T.accent : (isHovered ? T.accent : T.metalMid);
                        const iconSize = 17;
                        drawIcon(ctx, icons[node.id], nx - iconSize/2, ny - iconSize/2, iconSize, iconColor);

                        ctx.globalAlpha = 1;
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // PIPELINE NAVIGATION NODES (only visible when gear is hovered)
                // ═══════════════════════════════════════════════════════════════
                stateRef.current.hoveredPipelineNode = null;

                if (pipelineOpacity > 0.01) {
                    pipelineNodes.forEach(node => {
                        const rad = node.angle * Math.PI / 180;
                        const nx = pipelineCenterX + Math.cos(rad) * pipelineOrbitRadius;
                        const ny = pipelineCenterY + Math.sin(rad) * pipelineOrbitRadius;

                        const dist = Math.hypot(mouse.x - nx, mouse.y - ny);
                        const isHovered = dist < (pipelineNodeRadius + 5) && stateRef.current.systemReady && pipelineOpacity > 0.5;
                        const isActive = view === node.id;

                        if (isHovered) {
                            stateRef.current.hoveredPipelineNode = node;
                            stateRef.current.targetPipelineAngle = node.angle + 90;
                        }

                        ctx.globalAlpha = pipelineOpacity;
                        ctx.beginPath();
                        ctx.arc(nx, ny, pipelineNodeRadius, 0, Math.PI * 2);

                        if (isActive) {
                            ctx.fillStyle = 'rgba(167, 139, 250, 0.15)';  // Purple for pipeline
                            ctx.shadowColor = T.accentAlt;
                            ctx.shadowBlur = 15;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                            ctx.strokeStyle = T.accentAlt;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        } else if (isHovered) {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                            ctx.shadowColor = T.accentAltGlow;
                            ctx.shadowBlur = 10;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                            ctx.strokeStyle = T.metalMid;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }

                        const iconColor = isActive ? T.accentAlt : (isHovered ? T.accentAlt : T.metalMid);
                        const iconSize = 15;
                        drawIcon(ctx, icons[node.id], nx - iconSize/2, ny - iconSize/2, iconSize, iconColor);

                        ctx.globalAlpha = 1;
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // HISTORY GEAR - TERTIARY (smallest, bottom)
                // ═══════════════════════════════════════════════════════════════

                // History orbit ring (only show when hovered)
                const historyOpacity = stateRef.current.historyIconsOpacity;
                if (historyOpacity > 0.01) {
                    ctx.globalAlpha = historyOpacity * 0.5;
                    ctx.strokeStyle = T.metalDim;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([2, 3]);
                    ctx.beginPath();
                    ctx.arc(historyCenterX, historyCenterY, historyOrbitRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Connection lines to history nodes
                    ctx.strokeStyle = T.metalDim;
                    ctx.lineWidth = 0.5;
                    historyNodes.forEach(node => {
                        const rad = node.angle * Math.PI / 180;
                        const nx = historyCenterX + Math.cos(rad) * historyOrbitRadius;
                        const ny = historyCenterY + Math.sin(rad) * historyOrbitRadius;
                        ctx.beginPath();
                        ctx.moveTo(historyCenterX, historyCenterY);
                        ctx.lineTo(nx, ny);
                        ctx.stroke();
                    });
                    ctx.globalAlpha = 1;
                }

                // Draw HISTORY gear
                drawGear(ctx, historyCenterX, historyCenterY, historyGearSize, historyGearTeeth, historyGearAngle);

                // History gear marker (amber/orange)
                const historyAccent = '#f59e0b';
                if (stateRef.current.systemReady && stateRef.current.hoveredHistoryNode) {
                    drawGearMarker(ctx, historyCenterX, historyCenterY, historyGearSize, historyGearAngle, historyAccent);
                }

                // History central hub (glows when hovered)
                const historyHubHovered = stateRef.current.historyGearHovered;

                if (historyHubHovered) {
                    ctx.shadowColor = historyAccent;
                    ctx.shadowBlur = 15;
                }

                ctx.beginPath();
                ctx.arc(historyCenterX, historyCenterY, 20, 0, Math.PI * 2);
                ctx.fillStyle = T.bgDark;
                ctx.globalAlpha = 0.95;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;

                ctx.beginPath();
                ctx.arc(historyCenterX, historyCenterY, 17, 0, Math.PI * 2);
                ctx.strokeStyle = historyHubHovered ? historyAccent : T.metalDim;
                ctx.lineWidth = historyHubHovered ? 2 : 1;
                ctx.stroke();

                // History hub text
                if (stateRef.current.systemReady) {
                    const hovered = stateRef.current.hoveredHistoryNode;
                    const displayText = hovered ? hovered.label : 'HISTORY';

                    ctx.fillStyle = historyHubHovered ? historyAccent : (hovered ? historyAccent : T.textSub);
                    ctx.font = historyHubHovered || hovered ? '600 9px Montserrat, Inter, sans-serif' : '400 9px Montserrat, Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(displayText, historyCenterX, historyCenterY + 3);
                }

                // ═══════════════════════════════════════════════════════════════
                // HISTORY NAVIGATION NODES (only visible when gear is hovered)
                // ═══════════════════════════════════════════════════════════════
                stateRef.current.hoveredHistoryNode = null;

                if (historyOpacity > 0.01) {
                    historyNodes.forEach(node => {
                        const rad = node.angle * Math.PI / 180;
                        const nx = historyCenterX + Math.cos(rad) * historyOrbitRadius;
                        const ny = historyCenterY + Math.sin(rad) * historyOrbitRadius;

                        const dist = Math.hypot(mouse.x - nx, mouse.y - ny);
                        const isHovered = dist < (historyNodeRadius + 4) && stateRef.current.systemReady && historyOpacity > 0.5;
                        const isActive = view === node.id;

                        if (isHovered) {
                            stateRef.current.hoveredHistoryNode = node;
                            stateRef.current.targetHistoryAngle = node.angle + 90;
                        }

                        ctx.globalAlpha = historyOpacity;
                        ctx.beginPath();
                        ctx.arc(nx, ny, historyNodeRadius, 0, Math.PI * 2);

                        if (isActive) {
                            ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';  // Amber for history
                            ctx.shadowColor = historyAccent;
                            ctx.shadowBlur = 12;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                            ctx.strokeStyle = historyAccent;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        } else if (isHovered) {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                            ctx.shadowColor = 'rgba(245, 158, 11, 0.25)';
                            ctx.shadowBlur = 8;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                            ctx.strokeStyle = T.metalMid;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }

                        const iconColor = isActive ? historyAccent : (isHovered ? historyAccent : T.metalMid);
                        const iconSize = 13;
                        drawIcon(ctx, icons[node.id], nx - iconSize/2, ny - iconSize/2, iconSize, iconColor);

                        ctx.globalAlpha = 1;
                    });
                }

                // ═══════════════════════════════════════════════════════════════
                // FOOTER - Fixed at bottom of sidebar
                // ═══════════════════════════════════════════════════════════════

                // Date/Time Display
                const currentTime = stateRef.current.currentTime;
                const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                ctx.fillStyle = T.textMain;
                ctx.font = '600 14px Montserrat, Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(timeStr, sidebarWidth / 2, footerStartY);

                ctx.fillStyle = T.textSub;
                ctx.font = '300 10px Montserrat, Inter, sans-serif';
                // Get temperature unit and location from settings
                const tempUnit = (window.STAP_getTempUnit && window.STAP_getTempUnit()) || 'F';
                const location = (window.STAP_getWeatherLocation && window.STAP_getWeatherLocation()) || 'Los Angeles, CA';
                const cityName = location.split(',')[0];
                // Use live weather if loaded, otherwise show loading indicator
                let temp = '--°F';
                if (stateRef.current.weatherLoaded && stateRef.current.weatherTemp !== null) {
                    const tempValue = tempUnit === 'C'
                        ? Math.round((stateRef.current.weatherTemp - 32) * 5/9)
                        : stateRef.current.weatherTemp;
                    temp = tempValue + '°' + tempUnit;
                }
                ctx.fillText(dateStr + '  •  ' + cityName + '  •  ' + temp, sidebarWidth / 2, footerStartY + 16);

                // Daily Digest Button
                const digestY = footerStartY + 35;
                const digestHovered = mouse.x >= 30 && mouse.x <= sidebarWidth - 30 &&
                                     mouse.y >= digestY && mouse.y <= digestY + 32;

                // Blue gradient background
                const digestGrad = ctx.createLinearGradient(30, digestY, sidebarWidth - 30, digestY);
                digestGrad.addColorStop(0, digestHovered ? '#2563eb' : '#1d4ed8');
                digestGrad.addColorStop(1, digestHovered ? '#3b82f6' : '#2563eb');

                ctx.fillStyle = digestGrad;
                ctx.beginPath();
                ctx.roundRect(30, digestY, sidebarWidth - 60, 32, 8);
                ctx.fill();

                if (digestHovered) {
                    ctx.shadowColor = '#3b82f6';
                    ctx.shadowBlur = 15;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // Mail icon
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(sidebarWidth/2 - 50, digestY + 9, 14, 10, 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(sidebarWidth/2 - 50, digestY + 11);
                ctx.lineTo(sidebarWidth/2 - 43, digestY + 16);
                ctx.lineTo(sidebarWidth/2 - 36, digestY + 11);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = '600 11px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('Daily Digest', sidebarWidth/2 - 28, digestY + 20);

                // Action Buttons Row
                const btnY = digestY + 45;
                const btnWidth = (sidebarWidth - 80) / 2;

                // Reset Data button
                const resetHovered = mouse.x >= 30 && mouse.x <= 30 + btnWidth &&
                                    mouse.y >= btnY && mouse.y <= btnY + 28;

                ctx.strokeStyle = resetHovered ? T.accent : T.metalDim;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(30, btnY, btnWidth, 28, 4);
                ctx.stroke();
                if (resetHovered) {
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
                    ctx.fill();
                }

                ctx.fillStyle = resetHovered ? T.accent : T.textSub;
                ctx.font = '500 9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Reset Data', 30 + btnWidth/2, btnY + 18);

                // Clear Logs button
                const clearHovered = mouse.x >= 40 + btnWidth && mouse.x <= sidebarWidth - 30 &&
                                    mouse.y >= btnY && mouse.y <= btnY + 28;

                ctx.strokeStyle = clearHovered ? '#ef4444' : T.metalDim;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(40 + btnWidth, btnY, btnWidth, 28, 4);
                ctx.stroke();
                if (clearHovered) {
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
                    ctx.fill();
                }

                ctx.fillStyle = clearHovered ? '#ef4444' : T.textSub;
                ctx.font = '500 9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Clear Logs', 40 + btnWidth + btnWidth/2, btnY + 18);

                // Position Toggle — cycles through left → right → top → bottom (like macOS Dock)
                const posY = btnY + 34;
                const positionCycle = { left: 'right', right: 'top', top: 'bottom', bottom: 'left' };
                const nextPos = positionCycle[position] || 'right';
                const posLabel = `Move to ${nextPos.charAt(0).toUpperCase() + nextPos.slice(1)} →`;
                const posHovered = mouse.x >= 30 && mouse.x <= sidebarWidth - 30 &&
                                   mouse.y >= posY && mouse.y <= posY + 24;

                ctx.strokeStyle = posHovered ? '#a78bfa' : T.metalDim;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.roundRect(30, posY, sidebarWidth - 60, 24, 4);
                ctx.stroke();
                ctx.setLineDash([]);
                if (posHovered) {
                    ctx.fillStyle = 'rgba(167, 139, 250, 0.1)';
                    ctx.fill();
                }

                ctx.fillStyle = posHovered ? '#a78bfa' : T.textDim;
                ctx.font = '500 9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(posLabel, sidebarWidth / 2, posY + 16);

                // Logout Button
                const logoutY = posY + 32;
                const logoutHovered = mouse.x >= 30 && mouse.x <= sidebarWidth - 30 &&
                                     mouse.y >= logoutY && mouse.y <= logoutY + 32;

                ctx.fillStyle = logoutHovered ? '#1e293b' : '#0f172a';
                ctx.beginPath();
                ctx.roundRect(30, logoutY, sidebarWidth - 60, 32, 6);
                ctx.fill();
                ctx.strokeStyle = logoutHovered ? T.accent : T.metalDim;
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = logoutHovered ? T.accent : T.textSub;
                ctx.font = '600 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('LOGOUT', sidebarWidth / 2, logoutY + 20);

                // Logo hover detection (the VECTOR MEDIA text area: roughly y=10 to y=60, centered)
                const logoHovered = mouse.x > mainCenterX - 80 && mouse.x < mainCenterX + 80 && mouse.y > 10 && mouse.y < 60;
                stateRef.current.hoveredLogo = logoHovered;

                // Store button hover states
                stateRef.current.hoveredButton = null;
                if (digestHovered) stateRef.current.hoveredButton = 'digest';
                if (resetHovered) stateRef.current.hoveredButton = 'reset';
                if (clearHovered) stateRef.current.hoveredButton = 'clear';
                if (posHovered) stateRef.current.hoveredButton = 'position';
                if (logoutHovered) stateRef.current.hoveredButton = 'logout';

                // Handle click
                if (stateRef.current.mouse.clicked) {
                    // Secret logo click handler - 3 clicks to open hidden features
                    if (stateRef.current.hoveredLogo) {
                        stateRef.current.logoClickCount++;

                        // Clear existing timer
                        if (stateRef.current.logoClickTimer) {
                            clearTimeout(stateRef.current.logoClickTimer);
                        }

                        // Reset click count after 2 seconds of no clicks
                        stateRef.current.logoClickTimer = setTimeout(() => {
                            stateRef.current.logoClickCount = 0;
                        }, 2000);

                        // Trigger on 3rd click - go to Update Stages (hidden admin feature)
                        if (stateRef.current.logoClickCount >= 3) {
                            stateRef.current.logoClickCount = 0;
                            // Navigate to Update Stages view
                            setView('master');
                        }
                    }

                    if (stateRef.current.hoveredNode && stateRef.current.systemReady) {
                        setView(stateRef.current.hoveredNode.id);
                    }
                    if (stateRef.current.hoveredPipelineNode && stateRef.current.systemReady) {
                        setView(stateRef.current.hoveredPipelineNode.id);
                    }
                    if (stateRef.current.hoveredHistoryNode && stateRef.current.systemReady) {
                        // All history nodes navigate to their view (including impressions)
                        setView(stateRef.current.hoveredHistoryNode.id);
                    }
                    // Button click handlers
                    if (stateRef.current.hoveredButton === 'digest' && onOpenDigest) {
                        onOpenDigest();
                    }
                    if (stateRef.current.hoveredButton === 'reset' && onReset) {
                        onReset();
                    }
                    if (stateRef.current.hoveredButton === 'clear' && onResetEmailLogs) {
                        onResetEmailLogs();
                    }
                    if (stateRef.current.hoveredButton === 'position' && onOpenPositionPicker) {
                        onOpenPositionPicker();
                    }
                    if (stateRef.current.hoveredButton === 'logout' && onLogout) {
                        onLogout();
                    }
                    stateRef.current.mouse.clicked = false;
                }

                animationRef.current = requestAnimationFrame(render);
            };

            // Resize handler
            const resize = () => {
                canvas.width = 320;
                canvas.height = window.innerHeight;
            };

            // Mouse handlers
            const handleMouseMove = (e) => {
                const rect = canvas.getBoundingClientRect();
                stateRef.current.mouse.x = e.clientX - rect.left;
                stateRef.current.mouse.y = e.clientY - rect.top;
            };

            const handleClick = () => {
                stateRef.current.mouse.clicked = true;
            };

            resize();
            window.addEventListener('resize', resize);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('click', handleClick);

            animationRef.current = requestAnimationFrame(render);

            return () => {
                window.removeEventListener('resize', resize);
                canvas.removeEventListener('mousemove', handleMouseMove);
                canvas.removeEventListener('click', handleClick);
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
            };
        }, [view, setView, onLogout, onOpenDigest, onReset, onResetEmailLogs, onOpenSheetSettings, position, onOpenPositionPicker]);

        return (
            <canvas
                ref={canvasRef}
                className={`fixed ${position === 'right' ? 'right-0' : 'left-0'} top-0 z-20 hidden md:block`}
                style={{ width: 320, cursor: 'pointer' }}
            />
        );
    };

    // Export to window
    window.STAPCanvasGearSidebar = {
        CanvasGearSidebar
    };

    console.log('✅ CanvasGearSidebar loaded from external file');
})();
