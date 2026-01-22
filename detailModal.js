// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL - Campaign Details & Email Generator Component
// Extracted from index.html for Babel optimization
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect } = React;

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

    const DetailModal = ({ item, onClose, onSave, onLogEmail }) => {
        // Initialize dependencies on first render
        useEffect(() => { initDependencies(); }, []);

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

        // Template logic
        const [selectedTemplate, setSelectedTemplate] = useState('auto');
        const [issueReason, setIssueReason] = useState('');
        const [newEta, setNewEta] = useState('');
        const [missingType, setMissingType] = useState('instructions');
        const [deadlineDate, setDeadlineDate] = useState('End of Day Today');
        const [showInstallControls, setShowInstallControls] = useState(false);

        // Material breakdown for inventory
        const [materialBreakdown, setMaterialBreakdown] = useState([{ code: '', qty: '', link: '' }]);

        // Helper: Calculate inventory status
        const getInventoryStatus = () => {
            const required = parseFloat(customQty) || 0;
            const currentTotal = materialBreakdown.reduce((acc, row) => acc + (parseFloat(row.qty) || 0), 0);
            return { currentTotal, isSufficient: currentTotal >= required };
        };

        // Row handlers
        const addRow = () => setMaterialBreakdown([...materialBreakdown, { code: '', qty: '', link: '' }]);
        const removeRow = (index) => {
            const newRows = materialBreakdown.filter((_, i) => i !== index);
            setMaterialBreakdown(newRows.length ? newRows : [{ code: '', qty: '', link: '' }]);
        };
        const updateRow = (index, field, value) => {
            const newRows = [...materialBreakdown];
            newRows[index][field] = value;
            setMaterialBreakdown(newRows);
        };

        useEffect(() => {
            if (item) {
                setNewStage(item.stage);
                setNewInstalledCount(item.totalInstalled || item.installed || 0);
                setEditingInstallCount(false);

                // Initialize original and adjusted quantity
                const origQty = item.quantity || item.totalQty || 0;
                setOriginalQty(origQty);
                // Check if item has an adjustedQty override
                setAdjustedQty(item.adjustedQty || null);
                setEditingAdjustedQty(false);

                // Load saved material data
                const uniqueKey = `${item.id}_${item.date}`;
                const savedMaterialData = JSON.parse(localStorage.getItem('stap_material_data') || '{}');
                const savedData = savedMaterialData[uniqueKey];

                if (savedData) {
                    setCustomQty(savedData.totalQty || item.quantity || item.totalQty || '0');
                    setEmailInstalledQty(savedData.installed || item.totalInstalled || item.installed || '0');
                    setCustomDesigns(savedData.mediaType || item.media || item.product || '');
                    setCustomPhotosLink(savedData.photosLink || '');
                    setCustomReceiverLink(savedData.receiverLink || '');
                    if (savedData.materialBreakdown && savedData.materialBreakdown.length > 0) {
                        setMaterialBreakdown(savedData.materialBreakdown);
                    } else {
                        setMaterialBreakdown([{ code: '', qty: '', link: '' }]);
                    }
                } else {
                    setCustomQty(item.quantity || item.totalQty || '0');
                    setEmailInstalledQty(item.totalInstalled || item.installed || '0');
                    setCustomDesigns(item.media || item.product || '');
                    setCustomPhotosLink('');
                    setCustomReceiverLink('');
                    setMaterialBreakdown([{ code: '', qty: '', link: '' }]);
                }

                setIssueReason('');
                setNewEta('');
                setSelectedTemplate('auto');
                setShowInstallControls(true);
            }
        }, [item]);

        // Sync email template values with INSTALL PROGRESS values
        useEffect(() => {
            const effectiveQty = parseInt(adjustedQty) || item?.adjustedQty || originalQty || 0;
            setCustomQty(effectiveQty.toString());
        }, [adjustedQty, originalQty, item?.adjustedQty]);

        useEffect(() => {
            setEmailInstalledQty(newInstalledCount.toString());
        }, [newInstalledCount]);

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
            return `<div style='font-family:Arial,sans-serif; max-width:520px; color:#333;'>
                <div style='background:#007bff; padding:12px 15px; color:white;'><strong style='font-size:16px;'>📅 Installation Scheduled</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Work orders have been submitted for scheduling:</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:110px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
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
            return `<div style='font-family:Arial,sans-serif; max-width:520px; color:#333;'>
                <div style='background:#28a745; padding:12px 15px; color:white;'><strong style='font-size:16px;'>✅ Installation Complete</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Great news! This campaign is now <strong>fully installed</strong>.</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:110px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
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
            return `<div style='font-family:Arial,sans-serif; max-width:520px; color:#333;'>
                <div style='background:#dc3545; padding:12px 15px; color:white;'><strong style='font-size:16px;'>⚠️ HOLD — Missing Assets</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 10px;'>This campaign is <strong>on hold</strong>. We are missing:</p>
                    <p style='margin:0 0 15px; padding:10px; background:#fff5f5; border-left:3px solid #dc3545; color:#c92a2a;'><strong>${missingText}</strong></p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:110px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
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
            return `<div style='font-family:Arial,sans-serif; max-width:520px; color:#333;'>
                <div style='background:#fd7e14; padding:12px 15px; color:white;'><strong style='font-size:16px;'>🚧 Installation Delay</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Please be advised of a schedule change for this campaign:</p>
                    <div style='margin:0 0 15px; padding:10px; background:#fff3cd; border-left:3px solid #fd7e14;'>
                        <strong>Reason:</strong> ${issueReason || 'Weather/Access'}<br/>
                        <strong>New Target:</strong> ${newEta || 'TBD'}
                    </div>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:110px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
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
            return `<div style='font-family:Arial,sans-serif; max-width:520px; color:#333;'>
                <div style='background:#20c997; padding:12px 15px; color:white;'><strong style='font-size:16px;'>🛠️ Maintenance Resolved</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Maintenance has been completed for this campaign:</p>
                    <p style='margin:0 0 15px; padding:10px; background:#e6fffa; border-left:3px solid #20c997; color:#0ca678;'><strong>Action Taken:</strong> ${issueReason || 'Repairs completed'}</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:110px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
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
            return `<div style='font-family:Arial,sans-serif; max-width:520px; color:#333;'>
                <div style='background:#6c757d; padding:12px 15px; color:white;'><strong style='font-size:16px;'>🗑️ Removal Confirmed</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>All materials have been removed for this campaign.</p>
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:110px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
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
            // Bug 3 fix: Only include rows that have actual data (code or qty)
            const validRows = materialBreakdown.filter(row => row.code || row.qty);
            const breakdownRows = validRows.map(row => {
                const codeDisplay = row.link
                    ? `<a href="${row.link}" style="color: #6f42c1; font-weight: bold; text-decoration: underline;" target="_blank">${row.code || 'N/A'}</a>`
                    : (row.code || 'N/A');
                return `<tr><td style='padding:6px 10px; border-bottom:1px solid #eee;'>${codeDisplay}</td><td style='padding:6px 10px; border-bottom:1px solid #eee; text-align:right;'>${row.qty || 0}</td></tr>`;
            }).join('');

            const { isSufficient, currentTotal } = getInventoryStatus();
            const required = parseFloat(customQty) || 0;
            const overage = currentTotal - required;

            let statusColor, statusText, statusIcon;
            if (currentTotal >= required) {
                statusColor = '#28a745';
                statusIcon = '✅';
                statusText = 'Inventory Sufficient';
            } else {
                statusColor = '#dc3545';
                statusIcon = '❌';
                statusText = 'Inventory Shortage';
            }

            const overageNote = currentTotal >= required
                ? (overage > 0 ? ` (+${overage} overage)` : '')
                : ` (short ${required - currentTotal})`;

            const noOverageNote = (currentTotal === required && currentTotal > 0) ? `
                <p style='margin:10px 0; padding:8px; background:#fff8e6; border-left:3px solid #ffc107; font-size:12px; color:#856404;'>
                    💡 No overage included — consider ordering backup material.
                </p>
            ` : '';

            return `<div style='font-family:Arial,sans-serif; max-width:520px; color:#333;'>
                <div style='background:#6f42c1; padding:12px 15px; color:white;'><strong style='font-size:16px;'>📦 Materials Received</strong></div>
                <div style='padding:15px; background:#fff; border:1px solid #ddd; border-top:none;'>
                    <p style='margin:0 0 12px;'>Hi ${item.owner || 'Team'},</p>
                    <p style='margin:0 0 15px;'>Materials have landed in the warehouse and are being processed. Work orders are being drafted.</p>
                    <p style='margin:0 0 15px; padding:10px; background:#f8f9fa; border-left:3px solid ${statusColor};'>
                        <strong>Inventory Status:</strong> ${statusIcon} ${statusText}${overageNote}<br/>
                        <span style="font-size:12px; color:#666;">Received: ${currentTotal} / Required: ${customQty || '0'}</span>
                    </p>
                    ${noOverageNote}
                    ${validRows.length > 0 ? `<table style='width:100%; font-size:12px; border-collapse:collapse; margin:0 0 15px; background:#faf8ff;'>
                        <tr style='background:#6f42c1; color:white;'><th style='padding:8px 10px; text-align:left;'>Design Code</th><th style='padding:8px 10px; text-align:right;'>Qty</th></tr>
                        ${breakdownRows}
                    </table>` : ''}
                    <table style='width:100%; font-size:13px; border-collapse:collapse; background:#f8f9fa; border-radius:4px;'>
                        <tr><td style='padding:8px 10px; color:#666; width:110px; border-bottom:1px solid #eee;'>Advertiser</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${item.advertiser || 'N/A'}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Campaign</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.id || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Flight Name</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.name || 'N/A'}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Media Type</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'><strong>${formatMediaType(customDesigns)}</strong></td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Market</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${formatMarketName(item.market)}</td></tr>
                        <tr><td style='padding:8px 10px; color:#666; border-bottom:1px solid #eee;'>Product Dates</td><td style='padding:8px 10px; border-bottom:1px solid #eee;'>${item.date || 'N/A'} — ${item.endDate || 'TBD'}</td></tr>
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

        // Template router effect
        useEffect(() => {
            if (!item) return;
            let mode = selectedTemplate;

            if (mode === 'auto') {
                if (item.stage === "Installed") mode = 'complete';
                else if (item.stage === "Material Ready For Install") mode = 'material_received';
                else if (item.stage.includes("Pending")) mode = 'missing';
                else if (item.stage.includes("Expired") || item.stage.includes("Completed") || item.stage === "Takedown Complete") mode = 'removal';
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
        }, [customQty, emailInstalledQty, selectedTemplate, item, materialBreakdown, customDesigns, customPhotosLink, customReceiverLink, issueReason, newEta, missingType, deadlineDate]);

        const handleCopyToWebmail = async () => {
            try {
                const blobHtml = new Blob([emailDraft], { type: "text/html" });
                const blobText = new Blob([emailDraft], { type: "text/plain" });
                const data = [new ClipboardItem({ ["text/html"]: blobHtml, ["text/plain"]: blobText })];
                await navigator.clipboard.write(data);

                if(onLogEmail) onLogEmail(`${item.id}_${item.date}`);
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

                    if(onLogEmail) onLogEmail(`${item.id}_${item.date}`);
                    setCopyFeedback("✅ Copied!");
                    setTimeout(() => setCopyFeedback(""), 2000);
                } catch (e) {
                    setCopyFeedback("❌ Failed to copy");
                }
            }
        };

        const handleSave = () => {
            const uniqueKey = `${item.id}_${item.date}`;
            const saveData = {
                installed: newInstalledCount,
                materialBreakdown: materialBreakdown.filter(row => row.code || row.qty),
                photosLink: customPhotosLink || null,
                receiverLink: customReceiverLink || null,
                mediaType: customDesigns || null,
                totalQty: customQty || null
            };
            onSave(uniqueKey, newStage, saveData);
            setEditMode(false);
            setEditingInstallCount(false);
        };

        const handleSaveInstallCount = () => {
            const uniqueKey = `${item.id}_${item.date}`;
            // Calculate pending using adjustedQty if set, otherwise original qty
            const targetQty = parseInt(adjustedQty) || item.adjustedQty || originalQty || 0;
            const newPending = Math.max(0, targetQty - newInstalledCount);

            // Auto-stage logic: when pending = 0, auto-set to "Installed"
            let newStage = item.stage;
            let saveData = {
                installed: newInstalledCount,
                pending: newPending
            };

            if (newPending === 0 && newInstalledCount > 0 && item.stage !== 'Installed') {
                // Store previous stage for reversal, then set to Installed
                saveData.previousStage = item.previousStage || item.stage;
                newStage = 'Installed';
                setNewStage('Installed');
            } else if (newPending > 0 && item.previousStage && item.stage === 'Installed') {
                // Revert to previous stage when pending > 0 again
                newStage = item.previousStage;
                saveData.previousStage = null; // Clear the stored previous stage
                setNewStage(item.previousStage);
            }

            onSave(uniqueKey, newStage, saveData);
            setEditingInstallCount(false);
        };

        // Save adjusted quantity override
        const handleSaveAdjustedQty = () => {
            const uniqueKey = `${item.id}_${item.date}`;
            const adjQty = parseInt(adjustedQty) || null;
            // Validate: adjusted qty must be >= installed count
            const installed = newInstalledCount || 0;
            if (adjQty !== null && adjQty < installed) {
                alert(`Adjusted quantity (${adjQty}) cannot be less than installed count (${installed})`);
                return;
            }
            // Save adjustedQty and recalculated pending
            const newPending = adjQty !== null ? Math.max(0, adjQty - installed) : undefined;

            // Auto-stage logic: when pending = 0, auto-set to "Installed"
            let newStage = item.stage;
            let saveData = {
                adjustedQty: adjQty,
                pending: newPending
            };

            if (newPending === 0 && installed > 0 && item.stage !== 'Installed') {
                // Store previous stage for reversal, then set to Installed
                saveData.previousStage = item.previousStage || item.stage;
                newStage = 'Installed';
                setNewStage('Installed');
            } else if (newPending > 0 && item.previousStage && item.stage === 'Installed') {
                // Revert to previous stage when pending > 0 again
                newStage = item.previousStage;
                saveData.previousStage = null; // Clear the stored previous stage
                setNewStage(item.previousStage);
            }

            onSave(uniqueKey, newStage, saveData);
            setEditingAdjustedQty(false);
        };

        // Clear adjusted quantity override
        const handleClearAdjustedQty = () => {
            const uniqueKey = `${item.id}_${item.date}`;
            // When clearing, recalculate pending with original qty
            const installed = newInstalledCount || 0;
            const newPending = Math.max(0, originalQty - installed);

            // Check if we need to revert stage
            let newStage = item.stage;
            let saveData = { adjustedQty: null, pending: newPending };

            if (newPending > 0 && item.previousStage && item.stage === 'Installed') {
                // Revert to previous stage
                newStage = item.previousStage;
                saveData.previousStage = null;
                setNewStage(item.previousStage);
            }

            onSave(uniqueKey, newStage, saveData);
            setAdjustedQty(null);
            setEditingAdjustedQty(false);
        };

        const handleSaveAllData = () => {
            const uniqueKey = `${item.id}_${item.date}`;
            const saveData = {
                installed: newInstalledCount,
                materialBreakdown: materialBreakdown.filter(row => row.code || row.qty),
                photosLink: customPhotosLink || null,
                receiverLink: customReceiverLink || null,
                mediaType: customDesigns || null,
                totalQty: customQty || null
            };
            onSave(uniqueKey, item.stage, saveData);
            alert('✅ Data saved! Material info synced to Material Receiver & POP Gallery.');
        };

        if (!item) return null;

        // Get current dependencies
        initDependencies();

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="px-8 py-6 border-b bg-gray-50 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                {editMode ? (
                                    <div className="flex items-center gap-2">
                                        <select value={newStage} onChange={(e) => setNewStage(e.target.value)} className="border rounded px-2">
                                            {ALL_STAGES.map(s => <option key={s}>{s}</option>)}
                                        </select>
                                        <button onClick={handleSave} className="text-green-600"><Icon name="Save" size={18}/></button>
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
                        <button onClick={onClose}><Icon name="X" size={24} /></button>
                    </div>

                    {/* Body */}
                    <div className="p-8 overflow-y-auto">
                        {/* Standard Data Grid */}
                        <div className="grid grid-cols-2 gap-6 mb-4">
                            <div className="bg-gray-50 p-4 rounded border">
                                <h4 className="font-bold text-xs text-gray-500 mb-2">SCHEDULE</h4>
                                <p className="text-sm"><strong>Start:</strong> {item.date}</p>
                                <p className="text-sm"><strong>End:</strong> {item.endDate}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded border">
                                <h4 className="font-bold text-xs text-gray-500 mb-2">INSTALL PROGRESS</h4>
                                {/* Installed Row */}
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm"><strong>Installed:</strong></span>
                                    {editingInstallCount ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={newInstalledCount}
                                                onChange={(e) => setNewInstalledCount(parseInt(e.target.value) || 0)}
                                                className="w-16 px-2 py-1 border rounded text-sm"
                                                min="0"
                                                max={adjustedQty || item.adjustedQty || originalQty || 999}
                                            />
                                            <button onClick={handleSaveInstallCount} className="text-green-600 hover:text-green-700" title="Save">
                                                <Icon name="Check" size={16} />
                                            </button>
                                            <button onClick={() => { setEditingInstallCount(false); setNewInstalledCount(item.totalInstalled || item.installed || 0); }} className="text-gray-400 hover:text-gray-600" title="Cancel">
                                                <Icon name="X" size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span
                                            onClick={() => setEditingInstallCount(true)}
                                            className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 transition-colors text-sm font-medium"
                                            title="Click to edit installed count"
                                        >
                                            {newInstalledCount} <Icon name="Edit" size={10} className="inline ml-1 opacity-50"/>
                                        </span>
                                    )}
                                </div>
                                {/* Pending Row - calculated locally from qty and installed */}
                                {(() => {
                                    const targetQty = parseInt(adjustedQty) || item.adjustedQty || originalQty || 0;
                                    const installed = newInstalledCount || 0;
                                    const pending = Math.max(0, targetQty - installed);
                                    return (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">
                                                <strong>Pending:</strong>{' '}
                                                <span className={pending > 0 ? 'text-orange-600 font-bold' : 'text-green-600 font-bold'}>
                                                    {pending}
                                                </span>
                                                {pending === 0 && installed > 0 && (
                                                    <span className="ml-2 text-green-600 text-xs">Complete!</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })()}
                                {item.isOverridden && (
                                    <div className="mt-2 text-xs text-purple-600 flex items-center gap-1">
                                        <Icon name="Edit" size={10} /> Manual override active
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quantity Reconciliation One-Liner */}
                        {(() => {
                            const booked = originalQty || 0;
                            const charted = parseInt(adjustedQty) || item.adjustedQty || null;
                            const statusConfig = charted === null
                                ? { bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: 'CircleDashed', text: 'Not Verified' }
                                : charted === booked
                                    ? { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', icon: 'CheckCircle', text: 'Matched' }
                                    : charted < booked
                                        ? { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: 'AlertTriangle', text: `${booked - charted} Unlinked` }
                                        : { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: 'TrendingUp', text: `+${charted - booked} Over` };
                            return (
                                <div className={`mb-6 p-3 rounded-lg border ${statusConfig.bg} flex items-center justify-between`}>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 font-medium">Booked (SF):</span>
                                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-sm font-mono font-bold">{booked}</span>
                                        </div>
                                        <div className="text-gray-300">|</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 font-medium">Charted:</span>
                                            {editingAdjustedQty ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        value={adjustedQty || ''}
                                                        onChange={(e) => setAdjustedQty(e.target.value)}
                                                        className="w-16 px-2 py-0.5 border rounded text-sm"
                                                        min="0"
                                                        placeholder={booked}
                                                        autoFocus
                                                    />
                                                    <button onClick={handleSaveAdjustedQty} className="text-green-600 hover:text-green-700" title="Save">
                                                        <Icon name="Check" size={14} />
                                                    </button>
                                                    <button onClick={() => { setEditingAdjustedQty(false); setAdjustedQty(item.adjustedQty || null); }} className="text-gray-400 hover:text-gray-600" title="Cancel">
                                                        <Icon name="X" size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span
                                                    onClick={() => { setAdjustedQty(adjustedQty || item.adjustedQty || booked); setEditingAdjustedQty(true); }}
                                                    className={`px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-colors text-sm font-mono font-bold ${
                                                        charted !== null ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 border border-dashed border-gray-300'
                                                    }`}
                                                    title="Click to verify charted units"
                                                >
                                                    {charted !== null ? charted : '--'}
                                                    <Icon name="Edit" size={10} className="inline ml-1 opacity-50"/>
                                                </span>
                                            )}
                                            {charted !== null && !editingAdjustedQty && (
                                                <button onClick={handleClearAdjustedQty} className="text-gray-400 hover:text-red-500" title="Clear">
                                                    <Icon name="X" size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${statusConfig.badge}`}>
                                        <Icon name={statusConfig.icon} size={12} /> {statusConfig.text}
                                    </span>
                                </div>
                            );
                        })()}

                        {/* Production Proof Selector */}
                        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
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
                                            const uniqueKey = `${item.id}_${item.date}`;
                                            onSave(uniqueKey, item.stage, { productionProof: 'in-house' });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                            item.productionProof === 'in-house'
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50'
                                        }`}
                                    >
                                        <Icon name="Home" size={12} /> In-House
                                    </button>
                                    <button
                                        onClick={() => {
                                            const uniqueKey = `${item.id}_${item.date}`;
                                            onSave(uniqueKey, item.stage, { productionProof: 'client' });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                            item.productionProof === 'client'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'
                                        }`}
                                    >
                                        <Icon name="Upload" size={12} /> Client
                                    </button>
                                    <button
                                        onClick={() => {
                                            const uniqueKey = `${item.id}_${item.date}`;
                                            onSave(uniqueKey, item.stage, { productionProof: 'mixed' });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                            item.productionProof === 'mixed'
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
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
                            <div className="mb-4 p-4 bg-gray-50 border rounded-lg">
                                {/* Missing Asset Options */}
                                {selectedTemplate === 'missing' && (
                                    <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded">
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
                                    <div className="mb-4 bg-gray-50 border rounded p-3">
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
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold text-gray-500">Inventory Breakdown</label>
                                            <span className={`text-xs font-bold ${getInventoryStatus().isSufficient ? 'text-green-600' : 'text-red-500'}`}>
                                                Received: {getInventoryStatus().currentTotal} / {customQty || 0}
                                            </span>
                                        </div>
                                        <div className="space-y-2 mb-2">
                                            {materialBreakdown.map((row, idx) => (
                                                <div key={idx} className="flex gap-2">
                                                    <input
                                                        placeholder="Design Code"
                                                        value={row.code}
                                                        onChange={e => updateRow(idx, 'code', e.target.value)}
                                                        className="flex-1 text-sm border rounded px-2 py-1"
                                                    />
                                                    <input
                                                        placeholder="Qty"
                                                        type="number"
                                                        value={row.qty}
                                                        onChange={e => updateRow(idx, 'qty', e.target.value)}
                                                        className="w-16 text-sm border rounded px-2 py-1"
                                                    />
                                                    <input
                                                        placeholder="Google Drive Link"
                                                        value={row.link}
                                                        onChange={e => updateRow(idx, 'link', e.target.value)}
                                                        className="flex-1 text-sm border border-purple-200 rounded px-2 py-1"
                                                        title="Paste Google Drive link for poster image/PDF"
                                                    />
                                                    <button onClick={() => removeRow(idx)} className="text-red-400"><Icon name="X" size={16} /></button>
                                                </div>
                                            ))}
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

                                {/* Photos & Receiver Links */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div><label className="text-xs font-bold text-green-700">📸 Photos Link</label><input type="text" value={customPhotosLink} onChange={(e)=>setCustomPhotosLink(e.target.value)} className="w-full text-sm border border-green-200 rounded px-2 py-1" placeholder="POP folder URL..."/></div>
                                    <div><label className="text-xs font-bold text-blue-700">📄 Receiver Link</label><input type="text" value={customReceiverLink} onChange={(e)=>setCustomReceiverLink(e.target.value)} className="w-full text-sm border border-blue-200 rounded px-2 py-1" placeholder="Receiver PDF URL..."/></div>
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={handleCopyToWebmail} className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded flex justify-center gap-2 hover:bg-blue-700"><Icon name="Copy" size={16}/> {copyFeedback || "Copy Email"}</button>
                                    <button onClick={handleSaveAllData} className="px-4 py-2 bg-green-600 text-white font-bold rounded flex justify-center gap-2 hover:bg-green-700" title="Save to Material Receiver & POP Gallery"><Icon name="Save" size={16}/> Save</button>
                                </div>
                            </div>
                        )}

                        {/* PREVIEW */}
                        <div className="border rounded bg-white p-4 h-64 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{ __html: emailDraft }} />
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
