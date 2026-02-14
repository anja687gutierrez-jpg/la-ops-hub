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
                            // Don't duplicate if code already exists
                            const exists = prev.some(r => r.code && r.code.toLowerCase() === code.toLowerCase());
                            if (exists) return prev;
                            // Replace first empty row, or append
                            const firstEmptyIdx = prev.findIndex(r => !r.code && !r.qty);
                            if (firstEmptyIdx >= 0) {
                                const updated = [...prev];
                                updated[firstEmptyIdx] = { code, qty, scheduled: '', scheduledLocked: false, link: parsed.pdfSource || '' };
                                return updated;
                            }
                            return [...prev, { code, qty, scheduled: '', scheduledLocked: false, link: parsed.pdfSource || '' }];
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
            setMaterialBreakdown(autoDistributeScheduled(newRows, customQty));
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
            }
        }, [item]);

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

            return false;
        }, [item, newStage, adjustedQty, newInstalledCount, removalQty, removedCount, removalStatus, removalAssignee, removalPhotosLink, hasReplacement, materialBreakdown, materialReceivedDate]);

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
                const codeDisplay = row.link
                    ? `<a href="${row.link}" style="color: #6f42c1; font-weight: bold; text-decoration: underline;" target="_blank">${row.code || 'N/A'}</a>`
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

            // Derive printer and date received from linked receivers
            const printers = [...new Set(linkedMaterials.map(m => m.printer || m.client || '').filter(Boolean))];
            const printerDisplay = printers.length > 0 ? printers.join(', ') : null;
            const dateReceivedDisplay = materialReceivedDate
                ? new Date(materialReceivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;

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
                        <tr style='background:#6f42c1; color:white;'><th style='padding:8px 10px; text-align:left;'>Design Code</th><th style='padding:8px 10px; text-align:right;'>Received</th><th style='padding:8px 10px; text-align:right;'>Scheduled</th></tr>
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
                        <tr><td style='padding:8px 10px; color:#666;'>Sales Owner</td><td style='padding:8px 10px;'>${item.owner || 'N/A'}</td></tr>
                    </table>
                    <div style='margin:15px 0 0; display:flex; gap:10px;'>
                        ${customPhotosLink ? `<a href="${customPhotosLink}" style="background:#6f42c1; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; display:inline-block;">📸 View Photos</a>` : ''}
                        ${customReceiverLink ? `<a href="${customReceiverLink}" style="color:#6f42c1; padding:10px 20px; text-decoration:none; border:1px solid #6f42c1; border-radius:4px; display:inline-block;">📄 Receiver PDF</a>` : ''}
                    </div>
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

        // Template router effect — uses live edited stage (newStage) for auto-detection
        useEffect(() => {
            if (!item) return;
            let mode = selectedTemplate;
            const currentStage = newStage || item.stage || '';

            if (mode === 'auto') {
                if (currentStage === "Installed") mode = 'complete';
                else if (currentStage === "Material Ready For Install") mode = 'material_received';
                else if (currentStage.includes("Pending")) mode = 'missing';
                else if (currentStage.includes("Expired") || currentStage.includes("Completed") || currentStage === "Takedown Complete") mode = 'removal';
                else mode = 'schedule';
            }

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

            onSave(uniqueKey, finalStage, saveData);
            setAdjustedQty(null);
            setEditingAdjustedQty(false);
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
            if (newScheduledTotal !== oldScheduledTotal) changes.push(`Scheduled: ${oldScheduledTotal} → ${newScheduledTotal}`);
            if ((materialReceivedDate || '') !== (item.materialReceivedDate || '')) changes.push(`Mat. Received: ${item.materialReceivedDate || 'none'} → ${materialReceivedDate || 'none'}`);
            if (removalQty !== (item.removalQty || 0)) changes.push(`Removal Qty: ${item.removalQty || 0} → ${removalQty}`);
            if (removedCount !== (item.removedCount || 0)) changes.push(`Removed: ${item.removedCount || 0} → ${removedCount}`);
            if (effectiveRemovalStatusValue !== (item.removalStatus || 'scheduled')) changes.push(`Removal Status: ${item.removalStatus || 'scheduled'} → ${effectiveRemovalStatusValue}`);
            if (removalAssignee !== (item.removalAssignee || '')) changes.push(`Assignee: ${item.removalAssignee || 'none'} → ${removalAssignee || 'none'}`);

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
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] dark:border dark:border-slate-600" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="px-8 py-6 border-b bg-gray-50 dark:bg-slate-900 dark:border-slate-700 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                {editMode ? (
                                    <div className="flex items-center gap-2">
                                        <select value={newStage} onChange={(e) => setNewStage(e.target.value)} className="border rounded px-2 py-1 text-sm">
                                            {ALL_STAGES.map(s => <option key={s}>{s}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <span onClick={() => setEditMode(true)} className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer ${getStatusColor(item.stage, item.dateObj)}`}>
                                        {item.stage} <Icon name="Edit" size={10} className="inline ml-1 opacity-50"/>
                                    </span>
                                )}
                                <span className="text-gray-400 text-xs font-mono">{item.id}</span>
                            </div>
                            <h2 className="text-2xl font-bold">{item.advertiser}</h2>
                            <h3 className="text-lg text-gray-600">{item.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Unified Save Button - only shows when there are unsaved changes */}
                            {hasUnsavedChanges && (
                                <button
                                    onClick={handleUnifiedSave}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Save all changes"
                                >
                                    <Icon name="Save" size={20} />
                                </button>
                            )}
                            <button onClick={handleClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                                <Icon name="X" size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-8 overflow-y-auto">
                        {/* Standard Data Grid - 4 columns */}
                        <div className="grid gap-4 mb-4 grid-cols-4">
                            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded border dark:border-slate-600">
                                <h4 className="font-bold text-xs text-gray-500 mb-2">SCHEDULE</h4>
                                <p className="text-sm"><strong>Start:</strong> {item.date}</p>
                                <p className="text-sm mb-3"><strong>End:</strong> {item.endDate}</p>

                                {/* Quantity Reconciliation */}
                                {(() => {
                                    const booked = originalQty || 0;
                                    // Calculate charted - prefer local state if set, then item value
                                    let charted = null;
                                    if (adjustedQty !== null && adjustedQty !== '' && adjustedQty !== undefined) {
                                        const parsed = parseInt(adjustedQty);
                                        if (!isNaN(parsed)) charted = parsed;
                                    } else if (item.adjustedQty) {
                                        charted = item.adjustedQty;
                                    }
                                    const statusConfig = charted === null
                                        ? { color: 'text-gray-400', icon: '○', text: 'Not Verified' }
                                        : charted === booked
                                            ? { color: 'text-green-600', icon: '✓', text: 'Matched' }
                                            : charted < booked
                                                ? { color: 'text-amber-600', icon: '⚠', text: `${booked - charted} Unlinked` }
                                                : { color: 'text-blue-600', icon: '↑', text: `+${charted - booked} Over` };
                                    return (
                                        <div className="pt-2 border-t border-gray-200">
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-gray-500">Booked:</span>
                                                <span className="font-mono font-bold">{booked}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500">Charted:</span>
                                                {editingAdjustedQty ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={adjustedQty || ''}
                                                            onChange={(e) => setAdjustedQty(e.target.value)}
                                                            className="w-14 px-1.5 py-0.5 border border-blue-300 rounded text-xs bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                            min="0"
                                                            placeholder={booked}
                                                            autoFocus
                                                        />
                                                        <button onClick={() => setEditingAdjustedQty(false)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Done editing">
                                                            <Icon name="Check" size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        onClick={() => {
                                                            // Keep current value if set, otherwise use item value or booked as starting point
                                                            const startVal = adjustedQty !== null && adjustedQty !== '' ? adjustedQty : (item.adjustedQty || booked);
                                                            setAdjustedQty(startVal);
                                                            setEditingAdjustedQty(true);
                                                        }}
                                                        className={`font-mono font-bold cursor-pointer hover:opacity-70 ${charted !== null ? 'text-blue-700' : 'text-gray-400'}`}
                                                        title="Click to edit"
                                                    >
                                                        {charted !== null ? charted : '--'} <Icon name="Edit" size={8} className="inline opacity-50"/>
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`text-[10px] mt-1 ${statusConfig.color} font-medium`}>
                                                {statusConfig.icon} {statusConfig.text}
                                                {charted !== null && !editingAdjustedQty && (
                                                    <button onClick={handleClearAdjustedQty} className="ml-1 text-gray-400 hover:text-red-500" title="Clear">
                                                        <Icon name="X" size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded border dark:border-slate-600">
                                <h4 className="font-bold text-xs text-gray-500 mb-2">INSTALL PROGRESS</h4>
                                {/* Progress Bar and Stats */}
                                {(() => {
                                    const parsedTargetQty = parseInt(adjustedQty);
                                    const targetQty = !isNaN(parsedTargetQty) ? parsedTargetQty : (item.adjustedQty != null ? item.adjustedQty : originalQty || 0);
                                    const installed = newInstalledCount || 0;
                                    const pending = Math.max(0, targetQty - installed);
                                    const pct = targetQty > 0 ? Math.round((installed / targetQty) * 100) : 0;
                                    return (
                                        <>
                                            {/* Progress bar */}
                                            <div className="mb-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] text-gray-600">{installed}/{targetQty}</span>
                                                    <span className={`text-[10px] font-bold ${pct >= 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                                        {pct}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                    <div className={`h-1.5 rounded-full transition-all ${
                                                        pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'
                                                    }`} style={{ width: `${Math.min(100, pct)}%` }} />
                                                </div>
                                            </div>
                                            {/* Installed Row */}
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-gray-500">Installed:</span>
                                                {editingInstallCount ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={newInstalledCount}
                                                            onChange={(e) => setNewInstalledCount(parseInt(e.target.value) || 0)}
                                                            className="w-14 px-1.5 py-0.5 border border-blue-300 rounded text-xs bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                            min="0"
                                                            max={targetQty || 999}
                                                            autoFocus
                                                        />
                                                        <button onClick={() => setEditingInstallCount(false)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Done editing">
                                                            <Icon name="Check" size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        onClick={() => setEditingInstallCount(true)}
                                                        className="font-mono font-bold text-blue-700 cursor-pointer hover:opacity-70"
                                                        title="Click to edit"
                                                    >
                                                        {installed} <Icon name="Edit" size={8} className="inline opacity-50"/>
                                                    </span>
                                                )}
                                            </div>
                                            {/* Pending Row */}
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500">Pending:</span>
                                                <span className={`font-mono font-bold ${pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                                    {pending}
                                                </span>
                                            </div>
                                            {pending === 0 && installed > 0 && (
                                                <div className="text-[10px] text-green-600 font-medium mt-1">✓ Complete</div>
                                            )}
                                            {/* INSTALL VELOCITY — SLA tracking */}
                                            {item.firstInstall && (() => {
                                                const firstDate = item.firstInstallDate || (item.firstInstall ? new Date(item.firstInstall) : null);
                                                if (!firstDate) return null;
                                                const endDate = item.completionDate || (item.completion ? new Date(item.completion) : null);
                                                const now = new Date();
                                                const isComplete = pending === 0 && installed > 0;
                                                const refDate = isComplete && endDate ? endDate : now;
                                                const startNorm = new Date(firstDate); startNorm.setHours(0,0,0,0);
                                                const endNorm = new Date(refDate); endNorm.setHours(0,0,0,0);
                                                const duration = Math.floor((endNorm - startNorm) / 86400000);
                                                const isOverdue = duration > 7 && !isComplete;
                                                const wasOverdue = duration > 7 && isComplete;
                                                const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                return (
                                                    <div className={`mt-2 pt-2 border-t border-dashed ${isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="text-gray-500">1st Install:</span>
                                                            <span className="font-mono text-gray-700">{fmtDate(firstDate)}</span>
                                                        </div>
                                                        {isComplete ? (
                                                            <div className="flex items-center justify-between text-[11px] mt-0.5">
                                                                <span className="text-gray-500">Completed:</span>
                                                                <span className={`font-mono font-bold ${wasOverdue ? 'text-amber-600' : 'text-green-600'}`}>
                                                                    {endDate ? fmtDate(endDate) : 'Now'} ({duration}d)
                                                                </span>
                                                            </div>
                                                        ) : isOverdue ? (
                                                            <div className="flex items-center justify-between text-[11px] mt-0.5">
                                                                <span className="text-red-500 font-medium flex items-center gap-0.5">
                                                                    <Icon name="Clock" size={10} /> Duration:
                                                                </span>
                                                                <span className="font-mono font-bold text-red-600">
                                                                    {duration}d <span className="text-[9px]">(SLA exceeded)</span>
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between text-[11px] mt-0.5">
                                                                <span className="text-gray-500">Duration:</span>
                                                                <span className="font-mono text-gray-600">{duration}d ongoing</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* REMOVAL TRACKING BOX - Always shown for consistent layout */}
                            <div className={`p-4 rounded border ${item.isAdCouncilTrigger ? 'bg-red-50 border-red-200' : 'bg-gray-50 dark:bg-slate-900 dark:border-slate-600'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-bold text-xs text-gray-500 flex items-center gap-1">
                                            <Icon name="Trash2" size={12} /> REMOVAL
                                        </h4>
                                        {item.isAdCouncilTrigger && (
                                            <span className="px-1 py-0.5 bg-red-600 text-white rounded text-[8px] font-bold">AC</span>
                                        )}
                                    </div>

                                    {editingRemoval ? (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500">Qty</label>
                                                    <input type="number" value={removalQty || ''} onChange={(e) => setRemovalQty(parseInt(e.target.value) || 0)} className="w-full text-xs border rounded px-1.5 py-1" min="0" placeholder="0" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500">Done</label>
                                                    <input type="number" value={removedCount || ''} onChange={(e) => setRemovedCount(parseInt(e.target.value) || 0)} className="w-full text-xs border rounded px-1.5 py-1" min="0" max={removalQty} placeholder="0" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500">Status</label>
                                                {removedCount === 0 ? (
                                                    <select value={removalStatus} onChange={(e) => setRemovalStatus(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1">
                                                        <option value="scheduled">Scheduled</option>
                                                        <option value="blocked">Blocked</option>
                                                    </select>
                                                ) : (
                                                    <div className={`w-full text-xs border rounded px-1.5 py-1 bg-gray-100 ${
                                                        removalStatus === 'removed' ? 'text-green-600' : 'text-blue-600'
                                                    }`}>
                                                        {removalStatus === 'removed' ? '✓ Removed' : '⏳ In Progress'} <span className="text-gray-400">(auto)</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500">Assignee</label>
                                                <select value={removalAssignee} onChange={(e) => setRemovalAssignee(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1">
                                                    <option value="">-- Select --</option>
                                                    <option value="Shelter Clean">Shelter Clean</option>
                                                    <option value="In-House Ops">In-House Ops</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500">Photos Link</label>
                                                <input type="text" value={removalPhotosLink} onChange={(e) => setRemovalPhotosLink(e.target.value)} className="w-full text-xs border rounded px-1.5 py-1" placeholder="URL..." />
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <div className="flex items-center gap-1">
                                                    <input type="checkbox" id="hasReplacementCompact" checked={hasReplacement} onChange={(e) => setHasReplacement(e.target.checked)} className="rounded w-3 h-3" />
                                                    <label htmlFor="hasReplacementCompact" className="text-[10px] text-gray-600">Has replacement</label>
                                                </div>
                                                <button onClick={() => setEditingRemoval(false)} className="text-[10px] text-gray-500 hover:text-gray-700">Done</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            {/* Progress bar */}
                                            <div className="mb-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] text-gray-600">{removedCount}/{removalQty}</span>
                                                    <span className={`text-[10px] font-bold ${
                                                        removalStatus === 'removed' ? 'text-green-600' :
                                                        removalStatus === 'in_progress' ? 'text-blue-600' :
                                                        removalStatus === 'blocked' ? 'text-red-600' : 'text-gray-500'
                                                    }`}>
                                                        {removalStatus === 'removed' ? '✓' : removalStatus === 'in_progress' ? '⏳' : removalStatus === 'blocked' ? '⛔' : '📅'}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                    <div className={`h-1.5 rounded-full transition-all ${
                                                        removalStatus === 'removed' ? 'bg-green-500' : removedCount / removalQty >= 0.5 ? 'bg-amber-500' : 'bg-red-400'
                                                    }`} style={{ width: `${removalQty > 0 ? Math.min(100, (removedCount / removalQty) * 100) : 0}%` }} />
                                                </div>
                                            </div>
                                            {/* Status & Assignee */}
                                            <div className="text-[10px] mb-1 flex items-center gap-1">
                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                    removalStatus === 'removed' ? 'bg-green-100 text-green-700' :
                                                    removalStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                    removalStatus === 'blocked' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {removalStatus === 'blocked' && '⛔ '}{(removalStatus || 'scheduled').replace('_', ' ')}
                                                </span>
                                                {removalAssignee && <span className="text-gray-500">• {removalAssignee}</span>}
                                            </div>
                                            {/* Deadline */}
                                            {item.daysUntilDeadline !== undefined && (
                                                <div className={`text-[10px] font-bold ${
                                                    item.daysUntilDeadline < 0 ? 'text-red-600' :
                                                    item.daysUntilDeadline <= 7 ? 'text-orange-600' : 'text-green-600'
                                                }`}>
                                                    {item.daysUntilDeadline < 0 ? `${Math.abs(item.daysUntilDeadline)}d overdue` : `${item.daysUntilDeadline}d left`}
                                                </div>
                                            )}
                                            {hasReplacement && (
                                                <div className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                                                    <Icon name="RefreshCw" size={10} /> Replacement
                                                </div>
                                            )}
                                            <button onClick={() => setEditingRemoval(true)} className="w-full mt-2 px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-[10px] font-medium rounded hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1">
                                                <Icon name="Edit" size={10} /> Edit
                                            </button>
                                        </div>
                                    )}
                                </div>

                            {/* MATERIAL RECEIVER — read-only summary pill */}
                            {(() => {
                                const matReqQty = parseInt(customQty) || (item.adjustedQty != null ? item.adjustedQty : (originalQty || 0));
                                const matReceived = linkedMaterials.reduce((a, m) => a + (parseInt(m.quantity) || 0), 0);
                                const matIsSufficient = matReqQty > 0 && matReceived >= matReqQty;
                                const matIsPartial = matReceived > 0 && matReceived < matReqQty;
                                const pct = matReqQty > 0 ? Math.min(100, Math.round((matReceived / matReqQty) * 100)) : 0;
                                const displayDate = materialReceivedDate || autoMaterialDate || item.materialReceivedDate || '';
                                return (
                            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded border dark:border-slate-600">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-xs text-gray-500 flex items-center gap-1">
                                        <Icon name="Package" size={12} /> MATERIALS
                                    </h4>
                                    {linkedMaterials.length > 0 && (
                                        <span className={`text-[10px] font-bold ${matIsSufficient ? 'text-green-600' : matIsPartial ? 'text-amber-600' : 'text-red-500'}`}>
                                            {matReceived}/{matReqQty}
                                        </span>
                                    )}
                                </div>

                                {linkedMaterials.length > 0 ? (
                                    <div className="space-y-2">
                                        {/* Progress bar */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] text-gray-500">{linkedMaterials.length} receipt{linkedMaterials.length !== 1 ? 's' : ''}</span>
                                                <span className={`text-[10px] font-bold ${matIsSufficient ? 'text-green-600' : 'text-amber-600'}`}>{pct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                                                <div className={`h-1.5 rounded-full transition-all ${matIsSufficient ? 'bg-green-500' : matReceived > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>

                                        {/* Sufficiency badge */}
                                        {matReqQty > 0 && (() => {
                                            const color = matIsSufficient ? 'text-green-600 dark:text-green-400' : matIsPartial ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400';
                                            const bg = matIsSufficient ? 'bg-green-50 dark:bg-green-500/10' : matIsPartial ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-red-50 dark:bg-red-500/10';
                                            const icon = matIsSufficient ? '✓' : matIsPartial ? '◐' : '○';
                                            return (
                                                <div className={`px-2 py-1 rounded ${bg} flex items-center justify-between`}>
                                                    <span className="text-[10px] text-gray-500">Status:</span>
                                                    <span className={`text-[10px] font-bold ${color}`}>
                                                        {icon} {matIsSufficient ? 'Complete' : matIsPartial ? 'Partial' : 'Waiting'}
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {/* Received date (read-only) */}
                                        {displayDate && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500">Received:</span>
                                                <span className="text-[10px] font-mono text-gray-700 dark:text-gray-300">{displayDate}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <Icon name="PackageOpen" size={20} className="mx-auto text-gray-300 dark:text-slate-600 mb-1" />
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500">No materials linked</div>
                                        <div className="text-[9px] text-gray-400 dark:text-gray-600 mt-0.5">Upload via Comms Center below</div>
                                    </div>
                                )}
                            </div>
                                );
                            })()}
                        </div>

                        {/* Production Proof Selector */}
                        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/30 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                                        Production Source
                                        {item.productionProof && <ProductionIcon type={item.productionProof} size={14} />}
                                    </h4>
                                    <p className="text-xs text-gray-500">Who produced the creative materials?</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;
                                            onSave(uniqueKey, item.stage, { productionProof: 'in-house' });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                            item.productionProof === 'in-house'
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-50'
                                        }`}
                                    >
                                        <Icon name="Home" size={12} /> In-House
                                    </button>
                                    <button
                                        onClick={() => {
                                            const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;
                                            onSave(uniqueKey, item.stage, { productionProof: 'client' });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                            item.productionProof === 'client'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-50'
                                        }`}
                                    >
                                        <Icon name="Upload" size={12} /> Client
                                    </button>
                                    <button
                                        onClick={() => {
                                            const uniqueKey = `${item.id}_${item.date}_${item.product || item.media}`;
                                            onSave(uniqueKey, item.stage, { productionProof: 'mixed' });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                            item.productionProof === 'mixed'
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50'
                                        }`}
                                        title="Original from client, reprint from in-house (or vice versa)"
                                    >
                                        <Icon name="RefreshCw" size={12} /> Mixed
                                    </button>
                                </div>
                            </div>
                            {item.proofLink && (
                                <div className="mt-3 pt-3 border-t border-purple-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600">📄 Proof Document:</span>
                                        <a
                                            href={item.proofLink.startsWith('http') ? item.proofLink : `https://${item.proofLink}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1"
                                        >
                                            <Icon name="ExternalLink" size={12} />
                                            {item.proofLink.length > 50 ? item.proofLink.substring(0, 50) + '...' : item.proofLink}
                                        </a>
                                    </div>
                                </div>
                            )}
                            {item.productionProof === 'in-house' && item.proofLink && (
                                <div className="mt-2 text-[10px] text-purple-500 flex items-center gap-1">
                                    <Icon name="Zap" size={10} /> Auto-detected from proof link in Google Sheet
                                </div>
                            )}
                        </div>

                        {/* EMAIL GENERATOR UI */}
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold flex items-center gap-2"><Icon name="Bot" size={16} /> Comms Center</h4>
                            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="text-xs border rounded px-2 py-1">
                                <option value="auto">✨ Auto-Detect</option>
                                <option value="schedule">📅 Scheduled</option>
                                <option value="material_received">📦 Materials Landed</option>
                                <option value="complete">✅ Installed</option>
                                <option value="missing">⚠️ Missing Assets</option>
                                <option value="delay">🚧 Delay Alert</option>
                                <option value="maintenance">🛠️ Maintenance</option>
                                <option value="removal">🗑️ Removal</option>
                            </select>
                        </div>

                        {showInstallControls && (
                            <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg">
                                {/* Missing Asset Options */}
                                {selectedTemplate === 'missing' && (
                                    <div className="mb-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded">
                                        <div className="flex gap-4 mb-2 text-sm">
                                            <label><input type="radio" checked={missingType==='instructions'} onChange={()=>setMissingType('instructions')}/> Instructions</label>
                                            <label><input type="radio" checked={missingType==='material'} onChange={()=>setMissingType('material')}/> Material</label>
                                            <label><input type="radio" checked={missingType==='both'} onChange={()=>setMissingType('both')}/> Both</label>
                                        </div>
                                        <input type="text" value={deadlineDate} onChange={(e)=>setDeadlineDate(e.target.value)} className="w-full text-sm border rounded px-2 py-1" placeholder="Deadline Date"/>
                                    </div>
                                )}

                                {/* Inventory Breakdown or Standard Inputs */}
                                {selectedTemplate === 'material_received' ? (
                                    <div className="mb-4 bg-gray-50 dark:bg-slate-800 border dark:border-slate-600 rounded p-3">
                                        {/* Required Qty and Media Type - Bug 1 & 5 fix */}
                                        <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-gray-200">
                                            <div>
                                                <label className="text-xs font-bold text-purple-600">Required Qty</label>
                                                <input type="text" value={customQty} onChange={(e)=>setCustomQty(e.target.value)} className="w-full text-sm border border-purple-300 rounded px-2 py-1"/>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500">Media Type</label>
                                                <input type="text" value={customDesigns} onChange={(e)=>setCustomDesigns(e.target.value)} className="w-full text-sm border rounded px-2 py-1"/>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-bold text-gray-500">Inventory Breakdown</label>
                                            <span className={`text-xs font-bold ${getInventoryStatus().isSufficient ? 'text-green-600' : 'text-red-500'}`}>
                                                Received: {getInventoryStatus().currentTotal} / {customQty || 0}
                                            </span>
                                        </div>
                                        {/* Reconciliation status bar */}
                                        {(() => {
                                            const recon = getReconciliationStatus();
                                            if (recon.status === 'none') return null;
                                            const colorMap = { matched: 'text-green-600', under: 'text-amber-600', over: 'text-red-600' };
                                            const iconMap = { matched: '✓', under: '⚠', over: '🚫' };
                                            const labelMap = { matched: 'Matched', under: 'Under-scheduled', over: 'Over-scheduled' };
                                            return React.createElement('div', {
                                                className: `flex justify-between items-center mb-2 text-xs font-bold ${colorMap[recon.status]}`
                                            },
                                                React.createElement('span', null, `${iconMap[recon.status]} Scheduled: ${recon.totalScheduled} / ${recon.charted} (${labelMap[recon.status]})`),
                                                recon.status === 'over' ? React.createElement('span', {
                                                    className: 'bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs'
                                                }, `+${recon.totalScheduled - recon.charted} over charted`) : null
                                            );
                                        })()}
                                        {/* Column headers */}
                                        <div className="flex gap-2 mb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">
                                            <span className="flex-1">Design Code</span>
                                            <span className="w-16 text-center">Recv</span>
                                            <span className="w-20 text-center">Sched</span>
                                            <span className="w-12 text-center">+/−</span>
                                            <span className="flex-1">Drive Link</span>
                                            <span className="w-6"></span>
                                        </div>
                                        <div className="space-y-2 mb-2">
                                            {materialBreakdown.map((row, idx) => {
                                                const recv = parseFloat(row.qty) || 0;
                                                const sched = parseFloat(row.scheduled) || 0;
                                                const overage = recv - sched;
                                                return (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <input
                                                        placeholder="Design Code"
                                                        value={row.code}
                                                        onChange={e => updateRow(idx, 'code', e.target.value)}
                                                        className="flex-1 text-sm border rounded px-2 py-1"
                                                    />
                                                    <input
                                                        placeholder="Recv"
                                                        type="number"
                                                        value={row.qty}
                                                        onChange={e => updateRow(idx, 'qty', e.target.value)}
                                                        className="w-16 text-sm border rounded px-2 py-1 text-center"
                                                    />
                                                    <div className="w-20 flex items-center gap-0.5">
                                                        <input
                                                            placeholder="Sched"
                                                            type="number"
                                                            value={row.scheduled}
                                                            onChange={e => updateScheduled(idx, e.target.value)}
                                                            className={`w-14 text-sm border rounded px-1 py-1 text-center ${row.scheduledLocked ? 'border-amber-400 bg-amber-50' : ''}`}
                                                            title={row.scheduledLocked ? 'Manually set (click lock to auto-distribute)' : 'Auto-distributed from charted qty'}
                                                        />
                                                        {row.scheduledLocked && (
                                                            <button onClick={() => unlockScheduled(idx)} className="text-amber-500 hover:text-amber-700" title="Unlock for auto-distribution">
                                                                <Icon name="Lock" size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className={`w-12 text-xs font-bold text-center ${overage > 0 ? 'text-green-600' : overage < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {(row.code || row.qty) ? (overage > 0 ? `+${overage}` : overage < 0 ? `${overage}` : '—') : ''}
                                                    </span>
                                                    <input
                                                        placeholder="Google Drive Link"
                                                        value={row.link}
                                                        onChange={e => updateRow(idx, 'link', e.target.value)}
                                                        className="flex-1 text-sm border border-purple-200 rounded px-2 py-1"
                                                        title="Paste Google Drive link for poster image/PDF"
                                                    />
                                                    <button onClick={() => removeRow(idx)} className="text-red-400"><Icon name="X" size={16} /></button>
                                                </div>
                                                );
                                            })}
                                        </div>
                                        <button onClick={addRow} className="text-xs text-blue-600 font-bold hover:underline">+ Add Row</button>
                                    </div>
                                ) : (
                                    <div className="mb-3">
                                        <div><label className="text-xs font-bold text-gray-500">Media Type</label><input type="text" value={customDesigns} onChange={(e)=>setCustomDesigns(e.target.value)} className="w-full text-sm border rounded px-2 py-1"/></div>
                                    </div>
                                )}

                                {/* Dynamic Inputs */}
                                {(selectedTemplate === 'delay' || selectedTemplate === 'maintenance') && (
                                    <div className="mb-3"><label className="text-xs font-bold">Reason/Action</label><input type="text" value={issueReason} onChange={(e)=>setIssueReason(e.target.value)} className="w-full text-sm border rounded px-2 py-1" placeholder="Details..."/></div>
                                )}
                                {selectedTemplate === 'delay' && (
                                    <div className="mb-3"><label className="text-xs font-bold">New Date</label><input type="text" value={newEta} onChange={(e)=>setNewEta(e.target.value)} className="w-full text-sm border rounded px-2 py-1"/></div>
                                )}

                                {/* Photos & Receiver Links + Upload */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div><label className="text-xs font-bold text-green-700">📸 Photos Link</label><input type="text" value={customPhotosLink} onChange={(e)=>setCustomPhotosLink(e.target.value)} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="POP folder URL..."/></div>
                                    <div><label className="text-xs font-bold text-blue-700">📄 Receiver Link</label><input type="text" value={customReceiverLink} onChange={(e)=>setCustomReceiverLink(e.target.value)} className="w-full text-sm border border-blue-200 rounded px-2 py-1" placeholder="Receiver PDF URL..."/></div>
                                </div>
                                <div className="mb-3 flex items-center gap-2">
                                    <button
                                        onClick={() => pdfInputRef.current?.click()}
                                        disabled={pdfUploading}
                                        className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
                                            pdfUploading
                                                ? 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                                                : 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/25 border border-orange-200 dark:border-orange-500/30'
                                        }`}
                                        title="Upload receiver PDF(s) — auto-creates material entries linked to this campaign"
                                    >
                                        <Icon name="Upload" size={12} />
                                        {pdfUploading ? 'Processing...' : 'Upload Receiver PDF'}
                                    </button>
                                    <input
                                        ref={pdfInputRef}
                                        type="file"
                                        accept=".pdf"
                                        multiple
                                        onChange={handleInlinePdfUpload}
                                        className="hidden"
                                    />
                                    {pdfFeedback && (
                                        <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">{pdfFeedback}</span>
                                    )}
                                </div>

                                {/* LINKED MATERIAL RECEIVERS — inline detail table */}
                                {linkedMaterials.length > 0 && (
                                    <div className="mb-3 border border-green-200 dark:border-green-500/30 rounded-lg overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-green-100/80 dark:bg-green-500/15">
                                            <div className="flex items-center gap-1.5">
                                                <Icon name="Package" size={12} className="text-green-600" />
                                                <span className="text-[11px] font-bold text-green-800 dark:text-green-400">
                                                    {linkedMaterials.length} Receiver{linkedMaterials.length !== 1 ? 's' : ''} Linked
                                                </span>
                                                <span className="text-[10px] text-green-600 dark:text-green-500">
                                                    ({linkedMaterials.reduce((a, m) => a + (parseInt(m.quantity) || 0), 0)} units)
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => pdfInputRef.current?.click()}
                                                    disabled={pdfUploading}
                                                    className="text-[10px] text-green-700 dark:text-green-400 hover:underline flex items-center gap-0.5"
                                                >
                                                    <Icon name="Upload" size={10} /> Add PDF
                                                </button>
                                                {onOpenMaterialReceivers && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onClose(); onOpenMaterialReceivers(); }}
                                                        className="text-[10px] text-green-700 dark:text-green-400 hover:underline"
                                                    >
                                                        View All →
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="bg-green-50 dark:bg-green-500/5 text-gray-500 dark:text-gray-400">
                                                    <th className="px-3 py-1 text-left font-medium">Date Rcvd</th>
                                                    <th className="px-3 py-1 text-left font-medium">Design / Code</th>
                                                    <th className="px-3 py-1 text-right font-medium">Qty</th>
                                                    <th className="px-3 py-1 text-left font-medium">Source</th>
                                                    <th className="px-3 py-1 w-6"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {linkedMaterials.map((m, i) => {
                                                    const d = m.dateReceived || m.date_received || m.transactionDate || '';
                                                    const fmtD = d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
                                                    const code = m.posterCode || m.designCode || m.description || '—';
                                                    const src = m.client || m.printer || '—';
                                                    return (
                                                        <tr key={m.id || i} className="border-t border-green-100 dark:border-green-500/10 group/row">
                                                            <td className="px-3 py-1 font-mono text-gray-600 dark:text-gray-400">{fmtD}</td>
                                                            <td className="px-3 py-1 font-medium text-gray-800 dark:text-gray-200">{code}</td>
                                                            <td className="px-3 py-1 text-right font-mono font-bold text-gray-800 dark:text-gray-200">{m.quantity || 0}</td>
                                                            <td className="px-3 py-1 text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={src}>{src}</td>
                                                            <td className="px-1 py-1">
                                                                {onRemoveMaterial && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (confirm('Remove this receiver?')) onRemoveMaterial(m.id);
                                                                        }}
                                                                        className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                                                        title="Remove receiver"
                                                                    >
                                                                        <Icon name="X" size={12} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {pdfFeedback && (
                                            <div className="px-3 py-1 text-[10px] text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-500/5 border-t border-green-100">
                                                {pdfFeedback}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button onClick={handleCopyToWebmail} className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded flex justify-center gap-2 hover:bg-blue-700"><Icon name="Copy" size={16}/> {copyFeedback || "Copy Email"}</button>
                                </div>
                            </div>
                        )}

                        {/* PREVIEW */}
                        <div className="border dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-950 p-4 h-64 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{ __html: emailDraft }} />
                        </div>
                    </div>

                    {/* LINKED PROOFS */}
                    {linkedProofs.length > 0 && (
                        <div className="px-8 py-3 border-t dark:border-slate-700 bg-green-50/50 dark:bg-green-500/5">
                            <div className="flex items-center justify-between p-2 bg-green-100/60 border border-green-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Icon name="Sparkles" size={14} className="text-green-600" />
                                    <span className="text-xs font-medium text-green-800">
                                        {linkedProofs.length} proof{linkedProofs.length !== 1 ? 's' : ''} linked from Creative Hub
                                    </span>
                                </div>
                                {onOpenCreativeHub && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onClose(); onOpenCreativeHub(); }}
                                        className="text-[10px] text-green-700 hover:text-green-900 underline"
                                    >
                                        View →
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* HISTORY FOOTER */}
                    {item.history && item.history.length > 0 && (
                        <div className="px-8 py-3 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900 max-h-32 overflow-y-auto">
                            <h4 className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <Icon name="History" size={10} /> CHANGE HISTORY
                            </h4>
                            <div className="space-y-2">
                                {[...item.history].reverse().map((entry, idx) => {
                                    const date = new Date(entry.timestamp);
                                    const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
                                                   date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                                    return (
                                        <div key={idx} className="text-[10px]">
                                            <span className="text-gray-400">{timeStr}</span>
                                            <span className="text-gray-600 ml-2">{entry.changes.join(' • ')}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
