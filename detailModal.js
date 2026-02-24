// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL - Campaign Details & Email Generator Component
// Extracted from index.html for Babel optimization
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo } = React;

    // Dependencies will be injected from main app
    let ALL_STAGES = [];
    let Icon = null;
    let ProductionIcon = null;
    let getStatusColor = null;

    // Initialize dependencies from window
    const initDependencies = () => {
        ALL_STAGES = window.STAP_ALL_STAGES || [
            'RFP', 'Initial Proposal', 'Client Feedback', 'Pending Hold', 'On Hold',
            'Pending Client Approval', 'Pending Finance Approval', 'Contracted',
            'Proofs Approved', 'Working On It', 'Proofs Out For Approval', 'Artwork Received',
            'Material Ready For Install', 'Installed', 'Photos Taken', 'POP Completed', 'Takedown Complete'
        ];
        Icon = window.STAP_Icon || (({ name, size = 20, className = "" }) =>
            React.createElement('span', { className }, `[${name}]`)
        );
        ProductionIcon = window.STAP_ProductionIcon || (() => null);
        getStatusColor = window.STAP_getStatusColor || (() => 'bg-gray-100 text-gray-700');
    };

    // Carrier tracking URL mapping for clickable tracking links
    const TRACKING_URLS = {
        'UPS': (num) => `https://www.ups.com/track?tracknum=${num}`,
        'FedEx': (num) => `https://www.fedex.com/fedextrack/?trknbr=${num}`,
        'USPS': (num) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`,
        'DHL': (num) => `https://www.dhl.com/us-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${num}`,
    };

    const DetailModal = ({ item, onClose, onSave, onLogEmail, materialReceiverData = [], proofData = [], onOpenCreativeHub, onOpenMaterialReceivers, onAddMaterial, onRemoveMaterial }) => {
        // Initialize dependencies on first render
        useEffect(() => { initDependencies(); }, []);

        // Linked data: filter materials/proofs for this campaign
        const campaignId = item?.id || '';
        const campaignName = (item?.name || '').toLowerCase();
        const advertiser = (item?.advertiser || '').toLowerCase();

        const linkedMaterials = useMemo(() => {
            if (!materialReceiverData.length || !campaignId) return [];
            return materialReceiverData.filter(m => {
                const mCampId = (m.campaignId || m.campaign_id || '').toLowerCase();
                const mClient = (m.client || m.advertiser || '').toLowerCase();
                return mCampId === campaignId.toLowerCase() || (mClient && advertiser && mClient.includes(advertiser));
            });
        }, [materialReceiverData, campaignId, advertiser]);

        const linkedProofs = useMemo(() => {
            if (!proofData.length || !campaignId) return [];
            return proofData.filter(p => {
                const pCampId = (p.campaignId || p.campaign_id || '').toLowerCase();
                const pClient = (p.client || p.advertiser || '').toLowerCase();
                return pCampId === campaignId.toLowerCase() || (pClient && advertiser && pClient.includes(advertiser));
            });
        }, [proofData, campaignId, advertiser]);

        // Auto-derive earliest material received date from linked receivers
        const autoMaterialDate = useMemo(() => {
            if (!linkedMaterials.length) return '';
            const dates = linkedMaterials
                .map(m => m.dateReceived || m.date_received || m.transactionDate)
                .filter(Boolean)
                .map(d => new Date(d))
                .filter(d => !isNaN(d));
            if (!dates.length) return '';
            const earliest = new Date(Math.min(...dates));
            return `${earliest.getMonth()+1}/${earliest.getDate()}/${earliest.getFullYear()}`;
        }, [linkedMaterials]);

        // Inline PDF upload for material receiver
        const pdfInputRef = React.useRef(null);
        const [pdfUploading, setPdfUploading] = useState(false);
        const [pdfFeedback, setPdfFeedback] = useState('');

        const handleInlinePdfUpload = async (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length || !window.STAP_parseMaterialPdf) return;
            setPdfUploading(true);
            const required = parseInt(customQty) || 0;
            let runningTotal = linkedMaterials.reduce((acc, m) => acc + (parseInt(m.quantity) || 0), 0);
            let addedCount = 0;
            let lastDate = '';

            for (const file of files) {
                setPdfFeedback(`Processing ${addedCount + 1}/${files.length}...`);
                try {
                    const parsed = await window.STAP_parseMaterialPdf(file);
                    parsed.campaignId = campaignId;
                    parsed.matchedCampaign = item?.advertiser
                        ? `${item.advertiser}${item.name ? ' – ' + item.name : ''}`
                        : campaignId;
                    parsed.client = parsed.client || item?.advertiser || '';
                    parsed.advertiser = parsed.advertiser || item?.advertiser || '';
                    if (onAddMaterial) onAddMaterial(parsed);
                    if (parsed.dateReceived) lastDate = parsed.dateReceived;
                    runningTotal += parseInt(parsed.quantity) || 0;
                    addedCount++;

                    // Auto-fill breakdown row from parsed PDF data
                    const code = parsed.posterCode || parsed.description || '';
                    const qty = String(parsed.quantity || '');

                    if (code || qty) {
                        setMaterialBreakdown(prev => {
                            // Each receiver gets its own row (multiple shipments of same design)
                            const firstEmptyIdx = prev.findIndex(r => !r.code && !r.qty);
                            if (firstEmptyIdx >= 0) {
                                const updated = [...prev];
                                updated[firstEmptyIdx] = { code, qty, scheduled: '', scheduledLocked: false, link: '' };
                                return updated;
                            }
                            return [...prev, { code, qty, scheduled: '', scheduledLocked: false, link: '' }];
                        });
                    }
                } catch (err) {
                    console.error('PDF parse error:', err);
                    setPdfFeedback(`Error on file ${addedCount + 1}: ${err.message}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            if (lastDate) setMaterialReceivedDate(lastDate);
            if (required > 0 && runningTotal >= required) {
                setPdfFeedback(`✓ ${addedCount} file${addedCount > 1 ? 's' : ''} added. Materials complete (${runningTotal}/${required})`);
            } else {
                setPdfFeedback(`${addedCount} file${addedCount > 1 ? 's' : ''} added (${runningTotal}/${required} total)`);
            }
            setTimeout(() => setPdfFeedback(''), 5000);
            setPdfUploading(false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
            if (!customReceiverLink) setReceiverLinkNudge(true);
        };

        const [editMode, setEditMode] = useState(false);
        const [newStage, setNewStage] = useState(item?.stage || '');
        const [emailDraft, setEmailDraft] = useState('');
        const [subjectLine, setSubjectLine] = useState('');
        const [copyFeedback, setCopyFeedback] = useState("");
        const [subjectCopied, setSubjectCopied] = useState(false);

        // Install count editing
        const [editingInstallCount, setEditingInstallCount] = useState(false);
        const [newInstalledCount, setNewInstalledCount] = useState(0);

        // Adjusted quantity editing (for charted qty override)
        const [editingAdjustedQty, setEditingAdjustedQty] = useState(false);
        const [adjustedQty, setAdjustedQty] = useState(null);
        const [originalQty, setOriginalQty] = useState(0);

        // Custom fields
        const [customQty, setCustomQty] = useState('');
        const [emailInstalledQty, setEmailInstalledQty] = useState('');
        const [customDesigns, setCustomDesigns] = useState('');
        const [customPhotosLink, setCustomPhotosLink] = useState('');
        const [customReceiverLink, setCustomReceiverLink] = useState('');
        const [receiverLinkNudge, setReceiverLinkNudge] = useState(false);
        const [materialReceivedDate, setMaterialReceivedDate] = useState('');

        // Template logic
        const [selectedTemplate, setSelectedTemplate] = useState('auto');
        const [issueReason, setIssueReason] = useState('');
        const [newEta, setNewEta] = useState('');
        const [missingType, setMissingType] = useState('instructions');
        const [deadlineDate, setDeadlineDate] = useState('');
        const [showInstallControls, setShowInstallControls] = useState(false);

        // Material breakdown for inventory
        const [materialBreakdown, setMaterialBreakdown] = useState([{ code: '', qty: '', scheduled: '', scheduledLocked: false, link: '' }]);

        // Removal tracking state
        const [removalQty, setRemovalQty] = useState(0);
        const [removedCount, setRemovedCount] = useState(0);
        const [removalStatus, setRemovalStatus] = useState('scheduled');
        const [removalAssignee, setRemovalAssignee] = useState('');
        const [removalPhotosLink, setRemovalPhotosLink] = useState('');
        const [hasReplacement, setHasReplacement] = useState(false);
        const [editingRemoval, setEditingRemoval] = useState(false);
        const [matExpanded, setMatExpanded] = useState(false);
        const [breakdownExpanded, setBreakdownExpanded] = useState(false);
        const [commsDrawerOpen, setCommsDrawerOpen] = useState(false);
        const [historyExpanded, setHistoryExpanded] = useState(false);
        const [shipmentDrawerOpen, setShipmentDrawerOpen] = useState(false);
        const [shipments, setShipments] = useState([]);
        const [shipmentNotes, setShipmentNotes] = useState('');
        const [trackingLoading, setTrackingLoading] = useState(new Set());
        const [trackingFlash, setTrackingFlash] = useState(new Set());

        // Helper: Calculate inventory status
        const getInventoryStatus = () => {
            const required = parseFloat(customQty) || 0;
            const currentTotal = materialBreakdown.reduce((acc, row) => acc + (parseFloat(row.qty) || 0), 0);
            return { currentTotal, isSufficient: currentTotal >= required };
        };

        // Auto-distribute scheduled qty across unlocked rows
        const autoDistributeScheduled = (rows, charted) => {
            const target = parseFloat(charted) || 0;
            if (target <= 0) return rows;

            const activeIndices = rows.reduce((acc, row, i) => {
                if (row.code || row.qty) acc.push(i);
                return acc;
            }, []);
            if (activeIndices.length === 0) return rows;

            // Sum locked rows
            let lockedTotal = 0;
            const unlockedIndices = [];
            activeIndices.forEach(i => {
                if (rows[i].scheduledLocked) {
                    lockedTotal += parseFloat(rows[i].scheduled) || 0;
                } else {
                    unlockedIndices.push(i);
                }
            });

            const remaining = Math.max(0, target - lockedTotal);
            if (unlockedIndices.length === 0) return rows;

            const base = Math.floor(remaining / unlockedIndices.length);
            let remainder = remaining - base * unlockedIndices.length;

            const updated = rows.map((row, i) => {
                if (!unlockedIndices.includes(i)) return row;
                const extra = remainder > 0 ? 1 : 0;
                if (extra) remainder--;
                return { ...row, scheduled: (base + extra).toString() };
            });
            return updated;
        };

        // Reconciliation status for scheduled vs charted
        const getReconciliationStatus = () => {
            const charted = parseFloat(customQty) || 0;
            const totalScheduled = materialBreakdown.reduce((acc, row) => {
                if (row.code || row.qty) acc += parseFloat(row.scheduled) || 0;
                return acc;
            }, 0);
            if (charted <= 0) return { totalScheduled, charted, status: 'none', color: 'gray' };
            if (totalScheduled === charted) return { totalScheduled, charted, status: 'matched', color: 'green' };
            if (totalScheduled > charted) return { totalScheduled, charted, status: 'over', color: 'red' };
            return { totalScheduled, charted, status: 'under', color: 'amber' };
        };

        // Update a row's scheduled value and lock it
        const updateScheduled = (index, value) => {
            const newRows = [...materialBreakdown];
            newRows[index] = { ...newRows[index], scheduled: value, scheduledLocked: true };
            setMaterialBreakdown(newRows);
        };

        // Unlock a row's scheduled value (returns to auto-distribution)
        const unlockScheduled = (index) => {
            const newRows = [...materialBreakdown];
            newRows[index] = { ...newRows[index], scheduledLocked: false };
            const redistributed = autoDistributeScheduled(newRows, customQty);
            setMaterialBreakdown(redistributed);
        };

        // Row handlers
        const addRow = () => {
            const newRows = [...materialBreakdown, { code: '', qty: '', scheduled: '', scheduledLocked: false, link: '' }];
            setMaterialBreakdown(autoDistributeScheduled(newRows, customQty));
        };
        const removeRow = (index) => {
            let newRows = materialBreakdown.filter((_, i) => i !== index);
            if (!newRows.length) newRows = [{ code: '', qty: '', scheduled: '', scheduledLocked: false, link: '' }];
            const distributed = autoDistributeScheduled(newRows, customQty);
            setMaterialBreakdown(distributed);
            try {
                const overrides = JSON.parse(localStorage.getItem('stap_meta_overrides') || '{}');
                if (overrides[campaignId]) {
                    overrides[campaignId].materialBreakdown = distributed.filter(r => r.code || r.qty);
                    localStorage.setItem('stap_meta_overrides', JSON.stringify(overrides));
                }
            } catch(e) {}
        };
        const updateRow = (index, field, value) => {
            const newRows = [...materialBreakdown];
            newRows[index] = { ...newRows[index], [field]: value };
            // Re-distribute when received qty or code changes (affects active row set)
            if (field === 'qty' || field === 'code') {
                setMaterialBreakdown(autoDistributeScheduled(newRows, customQty));
            } else {
                setMaterialBreakdown(newRows);
            }
        };

        // Track the current item key to avoid re-initializing state when the same item is updated (e.g., after save)
        const currentItemKeyRef = React.useRef(null);

        useEffect(() => {
            // Reset ref when modal closes so re-opening loads fresh data
            if (!item) {
                currentItemKeyRef.current = null;
                return;
            }

            if (item) {
                const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;

                // Only fully re-initialize state when opening a DIFFERENT item
                // Skip re-initialization if this is the same item (e.g., after a save)
                if (currentItemKeyRef.current === uniqueKey) {
                    // Same item - only update stage if it changed (for auto-stage updates)
                    if (item.stage) setNewStage(item.stage);
                    return;
                }

                // Different item - do full initialization
                currentItemKeyRef.current = uniqueKey;

                setNewStage(item.stage);
                setNewInstalledCount(item.totalInstalled || item.installed || 0);
                setEditingInstallCount(false);

                // Initialize original and adjusted quantity
                const origQty = item.quantity || item.totalQty || 0;
                setOriginalQty(origQty);
                // Check if item has an adjustedQty override
                setAdjustedQty(item.adjustedQty != null ? item.adjustedQty : null);
                setEditingAdjustedQty(false);

                // Load Comms Center fields from localStorage (email-only fields, NOT dirty-checked)
                const savedMaterialData = JSON.parse(localStorage.getItem('stap_material_data') || '{}');
                const savedData = savedMaterialData[uniqueKey];

                // Comms Center fields — loaded from savedData (not dirty-checked)
                setCustomQty(savedData?.totalQty || item.quantity || item.totalQty || '0');
                setEmailInstalledQty(savedData?.installed || item.totalInstalled || item.installed || '0');
                setCustomDesigns(savedData?.mediaType || item.media || item.product || '');
                setCustomPhotosLink(savedData?.photosLink || item.photosLink || '');
                setCustomReceiverLink(savedData?.receiverLink || item.receiverLink || '');

                // Dirty-checked fields — MUST initialize from item.* to match hasUnsavedChanges
                setMaterialReceivedDate(item.materialReceivedDate || '');

                // Material breakdown — MUST init from item (metaOverrides) to match dirty check
                // Never fall back to stap_material_data — that causes dirty-check mismatch (save button on open)
                if (item.materialBreakdown && item.materialBreakdown.length > 0) {
                    setMaterialBreakdown(item.materialBreakdown.map(row => ({
                        code: row.code || '',
                        qty: row.qty || '',
                        scheduled: row.scheduled !== undefined ? row.scheduled : '',
                        scheduledLocked: row.scheduledLocked || false,
                        link: row.link || ''
                    })));
                } else {
                    setMaterialBreakdown([{ code: '', qty: '', scheduled: '', scheduledLocked: false, link: '' }]);
                }

                setIssueReason('');
                setNewEta('');
                setSelectedTemplate('auto');
                setShowInstallControls(true);

                // Load removal tracking data from item (populated from manualOverrides)
                // Use same fallback chain as pending removals list: totalInstalled → quantity
                const effectiveQty = item.totalInstalled || item.quantity || item.totalQty || 0;
                setRemovalQty(item.removalQty != null ? item.removalQty : effectiveQty);
                setRemovedCount(item.removedCount || 0);
                setRemovalStatus(item.removalStatus || 'scheduled');
                setRemovalAssignee(item.removalAssignee || '');
                setRemovalPhotosLink(item.removalPhotosLink || '');

                // Auto-calculate deadline from contract end date (program_end_date) + 45 days
                const contractEnd = item.programEndDateObj || item.programEndDate;
                const flightEnd = item.endDateObj || item.endDate || item.productEndDateObj || item.productEndDate;
                const baseDate = contractEnd ? new Date(contractEnd) : (flightEnd ? new Date(flightEnd) : null);
                if (baseDate && !isNaN(baseDate.getTime())) {
                    const deadline = new Date(baseDate);
                    deadline.setDate(deadline.getDate() + 45);
                    setDeadlineDate(deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
                } else {
                    setDeadlineDate('End of Day Today');
                }
                setHasReplacement(item.hasReplacement || false);
                setEditingRemoval(false);

                // Shipment tracking
                setShipments(item.shipments || []);
                setShipmentNotes(item.shipmentNotes || '');
                setShipmentDrawerOpen(false);
            }
        }, [item]);

        // Auto-fetch tracking status when shipment drawer opens
        useEffect(() => {
            if (!shipmentDrawerOpen || shipments.length === 0) return;
            const fetchable = shipments.filter(s => s.trackingNumber);
            if (fetchable.length === 0) return;

            // Mark all fetchable as loading
            setTrackingLoading(new Set(fetchable.map(s => s.id)));

            fetchable.forEach(shipment => {
                fetch(`/api/track?number=${encodeURIComponent(shipment.trackingNumber)}`)
                    .then(res => {
                        if (res.status === 501 || !res.ok) return null; // not configured or error — skip
                        return res.json();
                    })
                    .then(data => {
                        if (!data || data.error) return;
                        setShipments(prev => prev.map(s => {
                            if (s.id !== shipment.id) return s;
                            const statusChanged = s.status !== data.status;
                            const patch = {
                                status: data.status,
                                lastTracked: new Date().toISOString(),
                            };
                            if (data.deliveredDate) patch.deliveredDate = data.deliveredDate;
                            if (data.location) patch.lastLocation = data.location;
                            if (statusChanged) {
                                setTrackingFlash(prev => new Set([...prev, s.id]));
                                setTimeout(() => setTrackingFlash(prev => {
                                    const next = new Set(prev);
                                    next.delete(s.id);
                                    return next;
                                }), 1500);
                            }
                            return { ...s, ...patch };
                        }));
                    })
                    .catch(() => {}) // network error — skip silently
                    .finally(() => {
                        setTrackingLoading(prev => {
                            const next = new Set(prev);
                            next.delete(shipment.id);
                            return next;
                        });
                    });
            });
        }, [shipmentDrawerOpen]);

        // Sync email template values with INSTALL PROGRESS values
        useEffect(() => {
            const parsed = parseInt(adjustedQty);
            const effectiveQty = !isNaN(parsed) ? parsed : (item?.adjustedQty != null ? item.adjustedQty : originalQty || 0);
            setCustomQty(effectiveQty.toString());
        }, [adjustedQty, originalQty, item?.adjustedQty]);

        // Re-distribute scheduled qty when charted qty changes
        useEffect(() => {
            if (parseFloat(customQty) > 0) {
                setMaterialBreakdown(prev => {
                    const hasActiveRows = prev.some(r => r.code || r.qty);
                    return hasActiveRows ? autoDistributeScheduled(prev, customQty) : prev;
                });
            }
        }, [customQty]);

        useEffect(() => {
            setEmailInstalledQty(newInstalledCount.toString());
        }, [newInstalledCount]);

        // Auto-update removal status based on progress
        // "scheduled" and "blocked" are manual - user controls these
        // "in_progress" and "complete" are auto-calculated from numbers
        useEffect(() => {
            // Don't override manual statuses when removedCount is 0
            if (removedCount === 0) return;

            if (removalQty > 0 && removedCount >= removalQty) {
                setRemovalStatus('removed');
            } else if (removedCount > 0 && removedCount < removalQty) {
                setRemovalStatus('in_progress');
            }
        }, [removedCount, removalQty]);


        // Track if there are unsaved changes
        const hasUnsavedChanges = React.useMemo(() => {
            if (!item) return false;

            // Check stage change
            if (newStage !== item.stage) return true;

            // Check adjusted qty change — use strict null check (0 is valid)
            const itemAdjQty = item.adjustedQty != null ? item.adjustedQty : null;
            const currentAdjQty = adjustedQty !== null && adjustedQty !== '' ? parseInt(adjustedQty) : null;
            if (currentAdjQty !== itemAdjQty) return true;

            // Check install count change
            const itemInstalled = item.totalInstalled || item.installed || 0;
            if (newInstalledCount !== itemInstalled) return true;

            // Check removal tracking changes — use same fallback chain as init
            const effectiveQty = item.totalInstalled || item.quantity || item.totalQty || 0;
            const itemRemovalQty = item.removalQty != null ? item.removalQty : effectiveQty;
            if (removalQty !== itemRemovalQty) return true;
            const itemRemovedCount = item.removedCount || 0;
            if (removedCount !== itemRemovedCount) return true;
            // Account for auto-status effect: when removedCount > 0, the useEffect
            // overrides removalStatus to 'in_progress' or 'removed', so compare
            // against what the effect would produce, not the raw stored value
            const expectedRemovalStatus = (() => {
                if (itemRemovedCount === 0) return item.removalStatus || 'scheduled';
                if (itemRemovalQty > 0 && itemRemovedCount >= itemRemovalQty) return 'removed';
                return 'in_progress';
            })();
            if (removalStatus !== expectedRemovalStatus) return true;
            if (removalAssignee !== (item.removalAssignee || '')) return true;
            if (removalPhotosLink !== (item.removalPhotosLink || '')) return true;
            if (hasReplacement !== (item.hasReplacement || false)) return true;

            // Check material received date change
            if ((materialReceivedDate || '') !== (item.materialReceivedDate || '')) return true;

            // Check material breakdown changes (scheduled values, lock state, or row data)
            const currentBreakdown = materialBreakdown.filter(r => r.code || r.qty);
            const itemBreakdown = (item.materialBreakdown || []).filter(r => r.code || r.qty);
            if (JSON.stringify(currentBreakdown) !== JSON.stringify(itemBreakdown)) return true;

            // Check shipment changes
            if (JSON.stringify(shipments) !== JSON.stringify(item.shipments || [])) return true;
            if ((shipmentNotes || '') !== (item.shipmentNotes || '')) return true;

            return false;
        }, [item, newStage, adjustedQty, newInstalledCount, removalQty, removedCount, removalStatus, removalAssignee, removalPhotosLink, hasReplacement, materialBreakdown, materialReceivedDate, shipments, shipmentNotes]);

        // Helper functions for templates
        const formatMediaType = (media) => {
            if (!media) return 'N/A';
            return media.replace('Transit Shelter-', 'TS-').replace('Transit Shelters-', 'TS-').replace('Transit Buses-', 'Bus-');
        };

        const formatMarketName = (market) => {
            if (!market) return 'N/A';
            return market.split(',')[0].replace(' - STAP', '');
        };

        // Template generators
        const generateScheduleTemplate = () => {
            const designCodes = materialBreakdown.filter(row => row.code).map(row => row.code);
            return `<div style='font-family:Arial,sans-serif; max-width:560px; color:#333;'>
                <div style='background:#007bff; padding:12px 15px; color:white;'><strong style='font-size:16px;'>📅 Installation Scheduled</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Work orders have been submitted for scheduling:</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:120px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Total Qty</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${customQty || '0'}</strong> faces</td></tr>
                        ${designCodes.length > 0 ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Designs</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${designCodes.join(', ')}</td></tr>` : ''}
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                    ${customReceiverLink ? `<p style='margin:15px 0 0;'><a href="${customReceiverLink}" style="color:#007bff;">📄 View Receiver PDF</a></p>` : ''}
                </div>
            </div>`;
        };

        const generateCompletionTemplate = () => {
            const designCodes = materialBreakdown.filter(row => row.code).map(row => {
                if (row.link) return `<a href="${row.link}" style="color:#28a745;" target="_blank">${row.code}</a>`;
                return row.code;
            });
            return `<div style='font-family:Arial,sans-serif; max-width:560px; color:#333;'>
                <div style='background:#28a745; padding:12px 15px; color:white;'><strong style='font-size:16px;'>✅ Installation Complete</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Great news! This campaign is now <strong>fully installed</strong>.</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:120px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Qty Installed</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong style="color:#28a745;">${emailInstalledQty || customQty}</strong> faces</td></tr>
                        ${designCodes.length > 0 ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Designs</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${designCodes.join(', ')}</td></tr>` : ''}
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                    <div style='margin:15px 0 0; display:flex; gap:10px;'>
                        ${customPhotosLink ? `<a href="${customPhotosLink}" style="background:#28a745; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">📸 View Photos</a>` : ''}
                        ${customReceiverLink ? `<a href="${customReceiverLink}" style="color:#28a745; padding:10px 20px; text-decoration:none; border:1px solid #28a745; border-radius:4px; display:inline-block;">📄 Receiver PDF</a>` : ''}
                    </div>
                </div>
            </div>`;
        };

        const generateMissingAssetsTemplate = () => {
            let missingText = missingType === 'instructions' ? "Posting Instructions" : missingType === 'material' ? "Creative Materials" : "Instructions & Materials";
            const designCodes = materialBreakdown.filter(row => row.code).map(row => row.code);
            return `<div style='font-family:Arial,sans-serif; max-width:560px; color:#333;'>
                <div style='background:#dc3545; padding:12px 15px; color:white;'><strong style='font-size:16px;'>⚠️ HOLD — Missing Assets</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 10px;'>This campaign is <strong>on hold</strong>. We are missing:</p>
                    <p style='margin:0 0 15px; padding:10px; background:#fff5f5; border-left:3px solid #dc3545; color:#c92a2a;'><strong>${missingText}</strong></p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:120px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Total Qty</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${customQty || '0'}</strong> faces</td></tr>
                        ${designCodes.length > 0 ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Designs</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${designCodes.join(', ')}</td></tr>` : ''}
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                    <p style='margin:15px 0 0; padding:10px; background:#fff3cd; border-left:3px solid #ffc107; font-size:13px;'><strong>⏰ Deadline:</strong> ${deadlineDate}</p>
                </div>
            </div>`;
        };

        const generateDelayTemplate = () => {
            const designCodes = materialBreakdown.filter(row => row.code).map(row => row.code);
            return `<div style='font-family:Arial,sans-serif; max-width:560px; color:#333;'>
                <div style='background:#fd7e14; padding:12px 15px; color:white;'><strong style='font-size:16px;'>🚧 Installation Delay</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Please be advised of a schedule change for this campaign:</p>
                    <div style='margin:0 0 15px; padding:10px; background:#fff3cd; border-left:3px solid #fd7e14;'>
                        <strong>Reason:</strong> ${issueReason || 'Weather/Access'}<br/>
                        <strong>New Target:</strong> ${newEta || 'TBD'}
                    </div>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:120px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Total Qty</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${customQty || '0'}</strong> faces</td></tr>
                        ${designCodes.length > 0 ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Designs</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${designCodes.join(', ')}</td></tr>` : ''}
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                </div>
            </div>`;
        };

        const generateMaintenanceTemplate = () => {
            const designCodes = materialBreakdown.filter(row => row.code).map(row => row.code);
            return `<div style='font-family:Arial,sans-serif; max-width:560px; color:#333;'>
                <div style='background:#20c997; padding:12px 15px; color:white;'><strong style='font-size:16px;'>🛠️ Maintenance Resolved</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Maintenance has been completed for this campaign:</p>
                    <p style='margin:0 0 15px; padding:10px; background:#e6fffa; border-left:3px solid #20c997; color:#0ca678;'><strong>Action Taken:</strong> ${issueReason || 'Repairs completed'}</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:120px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Total Qty</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${customQty || '0'}</strong> faces</td></tr>
                        ${designCodes.length > 0 ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Designs</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${designCodes.join(', ')}</td></tr>` : ''}
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                    ${customPhotosLink ? `<p style='margin:15px 0 0;'><a href="${customPhotosLink}" style="background:#20c997; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">📸 View Photos</a></p>` : ''}
                </div>
            </div>`;
        };

        const generateRemovalTemplate = () => {
            const designCodes = materialBreakdown.filter(row => row.code).map(row => row.code);
            return `<div style='font-family:Arial,sans-serif; max-width:560px; color:#333;'>
                <div style='background:#6c757d; padding:12px 15px; color:white;'><strong style='font-size:16px;'>🗑️ Removal Confirmed</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>All materials have been removed for this campaign.</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:120px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Total Qty</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${customQty || '0'}</strong> faces</td></tr>
                        ${designCodes.length > 0 ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Designs</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${designCodes.join(', ')}</td></tr>` : ''}
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                    ${customPhotosLink ? `<p style='margin:15px 0 0;'><a href="${customPhotosLink}" style="background:#6c757d; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">📸 View Removal Photos</a></p>` : ''}
                </div>
            </div>`;
        };

        const generateMaterialReceivedTemplate = () => {
            const validRows = materialBreakdown.filter(row => row.code || row.qty);
            const totalScheduled = validRows.reduce((acc, r) => acc + (parseFloat(r.scheduled) || 0), 0);
            const breakdownRows = validRows.map(row => {
                const effectiveLink = row.link || customReceiverLink || '';
                const codeDisplay = effectiveLink
                    ? `<a href="${effectiveLink}" style="color: #6f42c1; font-weight: bold; text-decoration: underline;" target="_blank">${row.code || 'N/A'}</a>`
                    : (row.code || 'N/A');
                return `<tr><td style='padding:6px 10px; border-bottom:1px solid #eee;'>${codeDisplay}</td><td style='padding:6px 10px; border-bottom:1px solid #eee; text-align:right;'>${row.qty || 0}</td><td style='padding:6px 10px; border-bottom:1px solid #eee; text-align:right;'>${row.scheduled || 0}</td></tr>`;
            }).join('');

            const receiverTotal = linkedMaterials.reduce((acc, m) => acc + (parseInt(m.quantity) || 0), 0);
            const { isSufficient, currentTotal } = getInventoryStatus();
            const required = parseFloat(customQty) || 0;
            const effectiveReceived = Math.max(currentTotal, receiverTotal);
            const overage = effectiveReceived - required;

            let statusColor, statusText, statusIcon;
            if (effectiveReceived >= required && required > 0) {
                statusColor = '#28a745';
                statusIcon = '✅';
                statusText = 'Inventory Sufficient';
            } else if (effectiveReceived > 0) {
                statusColor = '#dc3545';
                statusIcon = '❌';
                statusText = 'Inventory Shortage';
            } else {
                statusColor = '#dc3545';
                statusIcon = '❌';
                statusText = 'Inventory Shortage';
            }

            const overageNote = effectiveReceived >= required
                ? (overage > 0 ? ` (+${overage} overage)` : '')
                : ` (short ${required - effectiveReceived})`;

            const noOverageNote = (effectiveReceived === required && effectiveReceived > 0) ? `
                <p style='margin:10px 0; padding:8px; background:#fff8e6; border-left:3px solid #ffc107; font-size:12px; color:#856404;'>
                    💡 No overage included — consider ordering backup material.
                </p>
            ` : '';

            // Derive printer, dates, and invoice numbers from linked receivers
            const printers = [...new Set(linkedMaterials.map(m => m.printer || m.client || '').filter(Boolean))];
            const printerDisplay = printers.length > 0 ? printers.join(', ') : null;
            const receivedDates = [...new Set(linkedMaterials.map(m => {
                const d = m.dateReceived || m.date_received || m.transactionDate || '';
                return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            }).filter(Boolean))];
            const dateReceivedDisplay = receivedDates.length > 0 ? receivedDates.join(', ')
                : materialReceivedDate ? new Date(materialReceivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;
            const invoiceNums = [...new Set(linkedMaterials.map(m => m.receiptNumber || '').filter(Boolean))];
            const invoiceDisplay = invoiceNums.length > 0 ? invoiceNums.join(', ') : null;

            return `<div style='font-family:Arial,sans-serif; max-width:560px; color:#333;'>
                <div style='background:#6f42c1; padding:12px 15px; color:white;'><strong style='font-size:16px;'>📦 Materials Received</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Materials have landed in the warehouse and are being processed. Work orders are being drafted.</p>
                    <p style='margin:0 0 15px; padding:10px; background:#f8f9fa; border-left:3px solid ${statusColor};'>
                        <strong>Inventory Status:</strong> ${statusIcon} ${statusText}${overageNote}<br/>
                        <span style="font-size:12px; color:#666;">Received: ${effectiveReceived} / Required: ${customQty || '0'}</span>
                    </p>
                    ${noOverageNote}
                    ${validRows.length > 0 ? `<p style='margin:15px 0 8px; font-weight:bold; font-size:13px; color:#333;'>📐 Inventory Breakdown</p>
                    <table style='width:100%; font-size:12px; border-collapse:collapse; margin:0 0 15px; background:#faf8ff;'>
                        <tr style='background:#6f42c1; color:white;'><th style='padding:8px 10px; text-align:left;'>Design Code</th><th style='padding:8px 10px; text-align:right;'>Received</th><th style='padding:8px 10px; text-align:right;'>Assigned WO</th></tr>
                        ${breakdownRows}
                        <tr style='background:#f3f0ff; font-weight:bold;'><td style='padding:8px 10px; border-top:2px solid #6f42c1;'>TOTAL</td><td style='padding:8px 10px; border-top:2px solid #6f42c1; text-align:right;'>${currentTotal}</td><td style='padding:8px 10px; border-top:2px solid #6f42c1; text-align:right;'>${totalScheduled} / ${customQty || 0}</td></tr>
                    </table>` : ''}
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:120px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
                        ${printerDisplay ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Printer</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${printerDisplay}</td></tr>` : ''}
                        ${dateReceivedDisplay ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Date Received</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${dateReceivedDisplay}</td></tr>` : ''}
                        ${invoiceDisplay ? `<tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Invoice #</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${invoiceDisplay}</td></tr>` : ''}
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                    ${customPhotosLink ? `<div style='margin:15px 0 0;'><a href="${customPhotosLink}" style="background:#6f42c1; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">📸 View Photos</a></div>` : ''}
                </div>
            </div>`;
        };

        // Subject line generator
        const generateSubjectLine = (mode) => {
            const advertiser = item.advertiser || 'Campaign';
            const id = item.id || '';
            const market = formatMarketName(item.market);

            switch(mode) {
                case 'schedule':
                    return `[${advertiser}] Installation Scheduled - ${id}`;
                case 'complete':
                    return `[${advertiser}] ✅ INSTALLED - ${id} (${emailInstalledQty || customQty} faces)`;
                case 'material_received':
                    return `[${advertiser}] Materials Received - ${id}`;
                case 'missing':
                    return `[${advertiser}] ⚠️ ACTION REQUIRED - Missing Assets - ${id}`;
                case 'delay':
                    return `[${advertiser}] Schedule Update - ${id}`;
                case 'maintenance':
                    return `[${advertiser}] Maintenance Complete - ${id}`;
                case 'removal':
                    return `[${advertiser}] Removal Confirmed - ${id}`;
                default:
                    return `[${advertiser}] Campaign Update - ${id}`;
            }
        };

        // Resolve effective template mode (handles 'auto' detection)
        const getResolvedMode = () => {
            const currentStage = newStage || (item ? item.stage : '') || '';
            if (selectedTemplate !== 'auto') return selectedTemplate;
            if (currentStage === "Installed") return 'complete';
            if (currentStage === "Material Ready For Install") return 'material_received';
            if (currentStage.includes("Pending")) return 'missing';
            if (currentStage.includes("Expired") || currentStage.includes("Completed") || currentStage === "Takedown Complete") return 'removal';
            return 'schedule';
        };

        // Template router effect — uses live edited stage (newStage) for auto-detection
        useEffect(() => {
            if (!item) return;
            const mode = getResolvedMode();

            // Generate subject line
            setSubjectLine(generateSubjectLine(mode));

            if (mode === 'material_received') setEmailDraft(generateMaterialReceivedTemplate());
            else if (mode === 'schedule') setEmailDraft(generateScheduleTemplate());
            else if (mode === 'complete') setEmailDraft(generateCompletionTemplate());
            else if (mode === 'missing') setEmailDraft(generateMissingAssetsTemplate());
            else if (mode === 'delay') setEmailDraft(generateDelayTemplate());
            else if (mode === 'maintenance') setEmailDraft(generateMaintenanceTemplate());
            else if (mode === 'removal') setEmailDraft(generateRemovalTemplate());
        }, [customQty, emailInstalledQty, selectedTemplate, item, newStage, materialBreakdown, customDesigns, customPhotosLink, customReceiverLink, issueReason, newEta, missingType, deadlineDate, linkedMaterials]);

        const handleCopyToWebmail = async () => {
            try {
                const blobHtml = new Blob([emailDraft], { type: "text/html" });
                const blobText = new Blob([emailDraft], { type: "text/plain" });
                const data = [new ClipboardItem({ ["text/html"]: blobHtml, ["text/plain"]: blobText })];
                await navigator.clipboard.write(data);

                if(onLogEmail) onLogEmail(`${item.id}_${item.date}_${item.product || item.media}`);
                setCopyFeedback("✅ Copied!");
                setTimeout(() => setCopyFeedback(""), 2000);
            } catch (err) {
                try {
                    const listener = (e) => {
                         e.clipboardData.setData("text/html", emailDraft);
                         e.clipboardData.setData("text/plain", emailDraft);
                         e.preventDefault();
                    };
                    document.addEventListener("copy", listener);
                    document.execCommand("copy");
                    document.removeEventListener("copy", listener);

                    if(onLogEmail) onLogEmail(`${item.id}_${item.date}_${item.product || item.media}`);
                    setCopyFeedback("✅ Copied!");
                    setTimeout(() => setCopyFeedback(""), 2000);
                } catch (e) {
                    setCopyFeedback("❌ Failed to copy");
                }
            }
        };

        const handleSave = () => {
            // Delegate to unified save handler (preserves all fields)
            handleUnifiedSave();
        };

        const handleSaveInstallCount = () => {
            const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;
            // Calculate pending for auto-stage logic (but never save pending)
            const targetQty = parseInt(adjustedQty) || item.adjustedQty || originalQty || 0;
            const newPending = Math.max(0, targetQty - newInstalledCount);

            // Auto-stage logic: when pending = 0, auto-set to "Installed"
            let finalStage = item.stage;
            let saveData = {
                installed: newInstalledCount
            };

            if (newPending === 0 && newInstalledCount > 0 && item.stage !== 'Installed') {
                saveData.previousStage = item.previousStage || item.stage;
                finalStage = 'Installed';
                setNewStage('Installed');
            } else if (newPending > 0 && item.previousStage && item.stage === 'Installed') {
                finalStage = item.previousStage;
                saveData.previousStage = null;
                setNewStage(item.previousStage);
            }

            onSave(uniqueKey, finalStage, saveData);
            setEditingInstallCount(false);
        };

        // Save adjusted quantity override
        const handleSaveAdjustedQty = () => {
            const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;
            const parsedAdj = parseInt(adjustedQty);
            const adjQty = !isNaN(parsedAdj) ? parsedAdj : null;
            // Validate: adjusted qty must be >= installed count (0 is valid for ghost booking clearance)
            const installed = newInstalledCount || 0;
            if (adjQty !== null && adjQty > 0 && adjQty < installed) {
                alert(`Adjusted quantity (${adjQty}) cannot be less than installed count (${installed})`);
                return;
            }
            // Calculate pending for auto-stage logic (but never save pending)
            const newPending = adjQty !== null ? Math.max(0, adjQty - installed) : undefined;

            // Auto-stage logic: when pending = 0, auto-set to "Installed"
            let finalStage = item.stage;
            let saveData = {
                adjustedQty: adjQty
            };

            if (newPending === 0 && installed > 0 && item.stage !== 'Installed') {
                saveData.previousStage = item.previousStage || item.stage;
                finalStage = 'Installed';
                setNewStage('Installed');
            } else if (newPending > 0 && item.previousStage && item.stage === 'Installed') {
                finalStage = item.previousStage;
                saveData.previousStage = null;
                setNewStage(item.previousStage);
            }

            onSave(uniqueKey, finalStage, saveData);
            setEditingAdjustedQty(false);
        };

        // Clear adjusted quantity override
        const handleClearAdjustedQty = () => {
            const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;
            // Calculate pending for auto-stage logic (but never save pending)
            const installed = newInstalledCount || 0;
            const newPending = Math.max(0, originalQty - installed);

            // Check if we need to revert stage
            let finalStage = item.stage;
            let saveData = { adjustedQty: null };

            if (newPending > 0 && item.previousStage && item.stage === 'Installed') {
                finalStage = item.previousStage;
                saveData.previousStage = null;
                setNewStage(item.previousStage);
            }

            // Also reset removal tracking — no charted qty means no removals to track
            saveData.removalQty = 0;
            saveData.removedCount = 0;
            saveData.removalStatus = 'scheduled';
            saveData.removalAssignee = null;
            saveData.removalPhotosLink = null;
            saveData.hasReplacement = false;

            onSave(uniqueKey, finalStage, saveData);
            setAdjustedQty(null);
            setEditingAdjustedQty(false);

            // Reset removal state to match
            setRemovalQty(0);
            setRemovedCount(0);
            setRemovalStatus('scheduled');
            setRemovalAssignee('');
            setRemovalPhotosLink('');
            setHasReplacement(false);
            setEditingRemoval(false);
        };

        // UNIFIED SAVE - saves all data at once
        const handleUnifiedSave = () => {
            const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;

            // Calculate derived values - be explicit about the charted qty
            // If user entered a value (adjustedQty is set), use it. Otherwise use item's saved value.
            let adjQty = null;
            if (adjustedQty !== null && adjustedQty !== '' && adjustedQty !== undefined) {
                adjQty = parseInt(adjustedQty);
                if (isNaN(adjQty)) adjQty = null;
            } else if (item.adjustedQty) {
                adjQty = item.adjustedQty;
            }

            console.log('Saving charted qty:', { adjustedQty, parsed: adjQty, itemAdjustedQty: item.adjustedQty });

            // Use adjQty when explicitly set (even if 0), else fall back to originalQty
            const targetQty = (adjQty !== null && adjQty !== undefined) ? adjQty : (originalQty || 0);
            const installed = newInstalledCount || 0;
            // Allow zeroing out pending when charted matches installed (ghost booking clearance)
            const pending = Math.max(0, targetQty - installed);
            const isRemovalComplete = removedCount >= removalQty && removalQty > 0;
            const effectiveRemovalStatusValue = isRemovalComplete ? 'removed' : removalStatus;

            // Determine final stage (with auto-stage logic)
            let finalStage = newStage;

            // Auto-stage to Installed when pending = 0 (but allow progression beyond Installed)
            const postInstalledStages = ['installed', 'photos taken', 'pop completed', 'takedown complete'];
            const isPostInstalledStage = postInstalledStages.includes(newStage.toLowerCase());
            if (pending === 0 && installed > 0 && !isPostInstalledStage) {
                finalStage = 'Installed';
                setNewStage('Installed');
            }

            // Auto-stage to Takedown Complete when removal is done
            if (isRemovalComplete && finalStage !== 'Takedown Complete') {
                finalStage = 'Takedown Complete';
                setNewStage('Takedown Complete');
            }

            // Track what changed for history
            const changes = [];
            if (finalStage !== item.stage) changes.push(`Stage: ${item.stage} → ${finalStage}`);
            if (adjQty !== (item.adjustedQty || null)) changes.push(`Charted: ${item.adjustedQty || 'none'} → ${adjQty || 'none'}`);
            if (installed !== (item.totalInstalled || item.installed || 0)) changes.push(`Installed: ${item.totalInstalled || item.installed || 0} → ${installed}`);
            // Track scheduled total changes
            const newScheduledTotal = materialBreakdown.reduce((acc, r) => (r.code || r.qty) ? acc + (parseFloat(r.scheduled) || 0) : acc, 0);
            const oldBreakdown = item.materialBreakdown || [];
            const oldScheduledTotal = oldBreakdown.reduce((acc, r) => (r.code || r.qty) ? acc + (parseFloat(r.scheduled) || 0) : acc, 0);
            if (newScheduledTotal !== oldScheduledTotal) changes.push(`Assigned WO: ${oldScheduledTotal} → ${newScheduledTotal}`);
            if ((materialReceivedDate || '') !== (item.materialReceivedDate || '')) changes.push(`Mat. Received: ${item.materialReceivedDate || 'none'} → ${materialReceivedDate || 'none'}`);
            if (removalQty !== (item.removalQty || 0)) changes.push(`Removal Qty: ${item.removalQty || 0} → ${removalQty}`);
            if (removedCount !== (item.removedCount || 0)) changes.push(`Removed: ${item.removedCount || 0} → ${removedCount}`);
            if (effectiveRemovalStatusValue !== (item.removalStatus || 'scheduled')) changes.push(`Removal Status: ${item.removalStatus || 'scheduled'} → ${effectiveRemovalStatusValue}`);
            if (removalAssignee !== (item.removalAssignee || '')) changes.push(`Assignee: ${item.removalAssignee || 'none'} → ${removalAssignee || 'none'}`);
            const oldShipCount = (item.shipments || []).length;
            if (shipments.length !== oldShipCount) changes.push(`Shipments: ${oldShipCount} → ${shipments.length}`);

            // Build history entry if there were changes
            const existingHistory = item.history || [];
            const newHistory = changes.length > 0 ? [
                ...existingHistory,
                {
                    timestamp: new Date().toISOString(),
                    changes: changes
                }
            ] : existingHistory;

            // Only save fields that actually changed (prevents phantom overrides)
            const saveData = {};
            const originalInstalled = item.totalInstalled || item.installed || 0;

            // Quantity tracking — only include if changed
            if (adjQty !== (item.adjustedQty != null ? item.adjustedQty : null)) {
                saveData.adjustedQty = adjQty;
            }
            if (installed !== originalInstalled) {
                saveData.installed = installed;
            }
            // Material info — only include if changed
            const filteredBreakdown = materialBreakdown.filter(row => row.code || row.qty);
            if (JSON.stringify(filteredBreakdown) !== JSON.stringify(item.materialBreakdown || [])) {
                saveData.materialBreakdown = filteredBreakdown;
            }
            if ((customPhotosLink || null) !== (item.photosLink || null)) saveData.photosLink = customPhotosLink || null;
            if ((customReceiverLink || null) !== (item.receiverLink || null)) saveData.receiverLink = customReceiverLink || null;
            if ((materialReceivedDate || null) !== (item.materialReceivedDate || null)) saveData.materialReceivedDate = materialReceivedDate || null;
            if ((customDesigns || null) !== (item.mediaType || null)) saveData.mediaType = customDesigns || null;
            if ((customQty || null) !== (item.totalQty || null)) saveData.totalQty = customQty || null;
            // Removal tracking — only include if changed
            if (removalQty !== (item.removalQty || 0)) saveData.removalQty = removalQty;
            if (removedCount !== (item.removedCount || 0)) saveData.removedCount = removedCount;
            if (effectiveRemovalStatusValue !== (item.removalStatus || 'scheduled')) saveData.removalStatus = effectiveRemovalStatusValue;
            if ((removalAssignee || null) !== (item.removalAssignee || null)) saveData.removalAssignee = removalAssignee || null;
            if ((removalPhotosLink || null) !== (item.removalPhotosLink || null)) saveData.removalPhotosLink = removalPhotosLink || null;
            if (hasReplacement !== (item.hasReplacement || false)) saveData.hasReplacement = hasReplacement;
            // Shipment tracking — only include if changed
            if (JSON.stringify(shipments) !== JSON.stringify(item.shipments || [])) saveData.shipments = shipments;
            if ((shipmentNotes || '') !== (item.shipmentNotes || '')) saveData.shipmentNotes = shipmentNotes || null;
            // History — always include if there were changes
            if (newHistory.length > 0) saveData.history = newHistory;

            onSave(uniqueKey, finalStage, saveData);

            // Close all edit modes
            setEditingAdjustedQty(false);
            setEditingInstallCount(false);
            setEditingRemoval(false);
            setEditMode(false);

            alert('✅ All changes saved!');
        };

        // Legacy individual saves (keeping for backwards compatibility but simplified)
        const handleSaveAllData = () => handleUnifiedSave();
        const handleSaveRemoval = () => handleUnifiedSave();

        if (!item) return null;

        // Get current dependencies
        initDependencies();

        // Handle close with unsaved changes warning
        const handleClose = () => {
            if (hasUnsavedChanges) {
                if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
                    onClose();
                }
            } else {
                onClose();
            }
        };

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={handleClose}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[92vh] dark:border dark:border-slate-600" onClick={e => e.stopPropagation()}>
                    {/* Header — Row 1: Toolbar */}
                    <div className="px-6 pt-4 pb-2 border-b bg-gray-50 dark:bg-slate-900 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {editMode ? (
                                    <select value={newStage} onChange={(e) => setNewStage(e.target.value)} className="border rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-gray-200">
                                        {ALL_STAGES.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                ) : (
                                    <span onClick={() => setEditMode(true)} className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer ${getStatusColor(item.stage, item.dateObj)}`}>
                                        {item.stage} <Icon name="Edit" size={10} className="inline ml-1 opacity-50"/>
                                    </span>
                                )}
                                <span className="text-gray-400 text-xs font-mono">{item.id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCommsDrawerOpen(!commsDrawerOpen)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${commsDrawerOpen ? 'border-blue-400 dark:border-blue-400 bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300' : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20'}`}
                                >
                                    <Icon name="MessageSquare" size={14} /> Comms Center
                                </button>
                                {hasUnsavedChanges && (
                                    <button
                                        onClick={handleUnifiedSave}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1.5"
                                        title="Save all changes"
                                    >
                                        <Icon name="Save" size={14} /> Save Changes
                                    </button>
                                )}
                                <button onClick={handleClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    <Icon name="X" size={20} />
                                </button>
                            </div>
                        </div>
                        {/* Header — Row 2: Identity + Context pills */}
                        <div className="flex items-end justify-between pb-2">
                            <div>
                                <h2 className="text-xl font-semibold dark:text-gray-100">{item.advertiser}</h2>
                                <h3 className="text-sm text-gray-500 dark:text-gray-400">{item.name}</h3>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {item.market && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
                                        {formatMarketName(item.market)}
                                    </span>
                                )}
                                {(item.product || item.media) && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                                        {formatMediaType(item.product || item.media)}
                                    </span>
                                )}
                                {item.owner && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                        {item.owner}
                                    </span>
                                )}
                                {item.isPremium && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                        ★ Premium
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 overflow-y-auto">
                        {/* Campaign Timeline Bar */}
                        {(() => {
                            const TIMELINE_STAGES = [
                                { key: 'RFP', label: 'RFP' },
                                { key: 'Contracted', label: 'Contracted' },
                                { key: 'Proofs Approved', label: 'Proofs' },
                                { key: 'Material Ready For Install', label: 'Mat Ready' },
                                { key: 'Installed', label: 'Installed' },
                                { key: 'POP Completed', label: 'POP' },
                                { key: 'Takedown Complete', label: 'Takedown' }
                            ];
                            const currentStage = newStage || item.stage || '';
                            // Map current stage to nearest timeline node
                            const allStages = ALL_STAGES.length > 0 ? ALL_STAGES : TIMELINE_STAGES.map(s => s.key);
                            const currentIdx = allStages.indexOf(currentStage);
                            const getTimelineIdx = (stageKey) => allStages.indexOf(stageKey);

                            // Extract history touchpoints: look for "Stage:" entries
                            const historyDates = {};
                            if (item.history && item.history.length > 0) {
                                item.history.forEach(entry => {
                                    if (!entry.changes) return;
                                    entry.changes.forEach(c => {
                                        const match = c.match(/Stage:.*→\s*(.+)/);
                                        if (match) {
                                            const targetStage = match[1].trim();
                                            const ts = new Date(entry.timestamp);
                                            if (!isNaN(ts)) {
                                                historyDates[targetStage] = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            }
                                        }
                                    });
                                });
                            }
                            // Add firstInstall date to Installed node
                            if (item.firstInstall) {
                                const d = item.firstInstallDate || new Date(item.firstInstall);
                                if (d && !isNaN(new Date(d))) {
                                    historyDates['Installed'] = historyDates['Installed'] || new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                }
                            }

                            return (
                                <div className="mb-5 px-1">
                                    {/* Top row: circles + connectors, vertically centered */}
                                    <div className="flex items-center w-full" style={{ height: '18px' }}>
                                        {TIMELINE_STAGES.map((stage, i) => {
                                            const stagePos = getTimelineIdx(stage.key);
                                            const nextTimelineIdx = i < TIMELINE_STAGES.length - 1 ? getTimelineIdx(TIMELINE_STAGES[i + 1].key) : 999;
                                            const isActive = currentIdx >= stagePos && currentIdx < nextTimelineIdx;
                                            const isPast = currentIdx >= nextTimelineIdx;
                                            const isFuture = !isActive && !isPast;

                                            return React.createElement(React.Fragment, { key: stage.key },
                                                // Circle node
                                                React.createElement('div', {
                                                    className: `rounded-full shrink-0 ${
                                                        isActive
                                                            ? 'w-[14px] h-[14px] border-[3px] border-purple-500 bg-white shadow-sm shadow-purple-200'
                                                            : isPast
                                                                ? 'w-[10px] h-[10px] bg-purple-500'
                                                                : 'w-[10px] h-[10px] border-[1.5px] border-gray-300 bg-white'
                                                    }`,
                                                    title: stage.key
                                                }),
                                                // Connector (not after last)
                                                i < TIMELINE_STAGES.length - 1 && React.createElement('div', {
                                                    className: `flex-1 mx-0.5 ${isPast ? 'bg-purple-400' : ''}`,
                                                    style: Object.assign(
                                                        { height: '2px', minWidth: '8px' },
                                                        isFuture ? { backgroundImage: 'repeating-linear-gradient(90deg, #d1d5db 0, #d1d5db 3px, transparent 3px, transparent 6px)', backgroundColor: 'transparent' } :
                                                        isActive ? { backgroundImage: 'linear-gradient(90deg, #a855f7, #d1d5db)', backgroundColor: 'transparent' } : {}
                                                    )
                                                })
                                            );
                                        })}
                                    </div>
                                    {/* Bottom row: labels + dates, aligned under each circle */}
                                    <div className="flex w-full" style={{ marginTop: '2px' }}>
                                        {TIMELINE_STAGES.map((stage, i) => {
                                            const stagePos = getTimelineIdx(stage.key);
                                            const nextTimelineIdx = i < TIMELINE_STAGES.length - 1 ? getTimelineIdx(TIMELINE_STAGES[i + 1].key) : 999;
                                            const isActive = currentIdx >= stagePos && currentIdx < nextTimelineIdx;
                                            const isPast = currentIdx >= nextTimelineIdx;
                                            const dateLabel = historyDates[stage.key];

                                            return React.createElement(React.Fragment, { key: stage.key + '-label' },
                                                React.createElement('div', { className: 'flex flex-col items-center', style: { minWidth: isActive ? '14px' : '10px' } },
                                                    React.createElement('span', {
                                                        className: `text-[8px] leading-none text-center whitespace-nowrap ${
                                                            isActive ? 'font-bold text-purple-700' : isPast ? 'text-purple-400 font-medium' : 'text-gray-400'
                                                        }`
                                                    }, stage.label),
                                                    dateLabel && React.createElement('span', {
                                                        className: `text-[7px] leading-none mt-0.5 ${isActive ? 'text-purple-500 font-medium' : 'text-gray-400'}`
                                                    }, dateLabel)
                                                ),
                                                // Spacer matching connectors
                                                i < TIMELINE_STAGES.length - 1 && React.createElement('div', { className: 'flex-1' })
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                        {/* ATTENTION ALERT BANNER */}
                        {(() => {
                            const alerts = [];
                            if (item.firstInstall) {
                                const firstDate = item.firstInstallDate || new Date(item.firstInstall);
                                const parsedTarget = parseInt(adjustedQty);
                                const tQty = !isNaN(parsedTarget) ? parsedTarget : (item.adjustedQty != null ? item.adjustedQty : originalQty || 0);
                                const inst = newInstalledCount || 0;
                                const pend = Math.max(0, tQty - inst);
                                const isComp = pend === 0 && inst > 0;
                                if (firstDate) {
                                    const startN = new Date(firstDate); startN.setHours(0,0,0,0);
                                    const nowN = new Date(); nowN.setHours(0,0,0,0);
                                    const dur = Math.floor((nowN - startN) / 86400000);
                                    if (dur > 7 && !isComp) alerts.push({ level: 'red', text: `Install SLA exceeded (${dur} days, target 7)` });
                                }
                            }
                            const matReqCheck = parseInt(customQty) || (item.adjustedQty != null ? item.adjustedQty : (originalQty || 0));
                            const matRecvCheck = linkedMaterials.reduce((a, m) => a + (parseInt(m.quantity) || 0), 0);
                            const installStages = ['material ready for install', 'installed', 'photos taken', 'pop completed'];
                            if (installStages.includes((newStage || '').toLowerCase()) && matRecvCheck < matReqCheck && matReqCheck > 0) {
                                alerts.push({ level: 'amber', text: `Materials insufficient: ${matRecvCheck}/${matReqCheck} received` });
                            }
                            if (removalStatus === 'blocked') alerts.push({ level: 'red', text: 'Removal blocked' });
                            if (item.daysUntilDeadline != null && item.daysUntilDeadline < 0) alerts.push({ level: 'red', text: `Removal overdue by ${Math.abs(item.daysUntilDeadline)} days` });
                            if ((newStage || '').toLowerCase() === 'material ready for install' && (newInstalledCount || 0) === 0 && linkedMaterials.length > 0) {
                                alerts.push({ level: 'amber', text: 'Stalled: materials linked but no installs started' });
                            }
                            if (alerts.length === 0) return null;
                            const hasRed = alerts.some(a => a.level === 'red');
                            return (
                                <div className={`mb-3 flex items-start gap-2 px-3 py-2 rounded-lg border ${hasRed ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'}`}>
                                    <Icon name="AlertTriangle" size={16} className={`${hasRed ? 'text-red-500' : 'text-amber-500'} mt-0.5 shrink-0`} />
                                    <div className={`text-xs ${hasRed ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                        {alerts.map((a, i) => React.createElement('div', { key: i }, `• ${a.text}`))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Standard Data Grid - 4 columns with accent borders */}
                        <div className="grid gap-3 mb-4 grid-cols-4">
                            {/* CARD A: SCHEDULE */}
                            {(() => {
                                const booked = originalQty || 0;
                                let charted = null;
                                if (adjustedQty !== null && adjustedQty !== '' && adjustedQty !== undefined) { const parsed = parseInt(adjustedQty); if (!isNaN(parsed)) charted = parsed; }
                                else if (item.adjustedQty) charted = item.adjustedQty;
                                const statusConfig = charted === null
                                    ? { bgColor: 'bg-gray-100 text-gray-600', icon: '○', text: 'Not Verified' }
                                    : charted === booked ? { bgColor: 'bg-green-100 text-green-700', icon: '✓', text: 'Matched' }
                                    : charted < booked ? { bgColor: 'bg-amber-100 text-amber-700', icon: '⚠', text: `${booked - charted} Unlinked` }
                                    : { bgColor: 'bg-blue-100 text-blue-700', icon: '↑', text: `+${charted - booked} Over` };
                                return (
                            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-[3px] border-l-indigo-400 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">Schedule</h4>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusConfig.bgColor}`}>{statusConfig.icon} {statusConfig.text}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 mb-3">
                                    <Icon name="Calendar" size={12} className="text-indigo-400 shrink-0" />
                                    <span>{item.date || '—'} – {item.endDate || 'TBD'}</span>
                                </div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-gray-500">Booked</span>
                                    <span className="text-lg font-mono font-bold dark:text-gray-100">{booked}</span>
                                </div>
                                <div className="flex items-center justify-between group">
                                    <span className="text-xs text-gray-500">Charted</span>
                                    {editingAdjustedQty ? (
                                        <input type="number" value={adjustedQty || ''} onChange={(e) => setAdjustedQty(e.target.value)}
                                            onBlur={() => setEditingAdjustedQty(false)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingAdjustedQty(false); }}
                                            className="w-20 px-2 py-0.5 border border-indigo-300 rounded text-sm font-mono font-bold bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/40 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            min="0" placeholder={booked} autoFocus />
                                    ) : (
                                        <span onClick={() => { const startVal = adjustedQty !== null && adjustedQty !== '' ? adjustedQty : (item.adjustedQty || booked); setAdjustedQty(startVal); setEditingAdjustedQty(true); }}
                                            className={`text-lg font-mono font-bold cursor-pointer hover:opacity-70 ${charted !== null ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-400'}`} title="Click to edit">
                                            {charted !== null ? charted : '--'}<Icon name="Edit" size={10} className="inline ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                                        </span>
                                    )}
                                </div>
                                {charted !== null && !editingAdjustedQty && <div className="text-right mt-0.5"><button onClick={handleClearAdjustedQty} className="text-[9px] text-gray-400 hover:text-red-500" title="Clear override">clear</button></div>}
                            </div>
                                );
                            })()}

                            {/* CARD B: INSTALL PROGRESS */}
                            {(() => {
                                const parsedTargetQty = parseInt(adjustedQty);
                                const targetQty = !isNaN(parsedTargetQty) ? parsedTargetQty : (item.adjustedQty != null ? item.adjustedQty : originalQty || 0);
                                const installed = newInstalledCount || 0;
                                const pending = Math.max(0, targetQty - installed);
                                const pct = targetQty > 0 ? Math.round((installed / targetQty) * 100) : 0;
                                const borderColor = pct >= 100 ? 'border-l-green-500' : pct >= 50 ? 'border-l-amber-500' : 'border-l-red-400';
                                let slaBadge = null;
                                let slaOverdue = false;
                                if (item.firstInstall) {
                                    const firstDate = item.firstInstallDate || new Date(item.firstInstall);
                                    const endDate = item.completionDate || (item.completion ? new Date(item.completion) : null);
                                    const isComplete = pending === 0 && installed > 0;
                                    const refDate = isComplete && endDate ? endDate : new Date();
                                    const startNorm = new Date(firstDate); startNorm.setHours(0,0,0,0);
                                    const endNorm = new Date(refDate); endNorm.setHours(0,0,0,0);
                                    const duration = Math.floor((endNorm - startNorm) / 86400000);
                                    const isOverdue = duration > 7 && !isComplete;
                                    const wasOverdue = duration > 7 && isComplete;
                                    slaOverdue = isOverdue;
                                    slaBadge = isComplete
                                        ? (wasOverdue ? { bg: 'bg-amber-100 text-amber-700', label: `${duration}d` } : { bg: 'bg-green-100 text-green-700', label: `${duration}d` })
                                        : (isOverdue ? { bg: 'bg-red-100 text-red-700', label: `${duration}d` } : { bg: 'bg-gray-100 text-gray-600', label: `${duration}d` });
                                }
                                return (
                            <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-[3px] ${borderColor} p-4 ${slaOverdue ? 'ring-1 ring-red-200 dark:ring-red-500/30' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">Install Progress</h4>
                                    {slaBadge && <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${slaBadge.bg}`}><Icon name="Clock" size={9} className="mr-0.5" />{slaBadge.label}</span>}
                                </div>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className={`text-3xl font-bold tabular-nums ${pct >= 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                                    <span className="text-sm text-gray-400 font-mono">{installed}/{targetQty}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mb-3">
                                    <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <div className="flex items-center justify-between mb-1 group">
                                    <span className="text-xs text-gray-500">Installed</span>
                                    {editingInstallCount ? (
                                        <input type="number" value={newInstalledCount} onChange={(e) => setNewInstalledCount(parseInt(e.target.value) || 0)}
                                            onBlur={() => setEditingInstallCount(false)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingInstallCount(false); }}
                                            className="w-20 px-2 py-0.5 border border-blue-300 rounded text-sm font-mono font-bold bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/40 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            min="0" max={targetQty || 999} autoFocus />
                                    ) : (
                                        <span onClick={() => setEditingInstallCount(true)} className="font-mono font-bold text-blue-700 dark:text-blue-300 cursor-pointer hover:opacity-70" title="Click to edit">
                                            {installed}<Icon name="Edit" size={10} className="inline ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Pending</span>
                                    <span className={`font-mono font-bold ${pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>{pending}</span>
                                </div>
                                {pending === 0 && installed > 0 && <div className="mt-2 text-center"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300">Fully Installed</span></div>}
                            </div>
                                );
                            })()}

                            {/* CARD C: MATERIALS & PROOFS */}
                            {(() => {
                                const matReqQty = parseInt(customQty) || (item.adjustedQty != null ? item.adjustedQty : (originalQty || 0));
                                const matReceived = linkedMaterials.reduce((a, m) => a + (parseInt(m.quantity) || 0), 0);
                                const matIsSufficient = matReqQty > 0 && matReceived >= matReqQty;
                                const matIsPartial = matReceived > 0 && matReceived < matReqQty;
                                const pct = matReqQty > 0 ? Math.min(100, Math.round((matReceived / matReqQty) * 100)) : 0;
                                const overage = matReceived - matReqQty;
                                const printers = [...new Set(linkedMaterials.map(m => m.printer || m.client || '').filter(Boolean))];
                                const borderColor = matIsSufficient ? 'border-l-green-500' : matIsPartial ? 'border-l-amber-500' : 'border-l-gray-300';
                                const suffBadge = matIsSufficient ? { bg: 'bg-green-100 text-green-700', text: 'Complete' } : matIsPartial ? { bg: 'bg-amber-100 text-amber-700', text: `${pct}%` } : { bg: 'bg-gray-100 text-gray-600', text: 'Waiting' };
                                const prodUniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;
                                return (
                            <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-[3px] ${borderColor} p-4`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">Materials</h4>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${suffBadge.bg}`}>{suffBadge.text}</span>
                                </div>
                                <div className="flex items-center gap-0.5 mb-3">
                                    <span className="text-[9px] text-gray-400 shrink-0">Src</span>
                                    <div className="inline-flex rounded overflow-hidden border border-gray-200 dark:border-slate-600">
                                        {[{ key: 'in-house', label: 'IH', activeBg: 'bg-purple-500 text-white' }, { key: 'client', label: 'CL', activeBg: 'bg-blue-500 text-white' }, { key: 'mixed', label: 'MX', activeBg: 'bg-amber-500 text-white' }].map((opt, idx) => (
                                            <button key={opt.key} onClick={() => onSave(prodUniqueKey, item.stage, { productionProof: opt.key })}
                                                className={`px-1.5 py-0.5 text-[9px] font-bold transition-colors ${idx > 0 ? 'border-l border-gray-200 dark:border-slate-600' : ''} ${item.productionProof === opt.key ? opt.activeBg : 'bg-white dark:bg-slate-800 text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>{opt.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1.5 mb-2">
                                    <span className={`text-2xl font-bold tabular-nums ${matIsSufficient ? 'text-green-600 dark:text-green-400' : matIsPartial ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{matReceived}</span>
                                    <span className="text-xs text-gray-400">/ {matReqQty}</span>
                                    {matIsSufficient && overage > 0 && <span className="text-[10px] text-green-500 ml-auto">+{overage}</span>}
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mb-3">
                                    <div className={`h-2 rounded-full transition-all ${matIsSufficient ? 'bg-green-500' : matReceived > 0 ? 'bg-amber-500' : 'bg-gray-300'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                {/* Inventory Breakdown toggle */}
                                <button onClick={() => setBreakdownExpanded(!breakdownExpanded)} className="w-full flex items-center justify-between text-[10px] text-blue-500 hover:text-blue-700 transition-colors cursor-pointer py-1 mb-1">
                                    <span className="flex items-center gap-1">
                                        <Icon name="Table" size={10} /> Breakdown
                                        {(() => { const r = getReconciliationStatus(); return r.status !== 'none' ? React.createElement('span', { className: `ml-1 px-1 py-0.5 rounded text-[8px] font-bold ${r.status === 'matched' ? 'bg-green-100 text-green-700' : r.status === 'under' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}` }, r.status === 'matched' ? '\u2713' : r.status === 'under' ? '\u26A0' : '!') : null; })()}
                                    </span>
                                    <Icon name={breakdownExpanded ? 'ChevronUp' : 'ChevronDown'} size={10} />
                                </button>
                                {breakdownExpanded && (
                                    <div className="bg-gray-50 dark:bg-slate-900 border dark:border-slate-600 rounded p-2 mb-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-[10px] font-bold ${getInventoryStatus().isSufficient ? 'text-green-600' : 'text-red-500'}`}>
                                                Recv: {getInventoryStatus().currentTotal} / {customQty || 0}
                                            </span>
                                            {materialBreakdown.some(r => r.code || r.qty) && <button onClick={() => { if (confirm('Clear all breakdown rows and linked receivers?')) { setMaterialBreakdown([{ code: '', qty: '', scheduled: '', scheduledLocked: false, link: '' }]); if (onRemoveMaterial) linkedMaterials.forEach(m => onRemoveMaterial(m.id)); try { const overrides = JSON.parse(localStorage.getItem('stap_meta_overrides') || '{}'); if (overrides[campaignId]) { overrides[campaignId].materialBreakdown = []; localStorage.setItem('stap_meta_overrides', JSON.stringify(overrides)); } } catch(e) {} } }} className="text-[9px] text-red-400 hover:text-red-600">Clear all</button>}
                                        </div>
                                        {(() => { const recon = getReconciliationStatus(); if (recon.status === 'none') return null; const colorMap = { matched: 'text-green-600', under: 'text-amber-600', over: 'text-red-600' }; const labelMap = { matched: 'Matched', under: 'Under', over: 'Over' }; return React.createElement('div', { className: `mb-1 text-[10px] font-bold ${colorMap[recon.status]}` }, `${recon.status === 'matched' ? '\u2713' : recon.status === 'under' ? '\u26A0' : '\u26D4'} WO: ${recon.totalScheduled} / ${recon.charted} (${labelMap[recon.status]})`); })()}
                                        <div className="space-y-2 mb-1.5">{materialBreakdown.map((row, idx) => { return React.createElement('div', { key: idx, className: 'bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-600 p-1.5' },
                                            React.createElement('div', { className: 'flex items-center gap-1 mb-1' },
                                                React.createElement('input', { placeholder: 'Design code', value: row.code, onChange: e => updateRow(idx, 'code', e.target.value), className: 'flex-1 min-w-0 text-[11px] font-medium border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200' }),
                                                React.createElement('button', { onClick: () => removeRow(idx), className: 'shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors', title: 'Delete row' }, React.createElement(Icon, { name: 'Trash2', size: 12 }))),
                                            React.createElement('div', { className: 'grid grid-cols-2 gap-1.5' },
                                                React.createElement('div', null,
                                                    React.createElement('div', { className: 'text-[9px] text-gray-400 mb-0.5' }, 'Recv'),
                                                    React.createElement('input', { type: 'number', value: row.qty, onChange: e => updateRow(idx, 'qty', e.target.value), className: 'w-full text-[11px] border rounded px-1.5 py-1 text-center dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200' })),
                                                React.createElement('div', null,
                                                    React.createElement('div', { className: 'text-[9px] text-gray-400 mb-0.5 flex items-center justify-between' }, 'Assigned WO', row.scheduledLocked && React.createElement('button', { onClick: () => unlockScheduled(idx), className: 'text-amber-500 hover:text-amber-700' }, React.createElement(Icon, { name: 'Lock', size: 9 }))),
                                                    React.createElement('input', { type: 'number', value: row.scheduled, onChange: e => updateScheduled(idx, e.target.value), className: `w-full text-[11px] border rounded px-1.5 py-1 text-center dark:bg-slate-700 dark:text-gray-200 ${row.scheduledLocked ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/40' : 'dark:border-slate-600'}` })))
                                        ); })}</div>
                                        <button onClick={addRow} className="text-[10px] text-blue-600 font-bold hover:underline">+ Add</button>
                                    </div>
                                )}
                                {item.proofLink && <div className="flex items-center gap-1 mb-2 text-[10px]"><a href={item.proofLink.startsWith('http') ? item.proofLink : `https://${item.proofLink}`} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline flex items-center gap-0.5 truncate"><Icon name="ExternalLink" size={10} /> Proof</a></div>}
                                {linkedMaterials.length > 0 ? (
                                    <div>
                                        <button onClick={() => setMatExpanded(!matExpanded)} className="w-full flex items-center justify-between text-[10px] text-gray-500 hover:text-gray-700 transition-colors group cursor-pointer">
                                            <span className="truncate">{linkedMaterials.length} receipt{linkedMaterials.length !== 1 ? 's' : ''}{printers.length > 0 && <span className="text-gray-400"> · {printers[0]}{printers.length > 1 ? ` +${printers.length - 1}` : ''}</span>}</span>
                                            <Icon name={matExpanded ? 'ChevronUp' : 'ChevronDown'} size={10} className="text-gray-400 group-hover:text-gray-600 shrink-0 ml-1" />
                                        </button>
                                        {matExpanded && <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 space-y-1">{linkedMaterials.map((m, i) => { const d = m.dateReceived || m.date_received || m.transactionDate || ''; const fmtD = d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; return (<div key={i} className="flex items-center gap-1.5 text-[10px]"><span className="font-mono font-bold text-gray-700 dark:text-gray-300 w-[20px] text-right">{parseInt(m.quantity) || 0}</span><span className="text-gray-300">×</span><span className="font-medium text-gray-600 truncate flex-1">{m.posterCode || m.designCode || m.description || 'Material'}</span>{fmtD && <span className="text-gray-400 whitespace-nowrap">{fmtD}</span>}</div>);})}</div>}
                                    </div>
                                ) : (
                                    <div className="text-center py-1">
                                        <div className="text-[10px] text-gray-400">No materials linked</div>
                                        <button onClick={() => setCommsDrawerOpen(true)} className="text-[9px] text-blue-500 hover:text-blue-700 cursor-pointer">Add via Comms Center →</button>
                                    </div>
                                )}
                            </div>
                                );
                            })()}

                            {/* CARD D: REMOVAL */}
                            {(() => {
                                const borderColor = removalStatus === 'removed' ? 'border-l-green-500' : removalStatus === 'in_progress' ? 'border-l-blue-500' : removalStatus === 'blocked' ? 'border-l-red-500' : 'border-l-gray-300';
                                const statusBadge = removalStatus === 'removed' ? { bg: 'bg-green-100 text-green-700', text: 'Complete' } : removalStatus === 'in_progress' ? { bg: 'bg-blue-100 text-blue-700', text: 'In Progress' } : removalStatus === 'blocked' ? { bg: 'bg-red-100 text-red-700', text: 'Blocked' } : { bg: 'bg-gray-100 text-gray-600', text: 'Scheduled' };
                                const isOverdueOrBlocked = removalStatus === 'blocked' || (item.daysUntilDeadline != null && item.daysUntilDeadline < 0);
                                const remPct = removalQty > 0 ? Math.min(100, Math.round((removedCount / removalQty) * 100)) : 0;
                                return (
                            <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-[3px] ${borderColor} p-4 ${isOverdueOrBlocked ? 'ring-1 ring-red-200 dark:ring-red-500/30' : ''} ${item.isAdCouncilTrigger ? 'bg-red-50/50 dark:bg-red-500/5' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[11px] font-bold tracking-wider text-gray-400 uppercase flex items-center gap-1">Removal{item.isAdCouncilTrigger && <span className="px-1 py-0.5 bg-red-600 text-white rounded text-[8px] font-bold ml-1">AC</span>}</h4>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusBadge.bg}`}>{statusBadge.text}</span>
                                </div>
                                {editingRemoval ? (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="text-[10px] font-bold text-gray-500">Qty</label><input type="number" value={removalQty || ''} onChange={(e) => setRemovalQty(parseInt(e.target.value) || 0)} className="w-full text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" min="0" /></div>
                                            <div><label className="text-[10px] font-bold text-gray-500">Done</label><input type="number" value={removedCount || ''} onChange={(e) => setRemovedCount(parseInt(e.target.value) || 0)} className="w-full text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" min="0" max={removalQty} /></div>
                                        </div>
                                        <div><label className="text-[10px] font-bold text-gray-500">Status</label>
                                            {removedCount === 0 ? <select value={removalStatus} onChange={(e) => setRemovalStatus(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"><option value="scheduled">Scheduled</option><option value="blocked">Blocked</option></select>
                                            : <div className={`w-full text-xs border rounded px-1.5 py-1 bg-gray-100 dark:bg-slate-700 ${removalStatus === 'removed' ? 'text-green-600' : 'text-blue-600'}`}>{removalStatus === 'removed' ? 'Removed' : 'In Progress'} <span className="text-gray-400">(auto)</span></div>}
                                        </div>
                                        <div><label className="text-[10px] font-bold text-gray-500">Assignee</label><select value={removalAssignee} onChange={(e) => setRemovalAssignee(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"><option value="">-- Select --</option><option value="Shelter Clean">Shelter Clean</option><option value="In-House Ops">In-House Ops</option></select></div>
                                        <div><label className="text-[10px] font-bold text-gray-500">Photos Link</label><input type="text" value={removalPhotosLink} onChange={(e) => setRemovalPhotosLink(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" placeholder="URL..." /></div>
                                        <div className="flex items-center justify-between pt-1"><div className="flex items-center gap-1"><input type="checkbox" id="hasReplacementCompact" checked={hasReplacement} onChange={(e) => setHasReplacement(e.target.checked)} className="rounded w-3 h-3" /><label htmlFor="hasReplacementCompact" className="text-[10px] text-gray-600 dark:text-gray-400">Has replacement</label></div><button onClick={() => setEditingRemoval(false)} className="text-[10px] text-gray-500 hover:text-gray-700">Done</button></div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-baseline gap-2 mb-2">
                                            <span className={`text-2xl font-bold tabular-nums ${removalStatus === 'removed' ? 'text-green-600' : removalStatus === 'blocked' ? 'text-red-600' : 'text-gray-700 dark:text-gray-200'}`}>{removedCount}</span>
                                            <span className="text-sm text-gray-400 font-mono">/ {removalQty}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mb-3">
                                            <div className={`h-2 rounded-full transition-all ${removalStatus === 'removed' ? 'bg-green-500' : remPct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${remPct}%` }} />
                                        </div>
                                        {removalAssignee && <div className="text-[10px] text-gray-500 mb-1">Assignee: {removalAssignee}</div>}
                                        {item.daysUntilDeadline !== undefined && <div className={`text-[10px] font-bold ${item.daysUntilDeadline < 0 ? 'text-red-600 animate-pulse' : item.daysUntilDeadline <= 7 ? 'text-orange-600' : 'text-green-600'}`}>{item.daysUntilDeadline < 0 ? `${Math.abs(item.daysUntilDeadline)}d overdue` : `${item.daysUntilDeadline}d left`}</div>}
                                        {hasReplacement && <div className="text-[10px] text-green-600 flex items-center gap-1 mt-1"><Icon name="RefreshCw" size={10} /> Replacement</div>}
                                        {adjustedQty != null && adjustedQty > 0 ? (
                                            <button onClick={() => setEditingRemoval(true)} className="w-full mt-2 px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-[10px] font-medium rounded hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1"><Icon name="Edit" size={10} /> Edit</button>
                                        ) : (
                                            <div className="mt-2 text-center text-[9px] text-gray-400">Set charted qty to enable removal tracking</div>
                                        )}
                                    </div>
                                )}
                            </div>
                                );
                            })()}
                        </div>

                        {/* LINKED PROOFS */}
                        {linkedProofs.length > 0 && (
                            <div className="mb-4"><div className="flex items-center justify-between p-2 bg-green-100/60 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
                                <div className="flex items-center gap-2"><Icon name="Sparkles" size={14} className="text-green-600" /><span className="text-xs font-medium text-green-800 dark:text-green-300">{linkedProofs.length} proof{linkedProofs.length !== 1 ? 's' : ''} linked from Creative Hub</span></div>
                                {onOpenCreativeHub && <button onClick={(e) => { e.stopPropagation(); onClose(); onOpenCreativeHub(); }} className="text-[10px] text-green-700 dark:text-green-400 hover:underline">View →</button>}
                            </div></div>
                        )}

                        {/* ACTIVITY LOG — expandable */}
                        {item.history && item.history.length > 0 && (
                            <div className="mb-2">
                                <button onClick={() => setHistoryExpanded(!historyExpanded)} className="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><Icon name="History" size={12} /><span className="font-medium">Activity Log</span><span className="text-gray-400">({item.history.length} change{item.history.length !== 1 ? 's' : ''})</span></div>
                                    <Icon name={historyExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-gray-400" />
                                </button>
                                {historyExpanded && (
                                    <div className="mt-1 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 max-h-48 overflow-y-auto px-4 py-3">
                                        <div className="relative border-l-2 border-gray-200 dark:border-slate-600 ml-1 space-y-3">
                                            {[...item.history].reverse().map((entry, idx) => {
                                                const date = new Date(entry.timestamp);
                                                const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                                                return (<div key={idx} className="pl-4 relative"><div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-gray-300 dark:bg-slate-500" /><div className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">{timeStr}</div><div className="flex flex-wrap gap-1">{entry.changes.map((c, ci) => <span key={ci} className="inline-block bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[10px] rounded px-1.5 py-0.5">{c}</span>)}</div></div>);
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* SHIPMENT DETAILS — inline collapsible drawer */}
                        <div className="mb-2">
                            <button onClick={() => setShipmentDrawerOpen(!shipmentDrawerOpen)} className={`w-full flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-all border-2 shadow-sm hover:shadow-md ${shipmentDrawerOpen ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/15 dark:to-orange-500/15 border-amber-300 dark:border-amber-500/40 shadow-amber-100 dark:shadow-amber-500/10' : 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-500/10 dark:to-amber-500/5 border-amber-200 dark:border-amber-500/25 hover:border-amber-300 dark:hover:border-amber-500/40 hover:from-amber-100 hover:to-orange-50'}`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${shipmentDrawerOpen ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}><Icon name="Truck" size={16} /></div>
                                    <div className="text-left">
                                        <div className={`text-xs font-bold ${shipmentDrawerOpen ? 'text-amber-800 dark:text-amber-300' : 'text-amber-700 dark:text-amber-400'}`}>Shipment Details</div>
                                        <div className="text-[10px] text-amber-500/70 dark:text-amber-400/50">{shipments.length > 0 ? `${shipments.length} shipment${shipments.length !== 1 ? 's' : ''}` : 'No shipments tracked'}</div>
                                    </div>
                                    {shipments.length > 0 && (() => {
                                        const statuses = shipments.map(s => s.status);
                                        const allDelivered = statuses.every(s => s === 'Delivered');
                                        const anyPending = statuses.some(s => s === 'Pending');
                                        const anyInTransit = statuses.some(s => s === 'In Transit' || s === 'Shipped');
                                        let badgeText, badgeClass;
                                        if (allDelivered) { badgeText = 'All Delivered'; badgeClass = 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'; }
                                        else if (anyPending) { badgeText = 'Pending'; badgeClass = 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300'; }
                                        else if (anyInTransit) { badgeText = 'In Transit'; badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'; }
                                        else { badgeText = 'Pending'; badgeClass = 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300'; }
                                        return <span className={`ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>{badgeText}</span>;
                                    })()}
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${shipmentDrawerOpen ? 'bg-amber-200 dark:bg-amber-500/30' : 'bg-amber-100 dark:bg-amber-500/15'}`}><Icon name={shipmentDrawerOpen ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-amber-600 dark:text-amber-400" /></div>
                            </button>
                            {shipmentDrawerOpen && (
                                <div className="mt-1 border border-amber-200 dark:border-amber-500/30 rounded-lg bg-white dark:bg-slate-800 overflow-hidden p-4">
                                    {shipments.length === 0 ? (
                                        <div className="text-center py-4">
                                            <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">No shipments yet</div>
                                            <button onClick={() => setShipments([{ id: Date.now(), trackingNumber: '', provider: 'UPS', status: 'Pending', shipDate: new Date().toISOString().split('T')[0], deliveredDate: '', notes: '' }])} className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium">+ Add Shipment</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-slate-700">
                                                            <th className="text-left pb-2 pr-2">Tracking #</th>
                                                            <th className="text-left pb-2 pr-2">Provider</th>
                                                            <th className="text-left pb-2 pr-2">Status</th>
                                                            <th className="text-left pb-2 pr-2">Ship Date</th>
                                                            <th className="text-left pb-2 pr-2">Delivered</th>
                                                            <th className="text-left pb-2 w-8"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {shipments.map((shipment, idx) => (
                                                            <tr key={shipment.id} className={`border-b border-gray-50 dark:border-slate-700/50 transition-colors duration-700 ${trackingFlash.has(shipment.id) ? 'bg-green-50 dark:bg-green-500/10' : ''}`}>
                                                                <td className="py-1.5 pr-2"><div className="flex items-center gap-1"><input type="text" value={shipment.trackingNumber} onChange={(e) => { const updated = [...shipments]; updated[idx] = { ...updated[idx], trackingNumber: e.target.value }; setShipments(updated); }} placeholder="Tracking #" className="w-full text-xs border rounded px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" />{trackingLoading.has(shipment.id) ? (<span className="flex-shrink-0 animate-spin text-amber-500" title="Fetching status..."><Icon name="RefreshCw" size={13} /></span>) : shipment.trackingNumber && TRACKING_URLS[shipment.provider] && (<button onClick={() => window.open(TRACKING_URLS[shipment.provider](shipment.trackingNumber), '_blank')} className="flex-shrink-0 text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors" title={`Track on ${shipment.provider}`}><Icon name="ExternalLink" size={13} /></button>)}</div></td>
                                                                <td className="py-1.5 pr-2"><select value={shipment.provider} onChange={(e) => { const updated = [...shipments]; updated[idx] = { ...updated[idx], provider: e.target.value }; setShipments(updated); }} className="text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"><option>UPS</option><option>FedEx</option><option>USPS</option><option>DHL</option><option>Other</option></select></td>
                                                                <td className="py-1.5 pr-2"><div><select value={shipment.status} onChange={(e) => { const updated = [...shipments]; const newStatus = e.target.value; const patch = { status: newStatus }; if (newStatus === 'Delivered' && !updated[idx].deliveredDate) { patch.deliveredDate = new Date().toISOString().split('T')[0]; } if (newStatus !== 'Delivered') { patch.deliveredDate = ''; } updated[idx] = { ...updated[idx], ...patch }; setShipments(updated); }} className="text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"><option>Pending</option><option>Shipped</option><option>In Transit</option><option>Delivered</option></select>{shipment.lastTracked && (<div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{(() => { const mins = Math.round((Date.now() - new Date(shipment.lastTracked).getTime()) / 60000); return mins < 1 ? 'Updated just now' : mins < 60 ? `Updated ${mins}m ago` : `Updated ${Math.round(mins/60)}h ago`; })()}</div>)}</div></td>
                                                                <td className="py-1.5 pr-2"><input type="date" value={shipment.shipDate} onChange={(e) => { const updated = [...shipments]; updated[idx] = { ...updated[idx], shipDate: e.target.value }; setShipments(updated); }} className="text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" /></td>
                                                                <td className="py-1.5 pr-2">{shipment.status === 'Delivered' ? (<input type="date" value={shipment.deliveredDate || ''} onChange={(e) => { const updated = [...shipments]; updated[idx] = { ...updated[idx], deliveredDate: e.target.value }; setShipments(updated); }} className="text-xs border rounded px-1.5 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" />) : (<span className="text-xs text-gray-300 dark:text-gray-600">—</span>)}</td>
                                                                <td className="py-1.5"><button onClick={() => { const updated = shipments.filter((_, i) => i !== idx); setShipments(updated); }} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Remove shipment"><Icon name="X" size={14} /></button></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <button onClick={() => setShipments([...shipments, { id: Date.now(), trackingNumber: '', provider: 'UPS', status: 'Pending', shipDate: new Date().toISOString().split('T')[0], deliveredDate: '', notes: '' }])} className="mt-2 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium">+ Add Shipment</button>
                                        </>
                                    )}
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1 block">Notes</label>
                                        <textarea value={shipmentNotes} onChange={(e) => setShipmentNotes(e.target.value)} placeholder="e.g. Split shipment — 2 pallets" rows={2} className="w-full text-xs border rounded px-2 py-1.5 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200 resize-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* COMMS CENTER — inline collapsible drawer */}
                        <div className="mb-2">
                            <button onClick={() => setCommsDrawerOpen(!commsDrawerOpen)} className={`w-full flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-all border-2 shadow-sm hover:shadow-md ${commsDrawerOpen ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/15 dark:to-indigo-500/15 border-blue-300 dark:border-blue-500/40 shadow-blue-100 dark:shadow-blue-500/10' : 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 border-blue-200 dark:border-blue-500/25 hover:border-blue-300 dark:hover:border-blue-500/40 hover:from-blue-100 hover:to-indigo-50'}`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${commsDrawerOpen ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}><Icon name="MessageSquare" size={16} /></div>
                                    <div className="text-left"><div className={`text-xs font-bold ${commsDrawerOpen ? 'text-blue-800 dark:text-blue-300' : 'text-blue-700 dark:text-blue-400'}`}>Comms Center</div><div className="text-[10px] text-blue-500/70 dark:text-blue-400/50">Email templates, materials, PDF upload</div></div>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${commsDrawerOpen ? 'bg-blue-200 dark:bg-blue-500/30' : 'bg-blue-100 dark:bg-blue-500/15'}`}><Icon name={commsDrawerOpen ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-blue-600 dark:text-blue-400" /></div>
                            </button>
                            {commsDrawerOpen && (() => {
                                const resolvedMode = getResolvedMode();
                                const modeColorMap = { schedule: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', material_received: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300', complete: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300', missing: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', delay: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300', maintenance: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300', removal: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300' };
                                const modeNameMap = { schedule: 'Scheduled', material_received: 'Materials Landed', complete: 'Installed', missing: 'Missing Assets', delay: 'Delay Alert', maintenance: 'Maintenance', removal: 'Removal' };
                                return (
                                <div className="mt-1 border border-blue-200 dark:border-blue-500/30 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
                                    <div className="grid grid-cols-2">
                                        {/* ═══ LEFT PANEL — Data Inputs ═══ */}
                                        <div className="p-4 border-r border-gray-200 dark:border-slate-600 overflow-y-auto max-h-[420px] space-y-4">

                                            {/* Section 1: Template & Campaign Info */}
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Template & Campaign</div>
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-gray-600 dark:text-gray-300"><Icon name="Bot" size={14} /> Template</h4>
                                                    <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="text-xs border rounded px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                                                        <option value="auto">Auto-Detect</option><option value="schedule">Scheduled</option><option value="material_received">Materials Landed</option><option value="complete">Installed</option><option value="missing">Missing Assets</option><option value="delay">Delay Alert</option><option value="maintenance">Maintenance</option><option value="removal">Removal</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] bg-gray-50 dark:bg-slate-900 rounded p-2">
                                                    <div className="text-gray-400">Advertiser</div><div className="font-medium text-gray-700 dark:text-gray-300 truncate">{item.advertiser || 'N/A'}</div>
                                                    <div className="text-gray-400">Campaign</div><div className="font-medium text-gray-700 dark:text-gray-300 truncate">{item.id || 'N/A'}</div>
                                                    <div className="text-gray-400">Flight</div><div className="font-medium text-gray-700 dark:text-gray-300 truncate">{item.name || 'N/A'}</div>
                                                    <div className="text-gray-400">Market</div><div className="font-medium text-gray-700 dark:text-gray-300 truncate">{formatMarketName(item.market)}</div>
                                                    <div className="text-gray-400">Dates</div><div className="font-medium text-gray-700 dark:text-gray-300 truncate">{item.date || 'N/A'} — {item.endDate || 'TBD'}</div>
                                                    <div className="text-gray-400">Owner</div><div className="font-medium text-gray-700 dark:text-gray-300 truncate">{item.owner || 'N/A'}</div>
                                                </div>
                                            </div>

                                            <div className="border-b border-gray-100 dark:border-slate-700" />

                                            {showInstallControls && (<>
                                            {/* Section 2: Quantities & Media */}
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Quantities</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div><label className="text-xs font-bold text-gray-500">Required Qty</label><input type="text" value={customQty} onChange={(e)=>setCustomQty(e.target.value)} className="w-full text-sm border rounded px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"/></div>
                                                    {(selectedTemplate === 'complete' || resolvedMode === 'complete') && <div><label className="text-xs font-bold text-green-600">Installed Qty</label><input type="text" value={emailInstalledQty} onChange={(e)=>setEmailInstalledQty(e.target.value)} className="w-full text-sm border border-green-200 dark:border-green-500/30 rounded px-2 py-1 dark:bg-slate-700 dark:text-gray-200"/></div>}
                                                </div>
                                                <div className="mt-2"><label className="text-xs font-bold text-gray-500">Media Type</label><input type="text" value={customDesigns} onChange={(e)=>setCustomDesigns(e.target.value)} className="w-full text-sm border rounded px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"/></div>
                                            </div>

                                            <div className="border-b border-gray-100 dark:border-slate-700" />

                                            {/* Section 3: Template-Specific Fields */}
                                            {selectedTemplate === 'missing' && (<div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Missing Assets</div>
                                                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded"><div className="flex gap-4 mb-2 text-sm"><label className="dark:text-gray-300"><input type="radio" checked={missingType==='instructions'} onChange={()=>setMissingType('instructions')}/> Instructions</label><label className="dark:text-gray-300"><input type="radio" checked={missingType==='material'} onChange={()=>setMissingType('material')}/> Material</label><label className="dark:text-gray-300"><input type="radio" checked={missingType==='both'} onChange={()=>setMissingType('both')}/> Both</label></div><input type="text" value={deadlineDate} onChange={(e)=>setDeadlineDate(e.target.value)} className="w-full text-sm border rounded px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" placeholder="Deadline Date"/></div>
                                            </div>)}

                                            {(selectedTemplate === 'delay' || selectedTemplate === 'maintenance') && (<div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{selectedTemplate === 'delay' ? 'Delay Details' : 'Maintenance Details'}</div>
                                                <div><label className="text-xs font-bold dark:text-gray-300">Reason/Action</label><input type="text" value={issueReason} onChange={(e)=>setIssueReason(e.target.value)} className="w-full text-sm border rounded px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" placeholder="Details..."/></div>
                                                {selectedTemplate === 'delay' && <div className="mt-2"><label className="text-xs font-bold dark:text-gray-300">New Date</label><input type="text" value={newEta} onChange={(e)=>setNewEta(e.target.value)} className="w-full text-sm border rounded px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"/></div>}
                                            </div>)}

                                            {selectedTemplate === 'material_received' && (
                                                <button onClick={() => setBreakdownExpanded(true)} className="w-full p-2 bg-blue-50 dark:bg-blue-500/10 rounded text-[10px] text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1">
                                                    <Icon name="ArrowUp" size={10} /> Edit breakdown in Materials card above
                                                </button>
                                            )}

                                            <div className="border-b border-gray-100 dark:border-slate-700" />

                                            {/* Section 4: Links & Attachments */}
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Links & Attachments</div>
                                                <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-xs font-bold text-green-700">Photos Link</label><input type="text" value={customPhotosLink} onChange={(e)=>setCustomPhotosLink(e.target.value)} className="w-full text-sm border border-green-200 dark:border-green-500/30 rounded px-2 py-1 dark:bg-slate-700 dark:text-gray-200" placeholder="POP folder URL..."/></div><div><label className="text-xs font-bold text-blue-700">Receiver Link</label><input type="text" value={customReceiverLink} onChange={(e)=>{ setCustomReceiverLink(e.target.value); if (e.target.value) setReceiverLinkNudge(false); }} className={`w-full text-sm border rounded px-2 py-1 dark:bg-slate-700 dark:text-gray-200 ${receiverLinkNudge ? 'border-amber-400 ring-2 ring-amber-300 animate-pulse' : 'border-blue-200 dark:border-blue-500/30'}`} placeholder={receiverLinkNudge ? 'Paste Google Drive share link' : 'Receiver PDF URL...'}/>{receiverLinkNudge && <span className="text-[10px] text-amber-600 mt-0.5 block">Paste Google Drive share link</span>}{customReceiverLink && !customReceiverLink.includes('drive.google.com') && !customReceiverLink.includes('docs.google.com') && <span className="text-[10px] text-amber-500 mt-0.5 block">Doesn't look like a Drive link</span>}</div></div>
                                                <div className="flex items-center gap-2"><button onClick={() => pdfInputRef.current?.click()} disabled={pdfUploading} className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${pdfUploading ? 'bg-gray-100 dark:bg-slate-700 text-gray-400' : 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-100 border border-orange-200 dark:border-orange-500/30'}`}><Icon name="Upload" size={12} />{pdfUploading ? 'Processing...' : 'Upload Receiver PDF'}</button><input ref={pdfInputRef} type="file" accept=".pdf" multiple onChange={handleInlinePdfUpload} className="hidden" />{pdfFeedback && <span className="text-[11px] text-green-600 font-medium">{pdfFeedback}</span>}</div>
                                                {linkedMaterials.length > 0 && (
                                                    <div className="mt-2 border border-green-200 dark:border-green-500/30 rounded-lg overflow-hidden">
                                                        <div className="flex items-center justify-between px-3 py-1.5 bg-green-100/80 dark:bg-green-500/15"><div className="flex items-center gap-1.5"><Icon name="Package" size={12} className="text-green-600" /><span className="text-[11px] font-bold text-green-800 dark:text-green-400">{linkedMaterials.length} Receiver{linkedMaterials.length !== 1 ? 's' : ''}</span><span className="text-[10px] text-green-600">({linkedMaterials.reduce((a, m) => a + (parseInt(m.quantity) || 0), 0)} units)</span></div><div className="flex items-center gap-2"><button onClick={() => pdfInputRef.current?.click()} disabled={pdfUploading} className="text-[10px] text-green-700 dark:text-green-400 hover:underline flex items-center gap-0.5"><Icon name="Upload" size={10} /> Add</button>{onOpenMaterialReceivers && <button onClick={(e) => { e.stopPropagation(); setCommsDrawerOpen(false); onClose(); onOpenMaterialReceivers(); }} className="text-[10px] text-green-700 dark:text-green-400 hover:underline">View All →</button>}</div></div>
                                                        <table className="w-full text-[11px]"><thead><tr className="bg-green-50 dark:bg-green-500/5 text-gray-500"><th className="px-3 py-1 text-left font-medium">Date</th><th className="px-3 py-1 text-left font-medium">Design</th><th className="px-3 py-1 text-right font-medium">Qty</th><th className="px-3 py-1 text-left font-medium">Source</th><th className="px-3 py-1 w-6"></th></tr></thead><tbody>{linkedMaterials.map((m, i) => { const d = m.dateReceived || m.date_received || m.transactionDate || ''; const fmtD = d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'; const code = m.posterCode || m.designCode || m.description || '—'; const src = m.printer || m.client || '—'; return (<tr key={m.id || i} className="border-t border-green-100 dark:border-green-500/10"><td className="px-3 py-1 font-mono text-gray-600 dark:text-gray-400">{fmtD}</td><td className="px-3 py-1 font-medium text-gray-800 dark:text-gray-200">{code}</td><td className="px-3 py-1 text-right font-mono font-bold text-gray-800 dark:text-gray-200">{m.quantity || 0}</td><td className="px-3 py-1 text-gray-500 truncate max-w-[100px]" title={src}>{src}</td><td className="px-1 py-1">{onRemoveMaterial && <button onClick={() => { if (confirm('Remove this receiver?')) onRemoveMaterial(m.id); }} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"><Icon name="X" size={12} /></button>}</td></tr>);})}</tbody></table>
                                                    </div>
                                                )}
                                            </div>
                                            </>)}
                                        </div>

                                        {/* ═══ RIGHT PANEL — Live Email Preview ═══ */}
                                        <div className="flex flex-col max-h-[420px] bg-gray-50 dark:bg-slate-900">
                                            {/* Preview Header */}
                                            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${modeColorMap[resolvedMode] || 'bg-gray-100 text-gray-700'}`}>{modeNameMap[resolvedMode] || resolvedMode}</span>
                                                {selectedTemplate === 'auto' && <span className="text-[10px] text-gray-400 italic">auto-detected</span>}
                                            </div>

                                            {/* Subject Line */}
                                            <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700/50 flex items-center gap-2 shrink-0 bg-white dark:bg-slate-800">
                                                <div className="flex-1 min-w-0"><div className="text-[10px] text-gray-400 mb-0.5">Subject</div><div className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate" title={subjectLine}>{subjectLine}</div></div>
                                                <button onClick={() => { navigator.clipboard.writeText(subjectLine); setSubjectCopied(true); setTimeout(() => setSubjectCopied(false), 1500); }} className="text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium shrink-0">{subjectCopied ? 'Copied!' : 'Copy'}</button>
                                            </div>

                                            {/* Receiver Link Warning */}
                                            {resolvedMode === 'material_received' && linkedMaterials.length > 0 && !customReceiverLink && (
                                                <div className="mx-4 mt-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs px-3 py-2 rounded">
                                                    ⚠️ No Drive link for Receiver PDF — email will send without it
                                                </div>
                                            )}

                                            {/* Email Body */}
                                            <div className="flex-1 overflow-y-auto p-4">
                                                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-600 p-3">
                                                    <div dangerouslySetInnerHTML={{ __html: emailDraft }} />
                                                </div>
                                            </div>

                                            {/* Copy Footer */}
                                            <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800">
                                                <button onClick={handleCopyToWebmail} className="w-full px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-colors"><Icon name="Copy" size={14}/> {copyFeedback || "Copy Email to Clipboard"}</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                );
                            })()}
                        </div>

                    </div>

                </div>
            </div>
        );
    };

    // Export to window
    window.STAPDetailModal = {
        DetailModal,
        setDependencies: (deps) => {
            if (deps.ALL_STAGES) window.STAP_ALL_STAGES = deps.ALL_STAGES;
            if (deps.Icon) window.STAP_Icon = deps.Icon;
            if (deps.ProductionIcon) window.STAP_ProductionIcon = deps.ProductionIcon;
            if (deps.getStatusColor) window.STAP_getStatusColor = deps.getStatusColor;
        }
    };

    console.log('✅ STAP DetailModal component loaded');

})(window);
