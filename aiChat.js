// ═══════════════════════════════════════════════════════════════════════════
// AI CHAT - External Component
// Floating chat widget + full-page AI Assistant for LA STAP Operations Portal
// Uses Groq API (Llama 3.3 70B) — same backend as existing AI Pipeline Insights
// ═══════════════════════════════════════════════════════════════════════════
(function() {
    'use strict';

    const { useState, useRef, useEffect, useMemo } = React;

    // ─── CONSTANTS ───────────────────────────────────────────────────────────
    const SYSTEM_PROMPT = `You are Ops AI, an expert operations analyst for Vector Media, an out-of-home (OOH) transit advertising company based in Los Angeles. You have deep knowledge of campaign management, installation logistics, materials tracking, and transit advertising operations.

Your role:
- Answer questions about pipeline status, campaign progress, risk areas, and operational metrics
- Provide concise, actionable insights with specific numbers when data is available
- Be direct and executive-level in communication style
- Use bullet points for clarity
- Reference specific campaigns/advertisers when discussing data
- Flag risks proactively

When given operational data context, analyze it thoroughly and reference specific numbers. When no data context is provided, give general OOH operations guidance.

Keep responses focused and under 300 words unless the user asks for detailed analysis.`;

    const SUGGESTED_PROMPTS = [
        { label: 'Pipeline status', text: 'What\'s the current pipeline status? How many campaigns are in each stage?' },
        { label: 'Risk check', text: 'Are there any critical risks or stalled campaigns I should know about?' },
        { label: 'Install velocity', text: 'What\'s our current install velocity? Are we on track this week?' },
        { label: 'Material bottlenecks', text: 'Are there any material bottlenecks or campaigns waiting on materials?' },
    ];

    // ─── HELPER: Build context from current app data ─────────────────────────
    const buildDataContext = (getData) => {
        if (!getData) return '';
        try {
            const data = getData();
            if (!data) return '';

            const sections = [];

            // Pipeline summary
            if (data.pipelineSummary?.length > 0) {
                const stageCounts = {};
                data.pipelineSummary.forEach(d => {
                    stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1;
                });
                sections.push(`PIPELINE STAGES: ${Object.entries(stageCounts).map(([s, c]) => `${s}: ${c}`).join(', ')}`);
            }

            // Install metrics
            if (data.all?.length > 0) {
                const total = data.all.length;
                const totalQty = data.all.reduce((s, d) => s + (d.quantity || d.totalQty || 0), 0);
                const totalInstalled = data.all.reduce((s, d) => s + (d.totalInstalled || d.installed || 0), 0);
                const totalPending = data.all.reduce((s, d) => s + (d.pending || 0), 0);
                const rate = totalQty > 0 ? Math.round((totalInstalled / totalQty) * 100) : 0;
                sections.push(`INSTALL METRICS: ${total} campaigns, ${totalQty} total units, ${totalInstalled} installed (${rate}%), ${totalPending} pending`);
            }

            // Delayed
            if (data.delayedFlights?.length > 0) {
                const delayed = data.delayedFlights.slice(0, 5);
                sections.push(`DELAYED CAMPAIGNS (${data.delayedFlights.length} total): ${delayed.map(d => `${d.advertiser} - ${d.name}`).join('; ')}`);
            }

            // Holds
            if (data.holdReport?.length > 0) {
                sections.push(`ON HOLD: ${data.holdReport.length} campaigns (${data.holdReport.reduce((s, d) => s + (d.quantity || d.totalQty || 0), 0)} units)`);
            }

            // Risk items
            if (data.riskItems?.length > 0) {
                const critical = data.riskItems.filter(r => r.riskLevel === 'CRITICAL');
                const stalled = data.riskItems.filter(r => r.riskLevel === 'STALLED');
                sections.push(`RISKS: ${critical.length} critical, ${stalled.length} stalled`);
            }

            // Special media
            if (data.specialMedia?.length > 0) {
                sections.push(`SPECIAL MEDIA: ${data.specialMedia.length} campaigns in progress`);
            }

            // Pending removals
            if (data.pendingRemovals?.length > 0) {
                sections.push(`PENDING REMOVALS: ${data.pendingRemovals.length} campaigns need removal`);
            }

            // Awaiting POP
            if (data.awaitingPop?.length > 0) {
                sections.push(`AWAITING POP: ${data.awaitingPop.length} campaigns need photos`);
            }

            if (sections.length === 0) return '';
            return '\n\n--- CURRENT OPERATIONAL DATA ---\n' + sections.join('\n') + '\n--- END DATA ---';
        } catch (e) {
            console.warn('AI Chat: Could not build data context', e);
            return '';
        }
    };

    // ─── HELPER: Detect topic keywords and inject targeted data ──────────────
    const injectTopicData = (message, getData) => {
        if (!getData) return '';
        try {
            const data = getData();
            if (!data) return '';
            const lower = message.toLowerCase();
            const extras = [];

            if (lower.includes('risk') || lower.includes('critical') || lower.includes('stall')) {
                if (data.riskItems?.length > 0) {
                    extras.push('DETAILED RISKS:\n' + data.riskItems.slice(0, 8).map(r =>
                        `- [${r.riskLevel}] ${r.advertiser} / ${r.name}: ${r.installed || 0}/${r.quantity || r.totalQty || 0} installed, ${r.daysLate || 0} days late`
                    ).join('\n'));
                }
            }

            if (lower.includes('material') || lower.includes('bottleneck')) {
                const awaiting = (data.all || []).filter(d => ['Contracted', 'Proofs Approved'].includes(d.stage));
                if (awaiting.length > 0) {
                    extras.push(`AWAITING MATERIALS (${awaiting.length}): ${awaiting.slice(0, 5).map(d => `${d.advertiser} [${d.stage}]`).join(', ')}`);
                }
            }

            if (lower.includes('pop') || lower.includes('photo') || lower.includes('proof')) {
                if (data.awaitingPop?.length > 0) {
                    extras.push(`AWAITING POP PHOTOS (${data.awaitingPop.length}): ${data.awaitingPop.slice(0, 5).map(d => `${d.advertiser} - ${d.name} (${d.totalInstalled || d.installed || 0} units)`).join('; ')}`);
                }
            }

            if (lower.includes('removal') || lower.includes('takedown')) {
                if (data.pendingRemovals?.length > 0) {
                    extras.push(`PENDING REMOVALS (${data.pendingRemovals.length}): ${data.pendingRemovals.slice(0, 5).map(d => `${d.advertiser} - ends ${d.endDate}`).join('; ')}`);
                }
            }

            if (lower.includes('hold')) {
                if (data.holdReport?.length > 0) {
                    extras.push(`ON HOLD (${data.holdReport.length}): ${data.holdReport.slice(0, 5).map(d => `${d.advertiser} - ${d.name} (${d.quantity || d.totalQty || 0} units)`).join('; ')}`);
                }
            }

            return extras.length > 0 ? '\n\n--- TOPIC-SPECIFIC DATA ---\n' + extras.join('\n\n') + '\n--- END ---' : '';
        } catch (e) {
            return '';
        }
    };

    // ─── HELPER: Simple markdown → HTML ──────────────────────────────────────
    const renderMarkdown = (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Headers
            .replace(/^### (.+)$/gm, '<strong style="font-size:0.95em;display:block;margin-top:8px">$1</strong>')
            .replace(/^## (.+)$/gm, '<strong style="font-size:1.05em;display:block;margin-top:10px">$1</strong>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Inline code
            .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.15);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
            // Bullet points
            .replace(/^- (.+)$/gm, '<span style="display:flex;gap:6px;padding-left:4px"><span>•</span><span>$1</span></span>')
            // Horizontal rules
            .replace(/^---$/gm, '<hr style="border:0;border-top:1px solid rgba(128,128,128,0.3);margin:8px 0">')
            // Line breaks
            .replace(/\n/g, '<br>');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CHAT WIDGET (Floating FAB + Panel)
    // ═══════════════════════════════════════════════════════════════════════════
    const AIChatWidget = ({ getData }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [messages, setMessages] = useState([]);
        const [input, setInput] = useState('');
        const [isThinking, setIsThinking] = useState(false);
        const messagesEndRef = useRef(null);
        const inputRef = useRef(null);

        // Auto-scroll on new messages
        useEffect(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, [messages, isThinking]);

        // Focus input when opened
        useEffect(() => {
            if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
        }, [isOpen]);

        const sendMessage = async (text) => {
            if (!text.trim() || isThinking) return;
            const userMsg = { role: 'user', content: text.trim() };
            const newMessages = [...messages, userMsg];
            setMessages(newMessages);
            setInput('');
            setIsThinking(true);

            const apiKey = localStorage.getItem('stap_groq_api_key') || '';
            if (!apiKey) {
                setMessages([...newMessages, {
                    role: 'assistant',
                    content: '⚠️ No API key configured. Go to **Settings** (triple-click the logo in the sidebar) and add your Groq API key to enable AI features.'
                }]);
                setIsThinking(false);
                return;
            }

            try {
                // Build conversation history for API
                const dataContext = buildDataContext(getData);
                const topicData = injectTopicData(text, getData);
                const enrichedContent = text + dataContext + topicData;

                const apiMessages = [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: enrichedContent }
                ];

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: apiMessages,
                        max_tokens: 1024,
                        temperature: 0.3
                    })
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error?.message || response.statusText);
                }

                const data = await response.json();
                const aiContent = data.choices?.[0]?.message?.content || 'No response generated.';
                setMessages([...newMessages, { role: 'assistant', content: aiContent }]);
            } catch (error) {
                setMessages([...newMessages, {
                    role: 'assistant',
                    content: `❌ Error: ${error.message}. Check your API key and connection.`
                }]);
            } finally {
                setIsThinking(false);
            }
        };

        const newChat = () => {
            setMessages([]);
            setInput('');
            setIsThinking(false);
        };

        // Auto-clear on close so every reopen starts fresh
        const closePanel = () => {
            setIsOpen(false);
            setMessages([]);
            setInput('');
            setIsThinking(false);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
            }
        };

        // ─── FAB Button — Animated 3D Cube (inspired by XPO FleetCube) ─────
        const fab = React.createElement('button', {
            onClick: () => isOpen ? closePanel() : setIsOpen(true),
            className: 'ai-chat-fab',
            title: 'Ops AI Chat',
            'aria-label': 'Open AI Chat'
        },
            React.createElement('div', { className: 'ops-cube-scene' },
                React.createElement('div', { className: 'ops-cube' },
                    // Front face — crosshair
                    React.createElement('div', { className: 'ops-cube-face ops-cube-front' },
                        React.createElement('svg', { viewBox: '0 0 32 32', width: '100%', height: '100%' },
                            React.createElement('line', { x1: 8, y1: 16, x2: 24, y2: 16, className: 'ops-cube-line' }),
                            React.createElement('line', { x1: 16, y1: 8, x2: 16, y2: 24, className: 'ops-cube-line' }),
                            React.createElement('circle', { cx: 16, cy: 16, r: 3, className: 'ops-cube-dot' })
                        )
                    ),
                    // Back face — circle
                    React.createElement('div', { className: 'ops-cube-face ops-cube-back' },
                        React.createElement('svg', { viewBox: '0 0 32 32', width: '100%', height: '100%' },
                            React.createElement('circle', { cx: 16, cy: 16, r: 6, className: 'ops-cube-line', fill: 'none' }),
                            React.createElement('circle', { cx: 16, cy: 16, r: 1.5, className: 'ops-cube-dot' })
                        )
                    ),
                    // Right face — triangle
                    React.createElement('div', { className: 'ops-cube-face ops-cube-right' },
                        React.createElement('svg', { viewBox: '0 0 32 32', width: '100%', height: '100%' },
                            React.createElement('polygon', { points: '16,9 23,20 9,20', className: 'ops-cube-line', fill: 'none' }),
                            React.createElement('circle', { cx: 16, cy: 9, r: 1.5, className: 'ops-cube-dot' }),
                            React.createElement('circle', { cx: 23, cy: 20, r: 1.5, className: 'ops-cube-dot' }),
                            React.createElement('circle', { cx: 9, cy: 20, r: 1.5, className: 'ops-cube-dot' })
                        )
                    ),
                    // Left face — crossed square
                    React.createElement('div', { className: 'ops-cube-face ops-cube-left' },
                        React.createElement('svg', { viewBox: '0 0 32 32', width: '100%', height: '100%' },
                            React.createElement('rect', { x: 10, y: 10, width: 12, height: 12, rx: 1, className: 'ops-cube-line', fill: 'none' }),
                            React.createElement('line', { x1: 10, y1: 10, x2: 22, y2: 22, className: 'ops-cube-line' }),
                            React.createElement('line', { x1: 22, y1: 10, x2: 10, y2: 22, className: 'ops-cube-line' })
                        )
                    ),
                    // Top face — diamond
                    React.createElement('div', { className: 'ops-cube-face ops-cube-top' },
                        React.createElement('svg', { viewBox: '0 0 32 32', width: '100%', height: '100%' },
                            React.createElement('polygon', { points: '16,8 24,16 16,24 8,16', className: 'ops-cube-line', fill: 'none' }),
                            React.createElement('circle', { cx: 16, cy: 16, r: 1.5, className: 'ops-cube-dot' })
                        )
                    ),
                    // Bottom face — X with circle
                    React.createElement('div', { className: 'ops-cube-face ops-cube-bottom' },
                        React.createElement('svg', { viewBox: '0 0 32 32', width: '100%', height: '100%' },
                            React.createElement('line', { x1: 8, y1: 8, x2: 24, y2: 24, className: 'ops-cube-line' }),
                            React.createElement('line', { x1: 24, y1: 8, x2: 8, y2: 24, className: 'ops-cube-line' }),
                            React.createElement('circle', { cx: 16, cy: 16, r: 6, className: 'ops-cube-line', fill: 'none' })
                        )
                    )
                )
            )
        );

        // ─── Chat Panel ─────────────────────────────────────────────────────
        const panel = isOpen ? React.createElement('div', { className: 'ai-chat-panel' },
            // Header
            React.createElement('div', { className: 'ai-chat-header' },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--accent)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                        React.createElement('path', { d: 'M12 8V4H8' }),
                        React.createElement('rect', { x: 2, y: 2, width: 20, height: 20, rx: 5 }),
                        React.createElement('path', { d: 'M2 12h4M18 12h4M12 18v4M12 2v4' }),
                        React.createElement('circle', { cx: 12, cy: 12, r: 2 })
                    ),
                    React.createElement('span', { style: { fontWeight: 600, fontSize: '14px' } }, 'Ops AI')
                ),
                React.createElement('div', { style: { display: 'flex', gap: '4px' } },
                    React.createElement('button', {
                        onClick: newChat,
                        className: 'ai-chat-header-btn',
                        title: 'New Chat'
                    },
                        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                            React.createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
                            React.createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
                        )
                    ),
                    React.createElement('button', {
                        onClick: closePanel,
                        className: 'ai-chat-header-btn',
                        title: 'Close'
                    },
                        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                            React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
                            React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
                        )
                    )
                )
            ),

            // Messages Area
            React.createElement('div', { className: 'ai-chat-messages' },
                messages.length === 0 && !isThinking
                    ? React.createElement('div', { className: 'ai-chat-empty' },
                        React.createElement('svg', { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--text-dim)', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', style: { marginBottom: '12px', opacity: 0.5 } },
                            React.createElement('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
                        ),
                        React.createElement('div', { style: { fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' } }, 'How can I help?'),
                        React.createElement('div', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px' } }, 'Ask about your operations data'),
                        React.createElement('div', { className: 'ai-chat-suggestions' },
                            SUGGESTED_PROMPTS.map((p, i) =>
                                React.createElement('button', {
                                    key: i,
                                    className: 'ai-chat-suggestion',
                                    onClick: () => sendMessage(p.text)
                                }, p.label)
                            )
                        )
                    )
                    : messages.map((msg, i) =>
                        React.createElement('div', {
                            key: i,
                            className: `ai-chat-bubble ${msg.role === 'user' ? 'ai-chat-bubble-user' : 'ai-chat-bubble-ai'}`
                        },
                            msg.role === 'assistant' && React.createElement('div', { className: 'ai-chat-ai-badge' },
                                React.createElement('svg', { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'currentColor' },
                                    React.createElement('path', { d: 'M12 3l1.5 3.7 3.9.6-2.8 2.8.7 3.9-3.3-1.8-3.3 1.8.7-3.9L6.6 7.3l3.9-.6L12 3z' })
                                ),
                                ' AI'
                            ),
                            React.createElement('div', {
                                dangerouslySetInnerHTML: { __html: msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') }
                            })
                        )
                    ),
                isThinking && React.createElement('div', { className: 'ai-chat-bubble ai-chat-bubble-ai' },
                    React.createElement('div', { className: 'ai-chat-thinking' },
                        React.createElement('span', null),
                        React.createElement('span', null),
                        React.createElement('span', null)
                    )
                ),
                React.createElement('div', { ref: messagesEndRef })
            ),

            // Input Bar
            React.createElement('div', { className: 'ai-chat-input-bar' },
                React.createElement('input', {
                    ref: inputRef,
                    type: 'text',
                    value: input,
                    onChange: (e) => setInput(e.target.value),
                    onKeyDown: handleKeyDown,
                    placeholder: 'Ask about operations...',
                    className: 'ai-chat-input',
                    disabled: isThinking
                }),
                React.createElement('button', {
                    onClick: () => sendMessage(input),
                    disabled: !input.trim() || isThinking,
                    className: 'ai-chat-send'
                },
                    React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                        React.createElement('line', { x1: 22, y1: 2, x2: 11, y2: 13 }),
                        React.createElement('polygon', { points: '22 2 15 22 11 13 2 9 22 2' })
                    )
                )
            )
        ) : null;

        return React.createElement('div', { className: 'ai-chat-widget' }, panel, fab);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // FULL-PAGE AI ASSISTANT VIEW
    // ═══════════════════════════════════════════════════════════════════════════
    const AIAssistantPage = ({ getData, onBack }) => {
        const [messages, setMessages] = useState([]);
        const [input, setInput] = useState('');
        const [isThinking, setIsThinking] = useState(false);
        const messagesEndRef = useRef(null);
        const inputRef = useRef(null);

        useEffect(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, [messages, isThinking]);

        useEffect(() => {
            setTimeout(() => inputRef.current?.focus(), 200);
        }, []);

        const sendMessage = async (text) => {
            if (!text.trim() || isThinking) return;
            const userMsg = { role: 'user', content: text.trim() };
            const newMessages = [...messages, userMsg];
            setMessages(newMessages);
            setInput('');
            setIsThinking(true);

            const apiKey = localStorage.getItem('stap_groq_api_key') || '';
            if (!apiKey) {
                setMessages([...newMessages, {
                    role: 'assistant',
                    content: '⚠️ No API key configured. Go to **Settings** (triple-click the logo in the sidebar) and add your Groq API key to enable AI features.'
                }]);
                setIsThinking(false);
                return;
            }

            try {
                const dataContext = buildDataContext(getData);
                const topicData = injectTopicData(text, getData);
                const enrichedContent = text + dataContext + topicData;

                const apiMessages = [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: enrichedContent }
                ];

                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages: apiMessages,
                        max_tokens: 2000,
                        temperature: 0.3
                    })
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error?.message || response.statusText);
                }

                const respData = await response.json();
                const aiContent = respData.choices?.[0]?.message?.content || 'No response generated.';
                setMessages([...newMessages, { role: 'assistant', content: aiContent }]);
            } catch (error) {
                setMessages([...newMessages, {
                    role: 'assistant',
                    content: `❌ Error: ${error.message}. Check your API key and connection.`
                }]);
            } finally {
                setIsThinking(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
            }
        };

        const clearHistory = () => {
            setMessages([]);
            setInput('');
            setIsThinking(false);
        };

        const exportChat = () => {
            if (messages.length === 0) return;
            const text = messages.map(m =>
                `${m.role === 'user' ? 'You' : 'Ops AI'}: ${m.content}`
            ).join('\n\n---\n\n');
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ops-ai-chat-${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        };

        const Icon = window.STAP_Icon || (({ name }) => React.createElement('span', null, '?'));

        return React.createElement('div', { className: 'ai-page' },
            // Header
            React.createElement('div', { className: 'ai-page-header' },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                    React.createElement('button', {
                        onClick: onBack,
                        className: 'text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/50'
                    }, React.createElement(Icon, { name: 'ArrowLeft', size: 20 })),
                    React.createElement('div', null,
                        React.createElement('h1', { className: 'text-lg font-bold text-white flex items-center gap-2' },
                            React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: '#38bdf8', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                                React.createElement('rect', { x: 2, y: 2, width: 20, height: 20, rx: 5 }),
                                React.createElement('circle', { cx: 12, cy: 12, r: 2 }),
                                React.createElement('path', { d: 'M2 12h4M18 12h4M12 2v4M12 18v4' })
                            ),
                            'AI Assistant'
                        ),
                        React.createElement('p', { className: 'text-xs text-slate-500' }, 'Powered by Llama 3.3 70B via Groq')
                    )
                ),
                React.createElement('div', { style: { display: 'flex', gap: '8px' } },
                    React.createElement('button', {
                        onClick: exportChat,
                        className: 'text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors',
                        disabled: messages.length === 0
                    }, 'Export'),
                    React.createElement('button', {
                        onClick: clearHistory,
                        className: 'text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors',
                        disabled: messages.length === 0
                    }, 'Clear')
                )
            ),

            // Messages
            React.createElement('div', { className: 'ai-page-messages' },
                messages.length === 0 && !isThinking
                    ? React.createElement('div', { className: 'ai-page-empty' },
                        React.createElement('svg', { width: 48, height: 48, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--text-dim)', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { marginBottom: '16px', opacity: 0.4 } },
                            React.createElement('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
                        ),
                        React.createElement('h2', { style: { fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' } }, 'How can I help?'),
                        React.createElement('p', { style: { fontSize: '13px', color: 'var(--text-dim)', marginBottom: '24px' } }, 'Ask me anything about your operations data'),
                        React.createElement('div', { className: 'ai-page-suggestions' },
                            SUGGESTED_PROMPTS.map((p, i) =>
                                React.createElement('button', {
                                    key: i,
                                    className: 'ai-page-suggestion',
                                    onClick: () => sendMessage(p.text)
                                },
                                    React.createElement('div', { style: { fontWeight: 600, fontSize: '13px', marginBottom: '2px' } }, p.label),
                                    React.createElement('div', { style: { fontSize: '11px', opacity: 0.6 } }, p.text.slice(0, 50) + (p.text.length > 50 ? '...' : ''))
                                )
                            )
                        )
                    )
                    : React.createElement('div', { className: 'ai-page-messages-inner' },
                        messages.map((msg, i) =>
                            React.createElement('div', {
                                key: i,
                                className: `ai-chat-bubble ${msg.role === 'user' ? 'ai-chat-bubble-user' : 'ai-chat-bubble-ai'} ai-page-bubble`
                            },
                                msg.role === 'assistant' && React.createElement('div', { className: 'ai-chat-ai-badge' },
                                    React.createElement('svg', { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'currentColor' },
                                        React.createElement('path', { d: 'M12 3l1.5 3.7 3.9.6-2.8 2.8.7 3.9-3.3-1.8-3.3 1.8.7-3.9L6.6 7.3l3.9-.6L12 3z' })
                                    ),
                                    ' AI'
                                ),
                                React.createElement('div', {
                                    dangerouslySetInnerHTML: { __html: msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') }
                                })
                            )
                        ),
                        isThinking && React.createElement('div', { className: 'ai-chat-bubble ai-chat-bubble-ai ai-page-bubble' },
                            React.createElement('div', { className: 'ai-chat-thinking' },
                                React.createElement('span', null),
                                React.createElement('span', null),
                                React.createElement('span', null)
                            )
                        ),
                        React.createElement('div', { ref: messagesEndRef })
                    )
            ),

            // Input Bar (full-page version)
            React.createElement('div', { className: 'ai-page-input-bar' },
                React.createElement('div', { className: 'ai-page-input-container' },
                    React.createElement('input', {
                        ref: inputRef,
                        type: 'text',
                        value: input,
                        onChange: (e) => setInput(e.target.value),
                        onKeyDown: handleKeyDown,
                        placeholder: 'Ask about pipeline, risks, installs, materials...',
                        className: 'ai-chat-input ai-page-input',
                        disabled: isThinking
                    }),
                    React.createElement('button', {
                        onClick: () => sendMessage(input),
                        disabled: !input.trim() || isThinking,
                        className: 'ai-chat-send'
                    },
                        React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                            React.createElement('line', { x1: 22, y1: 2, x2: 11, y2: 13 }),
                            React.createElement('polygon', { points: '22 2 15 22 11 13 2 9 22 2' })
                        )
                    )
                )
            )
        );
    };

    // Export to window
    window.STAPAIChat = {
        AIChatWidget,
        AIAssistantPage
    };

    console.log('✅ AIChat loaded from external file');
})();
