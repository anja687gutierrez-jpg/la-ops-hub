// ═══════════════════════════════════════════════════════════════════════════════
// CREATIVE HUB — Proof & Material Gallery with PDF OCR
// Searchable gallery of proofs + materials. Uploads PDFs, renders thumbnails
// via PDF.js, extracts metadata via Tesseract.js OCR + regex parsing.
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;
    const e = React.createElement;

    const Icon = window.STAP_Icon || (({ name, size = 20, className = "" }) =>
        e('span', { className }, `[${name}]`)
    );

    // ─── OCR Helper ──────────────────────────────────────────────────────────
    const extractMetadataFromText = (text) => {
        const meta = {};
        // Job number patterns: JOB#123, JN-456, Job Number: 789
        const jobMatch = text.match(/(?:job\s*#?|jn[-\s]?|job\s+number[:\s]*)\s*([A-Z0-9-]+)/i);
        if (jobMatch) meta.jobNumber = jobMatch[1].trim();

        // Quantity patterns: Qty: 50, Quantity: 100, x50, 50 units
        const qtyMatch = text.match(/(?:qty[:\s]*|quantity[:\s]*|x)(\d+)/i) ||
                         text.match(/(\d+)\s*(?:units?|faces?|panels?|sheets?)/i);
        if (qtyMatch) meta.quantity = parseInt(qtyMatch[1], 10);

        // Material/size patterns: 46x60, 21x72, Digital, Vinyl
        const sizeMatch = text.match(/(\d{2,3})\s*[xX×]\s*(\d{2,3})/);
        if (sizeMatch) meta.size = `${sizeMatch[1]}x${sizeMatch[2]}`;

        const materialMatch = text.match(/(?:material[:\s]*|substrate[:\s]*)([A-Za-z\s]+)/i);
        if (materialMatch) meta.material = materialMatch[1].trim().substring(0, 40);

        // Client name (usually prominent text near top)
        const clientMatch = text.match(/(?:client[:\s]*|advertiser[:\s]*|brand[:\s]*)([A-Za-z\s&'.,-]+)/i);
        if (clientMatch) meta.client = clientMatch[1].trim().substring(0, 60);

        return meta;
    };

    // ─── PDF Thumbnail Generator ─────────────────────────────────────────────
    const generateThumbnail = async (file) => {
        if (!window.pdfjsLib) return null;
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            return canvas.toDataURL('image/jpeg', 0.7);
        } catch (err) {
            console.warn('PDF thumbnail generation failed:', err);
            return null;
        }
    };

    // ─── OCR Processing ──────────────────────────────────────────────────────
    const runOCR = async (file) => {
        if (!window.Tesseract) return {};
        try {
            // Convert first page to image for OCR
            const thumbnail = await generateThumbnail(file);
            if (!thumbnail) return {};
            const { data: { text } } = await Tesseract.recognize(thumbnail, 'eng', {
                logger: () => {} // Suppress progress logs
            });
            return extractMetadataFromText(text);
        } catch (err) {
            console.warn('OCR failed:', err);
            return {};
        }
    };

    // ─── Proof Card Component ────────────────────────────────────────────────
    const ProofCard = ({ proof, viewMode, onDelete }) => {
        if (viewMode === 'list') {
            return e('div', {
                className: 'flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow'
            },
                proof.thumbnail
                    ? e('img', { src: proof.thumbnail, className: 'w-12 h-12 object-cover rounded', alt: proof.fileName })
                    : e('div', { className: 'w-12 h-12 bg-gray-100 rounded flex items-center justify-center' },
                        e(Icon, { name: 'FileText', size: 20, className: 'text-gray-400' })),
                e('div', { className: 'flex-1 min-w-0' },
                    e('div', { className: 'font-medium text-sm text-gray-900 truncate' }, proof.fileName),
                    e('div', { className: 'flex items-center gap-2 text-[10px] text-gray-500' },
                        proof.client && e('span', { className: 'px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded' }, proof.client),
                        proof.jobNumber && e('span', { className: 'font-mono' }, `#${proof.jobNumber}`),
                        proof.size && e('span', null, proof.size),
                        proof.quantity && e('span', null, `Qty: ${proof.quantity}`)
                    )
                ),
                e('div', { className: 'flex items-center gap-2 text-[10px] text-gray-400' },
                    e('span', null, new Date(proof.uploadDate).toLocaleDateString()),
                    onDelete && e('button', {
                        onClick: (ev) => { ev.stopPropagation(); onDelete(proof.id); },
                        className: 'p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors',
                        title: 'Delete'
                    }, e(Icon, { name: 'Trash2', size: 12 }))
                )
            );
        }

        // Card view
        return e('div', {
            className: 'bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group'
        },
            e('div', { className: 'relative aspect-[4/3] bg-gray-50' },
                proof.thumbnail
                    ? e('img', { src: proof.thumbnail, className: 'w-full h-full object-cover', alt: proof.fileName })
                    : e('div', { className: 'w-full h-full flex items-center justify-center' },
                        e(Icon, { name: 'FileText', size: 40, className: 'text-gray-300' })),
                proof.source === 'ocr' && e('span', {
                    className: 'absolute top-2 right-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] rounded-full font-medium'
                }, 'OCR'),
                onDelete && e('button', {
                    onClick: (ev) => { ev.stopPropagation(); onDelete(proof.id); },
                    className: 'absolute top-2 left-2 p-1 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50',
                    title: 'Delete'
                }, e(Icon, { name: 'Trash2', size: 12, className: 'text-red-500' }))
            ),
            e('div', { className: 'p-3' },
                e('div', { className: 'font-medium text-sm text-gray-900 truncate mb-1' }, proof.fileName),
                e('div', { className: 'flex flex-wrap gap-1' },
                    proof.client && e('span', { className: 'px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]' }, proof.client),
                    proof.jobNumber && e('span', { className: 'px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono' }, `#${proof.jobNumber}`),
                    proof.size && e('span', { className: 'px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px]' }, proof.size),
                    proof.quantity && e('span', { className: 'px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px]' }, `Qty: ${proof.quantity}`)
                ),
                e('div', { className: 'text-[10px] text-gray-400 mt-2' },
                    new Date(proof.uploadDate).toLocaleDateString()
                )
            )
        );
    };

    // ─── Main Creative Hub Component ─────────────────────────────────────────
    const CreativeHub = ({ proofData = [], onUpdateProofs, onBack }) => {

        const [search, setSearch] = useState('');
        const [clientFilter, setClientFilter] = useState('');
        const [viewMode, setViewMode] = useState('cards'); // cards | list
        const [isUploading, setIsUploading] = useState(false);
        const [uploadProgress, setUploadProgress] = useState('');
        const fileInputRef = useRef(null);

        // Unique clients for filter
        const clients = useMemo(() => {
            const set = new Set();
            proofData.forEach(p => { if (p.client) set.add(p.client); });
            return Array.from(set).sort();
        }, [proofData]);

        // Filtered data
        const filtered = useMemo(() => {
            let data = proofData;
            if (clientFilter) {
                data = data.filter(p => p.client === clientFilter);
            }
            if (search) {
                const q = search.toLowerCase();
                data = data.filter(p =>
                    (p.fileName || '').toLowerCase().includes(q) ||
                    (p.client || '').toLowerCase().includes(q) ||
                    (p.jobNumber || '').toLowerCase().includes(q) ||
                    (p.campaignId || '').toLowerCase().includes(q) ||
                    (p.material || '').toLowerCase().includes(q)
                );
            }
            return data;
        }, [proofData, search, clientFilter]);

        // Handle file upload
        const handleUpload = useCallback(async (event) => {
            const files = Array.from(event.target.files || []);
            if (files.length === 0) return;

            setIsUploading(true);
            const newProofs = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress(`Processing ${i + 1}/${files.length}: ${file.name}`);

                const proof = {
                    id: `proof_${Date.now()}_${i}`,
                    fileName: file.name,
                    uploadDate: new Date().toISOString(),
                    source: 'manual'
                };

                if (file.type === 'application/pdf') {
                    // Generate thumbnail from PDF
                    const thumb = await generateThumbnail(file);
                    if (thumb) proof.thumbnail = thumb;

                    // Run OCR
                    setUploadProgress(`OCR scanning ${i + 1}/${files.length}: ${file.name}`);
                    const meta = await runOCR(file);
                    if (Object.keys(meta).length > 0) {
                        Object.assign(proof, meta);
                        proof.source = 'ocr';
                    }
                } else if (file.type.startsWith('image/')) {
                    // Image file — use as thumbnail directly
                    proof.thumbnail = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(file);
                    });
                }

                newProofs.push(proof);
            }

            if (onUpdateProofs && newProofs.length > 0) {
                onUpdateProofs(prev => [...prev, ...newProofs]);
            }

            setIsUploading(false);
            setUploadProgress('');
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }, [onUpdateProofs]);

        const handleDelete = useCallback((id) => {
            if (onUpdateProofs) {
                onUpdateProofs(prev => prev.filter(p => p.id !== id));
            }
        }, [onUpdateProofs]);

        // ─── Render ──────────────────────────────────────────────────────────
        return e('div', { className: 'space-y-4' },

            // Header
            e('div', { className: 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden' },
                e('div', { className: 'px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3' },
                    e('div', { className: 'flex items-center gap-3' },
                        onBack && e('button', {
                            onClick: onBack,
                            className: 'p-1 hover:bg-gray-200 rounded-full transition-colors',
                            title: 'Back to Dashboard'
                        }, e(Icon, { name: 'ArrowLeft', size: 18 })),
                        e(Icon, { name: 'Sparkles', size: 22, className: 'text-purple-600' }),
                        e('h2', { className: 'text-lg font-bold text-gray-900' }, 'Creative Hub'),
                        e('span', { className: 'bg-purple-100 text-purple-700 text-xs py-0.5 px-2 rounded-full' },
                            `${proofData.length} proof${proofData.length !== 1 ? 's' : ''}`)
                    ),
                    e('div', { className: 'flex items-center gap-2' },
                        // View toggle
                        e('button', {
                            onClick: () => setViewMode(viewMode === 'cards' ? 'list' : 'cards'),
                            className: `flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                                viewMode === 'cards' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`
                        },
                            e(Icon, { name: viewMode === 'cards' ? 'LayoutGrid' : 'List', size: 12 }),
                            viewMode === 'cards' ? 'Cards' : 'List'
                        ),
                        // Upload button
                        e('label', {
                            className: `flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                isUploading
                                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                                    : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`
                        },
                            e(Icon, { name: isUploading ? 'Loader2' : 'Upload', size: 12 }),
                            isUploading ? 'Processing...' : 'Upload PDFs',
                            e('input', {
                                ref: fileInputRef,
                                type: 'file',
                                accept: '.pdf,image/*',
                                multiple: true,
                                onChange: handleUpload,
                                disabled: isUploading,
                                className: 'hidden'
                            })
                        )
                    )
                ),

                // Search & Filter Bar
                e('div', { className: 'px-6 py-3 bg-gray-50 flex flex-wrap items-center gap-3' },
                    e('div', { className: 'relative flex-1 min-w-[200px]' },
                        e('input', {
                            type: 'text',
                            placeholder: 'Search proofs, clients, job numbers...',
                            value: search,
                            onChange: (ev) => setSearch(ev.target.value),
                            className: 'w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400'
                        }),
                        e('div', { className: 'absolute left-2.5 top-1/2 -translate-y-1/2' },
                            e(Icon, { name: 'Search', size: 14, className: 'text-gray-400' }))
                    ),
                    clients.length > 0 && e('select', {
                        value: clientFilter,
                        onChange: (ev) => setClientFilter(ev.target.value),
                        className: 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300'
                    },
                        e('option', { value: '' }, 'All Clients'),
                        clients.map(c => e('option', { key: c, value: c }, c))
                    ),
                    e('span', { className: 'text-xs text-gray-500' },
                        `Showing ${filtered.length} of ${proofData.length}`)
                )
            ),

            // Upload progress
            uploadProgress && e('div', { className: 'bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700 flex items-center gap-2' },
                e('div', { className: 'animate-spin rounded-full h-4 w-4 border-2 border-purple-300 border-t-purple-600' }),
                uploadProgress
            ),

            // Empty state
            filtered.length === 0 && !isUploading && e('div', { className: 'bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center' },
                e(Icon, { name: 'Sparkles', size: 48, className: 'text-gray-300 mx-auto mb-4' }),
                e('h3', { className: 'text-lg font-semibold text-gray-600 mb-2' },
                    proofData.length === 0 ? 'No proofs yet' : 'No matching proofs'),
                e('p', { className: 'text-sm text-gray-400 mb-4' },
                    proofData.length === 0
                        ? 'Upload PDF proofs to get started. OCR will extract metadata automatically.'
                        : 'Try adjusting your search or filters.'),
                proofData.length === 0 && e('label', {
                    className: 'inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg cursor-pointer hover:bg-purple-700 transition-colors text-sm font-medium'
                },
                    e(Icon, { name: 'Upload', size: 16 }),
                    'Upload Your First Proof',
                    e('input', {
                        type: 'file',
                        accept: '.pdf,image/*',
                        multiple: true,
                        onChange: handleUpload,
                        className: 'hidden'
                    })
                )
            ),

            // Gallery
            filtered.length > 0 && (
                viewMode === 'cards'
                    ? e('div', { className: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' },
                        filtered.map(proof => e(ProofCard, { key: proof.id, proof, viewMode, onDelete: handleDelete })))
                    : e('div', { className: 'space-y-2' },
                        filtered.map(proof => e(ProofCard, { key: proof.id, proof, viewMode, onDelete: handleDelete })))
            )
        );
    };

    // ─── Export ───────────────────────────────────────────────────────────────
    window.STAPCreativeHub = { CreativeHub };

})(window);
