// ═══════════════════════════════════════════════════════════════════════════════
// STAP Material Receivers - Shipment Tracking Component
// External module for LA STAP Operations Portal
// Must load AFTER icon.js (depends on window.STAP_Icon)
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;
    
    // Get Icon from global export
    const Icon = window.STAP_Icon || (({ name }) => React.createElement('span', { title: name }, '?'));

    const MaterialReceivers = ({ data: rawData, onBack, setView, setIsLiveMode, materials, setMaterials, linkedSheet, setLinkedSheet }) => {
        const data = Array.isArray(rawData) ? rawData : [];
        
        // State
        const [viewMode, setViewMode] = useState('cards'); // 'cards', 'list', 'timeline'
        const [selectedClient, setSelectedClient] = useState('ALL');
        const [selectedStatus, setSelectedStatus] = useState('ALL');
        const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
        const [searchTerm, setSearchTerm] = useState('');
        const [selectedReceipt, setSelectedReceipt] = useState(null);
        // materials and linkedSheet are now passed as props from parent
        const [showAnalytics, setShowAnalytics] = useState(false); // Start collapsed for better fit
        const [showLinkModal, setShowLinkModal] = useState(false);
        const [sheetUrl, setSheetUrl] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const [connectionError, setConnectionError] = useState('');
        const [lastSync, setLastSync] = useState(null);
        
        // Inline Editing State
        const [editingCell, setEditingCell] = useState(null); // { id, field }
        const [editValue, setEditValue] = useState('');
        
        // Campaign Assignment State (for PDF import)
        const [showCampaignAssign, setShowCampaignAssign] = useState(false);
        const [pendingPdfResults, setPendingPdfResults] = useState([]);
        const [campaignSearchTerm, setCampaignSearchTerm] = useState('');
        
        // PDF Upload State
        const [pdfProcessing, setPdfProcessing] = useState(false);
        const [pdfProgress, setPdfProgress] = useState('');
        const [pdfResults, setPdfResults] = useState([]);
        
        // Google Apps Script Webhook State (for bidirectional sync)
        const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('stap_material_webhook') || '');
        const [webhookSending, setWebhookSending] = useState(false);
        const [webhookStatus, setWebhookStatus] = useState('');
        const [showWebhookSetup, setShowWebhookSetup] = useState(false);
        
        // Column mapping for Google Sheet
        const [columnMapping, setColumnMapping] = useState({
            receiptNumber: 'Receipt #',
            dateReceived: 'Date',
            description: 'Description',
            posterCode: 'Poster Code',
            client: 'Client',
            printer: 'Printer',
            quantity: 'Qty',
            boxes: 'Boxes',
            designs: 'Designs',
            comments: 'Comments',
            status: 'Status',
            warehouseLocation: 'Location'
        });
        
        // AUTO-SYNC: Check master tracker for installed campaigns and update material status
        useEffect(() => {
            if (!data || data.length === 0 || !materials || materials.length === 0) return;
            
            let hasChanges = false;
            const updatedMaterials = materials.map(material => {
                // Skip if no campaign linked or already installed
                if (!material.campaignId || material.status === 'Installed') return material;
                
                // Find linked campaign in master tracker
                const linkedCampaign = data.find(c => 
                    (c['Campaign ID'] || c.id) === material.campaignId
                );
                
                if (linkedCampaign) {
                    const stage = (linkedCampaign['Install Stage'] || '').toLowerCase();
                    let updatedMaterial = { ...material };

                    // Sync deployedQty from campaign's actual install count
                    const installed = parseInt(linkedCampaign.installed || linkedCampaign['Installed'] || 0);
                    const totalQty = parseInt(linkedCampaign['Qty'] || linkedCampaign.qty || 0);
                    if (totalQty > 0 && installed > 0) {
                        const share = Math.round((material.quantity / totalQty) * installed);
                        updatedMaterial.deployedQty = Math.min(share, material.quantity);
                        hasChanges = true;
                    }

                    // Auto-update to Installed if campaign is installed
                    if (stage.includes('installed') || stage.includes('photos taken') || stage.includes('pop complete')) {
                        hasChanges = true;
                        console.log(`📦 Auto-updating material ${material.receiptNumber} to Installed (campaign ${material.campaignId} is ${stage})`);
                        updatedMaterial.status = 'Installed';
                        return updatedMaterial;
                    }

                    // Auto-update to Fully Deployed if campaign is material ready
                    if (stage.includes('material ready') && material.status !== 'Fully Deployed' && material.status !== 'Installed') {
                        hasChanges = true;
                        updatedMaterial.status = 'Fully Deployed';
                        return updatedMaterial;
                    }

                    return updatedMaterial;
                }
                
                return material;
            });
            
            if (hasChanges) {
                setMaterials(updatedMaterials);
            }
        }, [data]); // Re-run when master tracker data changes
        
        // Save webhook URL to localStorage
        const saveWebhookUrl = (url) => {
            setWebhookUrl(url);
            localStorage.setItem('stap_material_webhook', url);
        };
        
        // Send data to Google Apps Script webhook
        const sendToGoogleSheet = async (dataToSend) => {
            if (!webhookUrl) {
                setWebhookStatus('⚠️ No webhook URL configured');
                return false;
            }
            
            setWebhookSending(true);
            setWebhookStatus('Sending to Google Sheet...');
            
            try {
                const payload = {
                    action: 'append',
                    data: dataToSend.map(item => ({
                        receiptNumber: item.receiptNumber || '',
                        dateReceived: item.dateReceived instanceof Date 
                            ? item.dateReceived.toLocaleDateString() 
                            : item.dateReceived || new Date().toLocaleDateString(),
                        client: item.client || item.advertiser || '',
                        description: item.description || '',
                        posterCode: item.posterCode || '',
                        quantity: item.quantity || 0,
                        printer: item.printer || '',
                        status: item.status || 'Received',
                        comments: item.comments || '',
                        thumbnailUrl: item.posterImage || '',
                        pdfSource: item.pdfSource || '',
                        timestamp: new Date().toISOString()
                    }))
                };
                
                console.log('📤 Sending to webhook:', webhookUrl);
                console.log('📦 Payload:', payload);
                
                await fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                setWebhookStatus(`✅ Sent ${dataToSend.length} item(s) to Google Sheet!`);
                return true;
                
            } catch (err) {
                console.error('Webhook error:', err);
                setWebhookStatus(`❌ Error: ${err.message}`);
                return false;
            } finally {
                setWebhookSending(false);
            }
        };

        // ============================================
        // INLINE CELL EDITING
        // ============================================
        const startEditing = (id, field, currentValue) => {
            setEditingCell({ id, field });
            setEditValue(currentValue || '');
        };
        
        const saveEdit = async () => {
            if (!editingCell) return;
            
            const { id, field } = editingCell;
            const newValue = field === 'quantity' ? parseInt(editValue) || 0 : editValue;
            
            // Update local state
            setMaterials(prev => prev.map(m => 
                m.id === id ? { ...m, [field]: newValue } : m
            ));
            
            // Sync to Google Sheet if webhook configured
            if (webhookUrl) {
                try {
                    const material = materials.find(m => m.id === id);
                    if (material) {
                        const updatedMaterial = { ...material, [field]: newValue };
                        await fetch(webhookUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'update',
                                receiptNumber: updatedMaterial.receiptNumber,
                                field: field,
                                value: newValue,
                                data: [{
                                    receiptNumber: updatedMaterial.receiptNumber,
                                    dateReceived: updatedMaterial.dateReceived,
                                    client: updatedMaterial.client,
                                    description: updatedMaterial.description,
                                    posterCode: updatedMaterial.posterCode,
                                    quantity: updatedMaterial.quantity,
                                    printer: updatedMaterial.printer,
                                    status: updatedMaterial.status,
                                    comments: updatedMaterial.comments || '',
                                    thumbnailUrl: updatedMaterial.posterImage || '',
                                    pdfSource: updatedMaterial.pdfSource || '',
                                    timestamp: new Date().toISOString()
                                }]
                            })
                        });
                        console.log('✅ Synced edit to Google Sheet');
                    }
                } catch (err) {
                    console.error('Failed to sync edit:', err);
                }
            }
            
            setEditingCell(null);
            setEditValue('');
        };
        
        const cancelEdit = () => {
            setEditingCell(null);
            setEditValue('');
        };
        
        // Editable Cell Component
        const EditableCell = ({ material, field, className = '', type = 'text' }) => {
            const isEditing = editingCell?.id === material.id && editingCell?.field === field;
            const value = material[field];
            
            if (isEditing) {
                return (
                    <input
                        type={type}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                        }}
                        className={`w-full px-2 py-1 border-2 border-orange-400 rounded focus:outline-none focus:ring-2 focus:ring-orange-300 ${className}`}
                        autoFocus
                    />
                );
            }
            
            // Safely convert value to string for display
            const displayValue = value === null || value === undefined
                ? '-'
                : typeof value === 'object'
                    ? (value instanceof Date ? value.toLocaleDateString() : JSON.stringify(value))
                    : String(value);

            return (
                <span
                    onClick={(e) => {
                        e.stopPropagation();
                        startEditing(material.id, field, value);
                    }}
                    className={`cursor-pointer hover:bg-orange-100 px-2 py-1 rounded block ${className}`}
                    title="Click to edit"
                >
                    {displayValue || '-'}
                </span>
            );
        };

        // ============================================
        // PDF UPLOAD & PARSING
        // ============================================
        const handlePdfUpload = async (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            
            setPdfProcessing(true);
            setPdfProgress('Starting PDF processing...');
            setConnectionError('');
            
            const results = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setPdfProgress(`Processing ${file.name} (${i + 1}/${files.length})...`);
                
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    
                    // Get first page for thumbnail
                    const page = await pdf.getPage(1);
                    const scale = 0.5;
                    const viewport = page.getViewport({ scale });
                    
                    // Create canvas for thumbnail
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    await page.render({ canvasContext: context, viewport }).promise;
                    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    // Extract text from all pages
                    let fullText = '';
                    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
                        const textPage = await pdf.getPage(pageNum);
                        const textContent = await textPage.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + ' ';
                    }
                    
                    // Parse extracted text for material data
                    const parsed = parsePdfText(fullText, file.name, thumbnailUrl);
                    results.push(parsed);
                    
                } catch (err) {
                    console.error(`Error processing ${file.name}:`, err);
                    results.push({
                        id: `PDF-ERR-${i}`,
                        receiptNumber: file.name.replace('.pdf', ''),
                        description: `Error: ${err.message}`,
                        status: 'Error',
                        posterImage: null,
                        error: true
                    });
                }
            }
            
            setPdfResults(results);
            setPdfProgress(`Processed ${results.length} PDF(s). Review and import below.`);
            setPdfProcessing(false);
        };
        
        // Parse PDF text to extract material data
        const parsePdfText = (text, fileName, thumbnailUrl) => {
            const upperText = text.toUpperCase();
            
            // Try to extract receipt/invoice number
            // Order: labeled patterns first (Receipt# INV175992), then standalone INV-prefixed
            let receiptNumber = '';
            const invMatch = text.match(/(?:RECEIPT|INVOICE|ORDER)\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]{3,})/i)
                || text.match(/\bPO\s*#\s*([A-Z0-9\-]{3,})/i)
                || text.match(/\b(INV[#\-]?\d{4,})\b/i);
            if (invMatch) {
                receiptNumber = invMatch[1].trim();
            } else {
                // Try filename
                const fileMatch = fileName.match(/(\d{5,})/);
                receiptNumber = fileMatch ? `INV-${fileMatch[1]}` : `INV-${Date.now().toString().slice(-6)}`;
            }
            
            // Extract date - look for common date formats
            let dateReceived = new Date().toLocaleDateString();
            const datePatterns = [
                /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
                /(\d{4}-\d{2}-\d{2})/,
                /(?:DATE|RECEIVED)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i
            ];
            for (const pattern of datePatterns) {
                const match = text.match(pattern);
                if (match) {
                    dateReceived = match[1];
                    break;
                }
            }
            
            // Look for client/advertiser name
            const commonClients = ['NETFLIX', 'NIKE', 'APPLE', 'AMAZON', 'DISNEY', 'WARNER', 'PARAMOUNT', 'UNIVERSAL', 'SONY', 'HBO', 'HULU', 'GOOGLE', 'META', 'FACEBOOK', 'MICROSOFT'];
            let client = '';
            for (const c of commonClients) {
                if (upperText.includes(c)) {
                    client = c;
                    break;
                }
            }
            if (!client) {
                const clientMatch = text.match(/(?:CLIENT|CUSTOMER|ADVERTISER|BILL TO)[:\s]*([^:\n]{2,30}?)(?=\s*(?:Printer|Vendor|Receipt|Invoice|Comments|Date|Qty|Total|Description|\n|$))/i)
                    || text.match(/(?:CLIENT|CUSTOMER|ADVERTISER|BILL TO)[:\s]*([^:\n]{2,30})/i);
                client = clientMatch ? clientMatch[1].trim().substring(0, 30) : 'Unknown Client';
            }
            
            // Extract quantity - look for total or qty
            let quantity = 1;
            const qtyMatch = text.match(/(?:TOTAL\s*(?:QUANTITY|QTY)?|QTY|QUANTITY)[:\s]*(\d+)/i);
            if (qtyMatch) {
                quantity = parseInt(qtyMatch[1]) || 1;
            }
            
            // Extract description - keep it short
            let description = 'Material Receipt';
            const descMatch = text.match(/(?:DESCRIPTION)[:\s]*([^:]{5,50}?)(?=\s*(?:Client|Printer|Comments|Receipt|Invoice|Poster|Code|Date|Qty|Total))/i)
                || text.match(/(?:DESCRIPTION)[:\s]*([^:]{5,40})/i);
            if (descMatch) {
                description = descMatch[1].trim();
            } else {
                // Use campaign name if found
                const campaignMatch = text.match(/(?:CAMPAIGN)[:\s]*([^\n]{5,40})/i);
                if (campaignMatch) {
                    description = campaignMatch[1].trim();
                }
            }
            
            // Extract printer/vendor — stop at next label or colon
            let printer = '';
            const printerMatch = text.match(/(?:PRINTER|VENDOR|SHIP FROM)[:\s]*([A-Za-z][A-Za-z\s&]*?)(?=\s*(?:Comments|Client|Receipt|Invoice|Poster|Code|Date|Qty|Total|Description|\n|$|:))/i);
            if (printerMatch) {
                printer = printerMatch[1].trim().substring(0, 30);
            }
            if (!printer) {
                // Fallback: grab up to the next colon (label boundary)
                const pf = text.match(/(?:PRINTER|VENDOR|SHIP FROM)[:\s]*([^:\n]{2,30})/i);
                if (pf) printer = pf[1].trim().replace(/\s+(Comments|Client|Receipt|Poster|Date|Qty).*$/i, '').trim();
            }
            if (!printer && upperText.includes('CIRCLE GRAPHICS')) {
                printer = 'Circle Graphics';
            }
            
            // Extract poster code if different from receipt
            let posterCode = receiptNumber;
            const codeMatch = text.match(/(?:POSTER\s*CODE|CODE|SKU)[:\s]*([A-Z0-9\-]+)/i);
            if (codeMatch) {
                posterCode = codeMatch[1].trim();
            }

            // Extract comments from PDF
            let pdfComments = '';
            const commMatch = text.match(/(?:COMMENTS|NOTES|REMARKS)[:\s]*(.+?)(?=\s*(?:Receipt|Invoice|Poster|Transaction|Total|Summary|Client|Printer|Date|Qty|\b[A-Z][a-z]+:))/i)
                || text.match(/(?:COMMENTS|NOTES|REMARKS)[:\s]*([^]{3,80})/i);
            if (commMatch) pdfComments = commMatch[1].trim();

            return {
                id: `PDF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                receiptNumber: receiptNumber,
                dateReceived: dateReceived,
                description: description,
                posterCode: posterCode,
                client: client,
                advertiser: client,
                printer: printer || 'Unknown Vendor',
                quantity: quantity,
                boxes: 1,
                designs: 1,
                comments: pdfComments || `Imported from: ${fileName}`,
                status: 'Received',
                warehouseLocation: '',
                posterImage: thumbnailUrl,
                pdfSource: fileName
            };
        };
        
        // Import parsed PDFs to materials
        const handleImportPdfResults = async () => {
            const validResults = pdfResults.filter(r => !r.error);
            if (validResults.length === 0) return;
            
            // First, try to send to Google Sheet if webhook is configured
            if (webhookUrl) {
                const sent = await sendToGoogleSheet(validResults);
                if (sent) {
                    console.log('✅ Data saved to Google Sheet');
                }
            }
            
            // Then add to local state
            setMaterials(prev => [...validResults, ...(prev || [])]);
            setLinkedSheet({ name: `${validResults.length} PDF(s)`, type: 'pdf-import' });
            setLastSync(new Date());
            setPdfResults([]);
            setShowLinkModal(false);
            if (setIsLiveMode) setIsLiveMode(true);
        };

        // Google Apps Script template
        const getAppsScriptCode = () => `// ========================================
// STAP Material Receiver - Auto Sync Script
// ========================================
// SETUP INSTRUCTIONS:
// 1. Open your Google Sheet for Material Receivers
// 2. Go to Extensions → Apps Script
// 3. Delete any existing code, paste this entire script
// 4. Click Deploy → New deployment
// 5. Type: "Web app"
// 6. Execute as: "Me" 
// 7. Who has access: "Anyone"
// 8. Click Deploy, authorize, copy the URL
// 9. Paste URL into STAP Portal webhook field
// ========================================

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Create headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
    'Receipt #', 'Date Received', 'Client', 'Description', 
    'Poster Code', 'Quantity', 'Printer', 'Status', 
    'Comments', 'Thumbnail URL', 'PDF Source', 'Imported At'
      ]);
      // Format header row
      sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    }
    
    // Append data rows
    if (data.action === 'append' && data.data) {
      data.data.forEach(item => {
    sheet.appendRow([
      item.receiptNumber,
      item.dateReceived,
      item.client,
      item.description,
      item.posterCode,
      item.quantity,
      item.printer,
      item.status,
      item.comments,
      item.thumbnailUrl,
      item.pdfSource,
      item.timestamp
    ]);
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      rows: data.data?.length || 0 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'STAP Material Webhook Active',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}`;

        // Webhook Setup Modal
        const WebhookSetupModal = () => {
            if (!showWebhookSetup) return null;
            
            const [localUrl, setLocalUrl] = useState(webhookUrl);
            const [copied, setCopied] = useState(false);
            const [testStatus, setTestStatus] = useState('');
            
            const copyCode = () => {
                navigator.clipboard.writeText(getAppsScriptCode());
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            };
            
            const handleSave = () => {
                saveWebhookUrl(localUrl);
                setShowWebhookSetup(false);
            };
            
            const testWebhook = async () => {
                if (!localUrl) return;
                setTestStatus('Testing...');
                try {
                    await fetch(localUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'test', data: [] })
                    });
                    setTestStatus('✅ Request sent! Check your Google Sheet.');
                } catch (err) {
                    setTestStatus('❌ Error: ' + err.message);
                }
            };
            
            return (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setShowWebhookSetup(false)}>
                    <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                            <div className="text-white">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Icon name="Zap" size={24} /> Setup Google Sheet Auto-Sync
                                </h3>
                                <p className="text-blue-100 text-sm">PDF uploads will automatically save to your Google Sheet</p>
                            </div>
                            <button onClick={() => setShowWebhookSetup(false)} className="text-white/80 hover:text-white p-2">
                                <Icon name="X" size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* How it works */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                                <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                                    <Icon name="RefreshCw" size={18} /> How Bidirectional Sync Works
                                </h4>
                                <div className="text-sm text-green-700 space-y-1">
                                    <p>📤 <strong>Upload PDFs</strong> → Data auto-saves to your Google Sheet</p>
                                    <p>📥 <strong>Open app</strong> → Data auto-loads from your Published Sheet URL</p>
                                    <p>✏️ <strong>Edit in Sheet</strong> → Changes appear when you refresh the app</p>
                                </div>
                            </div>
                            
                            {/* Step 1: Copy Script */}
                            <div>
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                                    Copy the Google Apps Script
                                </h4>
                                <div className="relative">
                                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-[10px] overflow-auto max-h-40 font-mono leading-relaxed">
                                        {getAppsScriptCode()}
                                    </pre>
                                    <button 
                                        onClick={copyCode}
                                        className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                            copied ? 'bg-green-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <Icon name={copied ? "Check" : "Copy"} size={14} />
                                        {copied ? 'Copied!' : 'Copy Code'}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Step 2: Deploy */}
                            <div>
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                    Deploy in Google Sheets
                                </h4>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Open your Material Receiver Google Sheet</li>
                                        <li>Go to <strong>Extensions → Apps Script</strong></li>
                                        <li>Delete existing code, paste the copied script</li>
                                        <li>Click <strong>Deploy → New deployment</strong></li>
                                        <li>Select type: <strong>Web app</strong></li>
                                        <li>Set "Who has access" to <strong>Anyone</strong></li>
                                        <li>Click <strong>Deploy</strong> and authorize</li>
                                        <li>Copy the deployment URL</li>
                                    </ol>
                                </div>
                            </div>
                            
                            {/* Step 3: Paste URL */}
                            <div>
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                    Paste Your Webhook URL
                                </h4>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        placeholder="https://script.google.com/macros/s/.../exec"
                                        value={localUrl}
                                        onChange={e => setLocalUrl(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                    />
                                    <button 
                                        onClick={testWebhook}
                                        disabled={!localUrl}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-medium"
                                    >
                                        Test
                                    </button>
                                </div>
                                {testStatus && (
                                    <p className={`mt-2 text-sm ${testStatus.includes('✅') ? 'text-green-600' : testStatus.includes('❌') ? 'text-red-600' : 'text-gray-600'}`}>
                                        {testStatus}
                                    </p>
                                )}
                            </div>
                            
                            {/* Reminder about Published URL */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h5 className="font-bold text-blue-800 text-sm mb-1">📋 Don't forget!</h5>
                                <p className="text-sm text-blue-700">
                                    Also publish your sheet as CSV (<strong>File → Share → Publish to web → CSV</strong>) 
                                    and paste that URL in Option 1 above. This lets the app READ data back from your sheet.
                                </p>
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center sticky bottom-0">
                            <div className="text-xs text-gray-500">
                                {webhookUrl ? '✅ Webhook configured' : '⚠️ No webhook configured yet'}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setShowWebhookSetup(false)}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={!localUrl}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm flex items-center gap-2"
                                >
                                    <Icon name="Check" size={16} /> Save Webhook URL
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        // Convert Google Drive link to embeddable image URL
        const convertDriveLink = (url) => {
            if (!url) return null;
            url = url.trim();
            
            // Already a direct image URL
            if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i)) return url;
            
            // Google Drive file link: https://drive.google.com/file/d/FILE_ID/view or /FILE_ID/FILENAME
            let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match) {
                return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
            }
            
            // Google Drive open link: https://drive.google.com/open?id=FILE_ID
            match = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
            if (match) {
                return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
            }
            
            // Google Drive direct export: https://drive.google.com/uc?id=FILE_ID&export=download
            match = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
            if (match) {
                return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
            }
            
            // Google Drive uc link (already embeddable)
            if (url.includes('drive.google.com/uc')) return url;
            
            // Google Drive thumbnail link
            if (url.includes('drive.google.com/thumbnail')) return url;
            
            // Google Photos sharing link
            match = url.match(/photos\.google\.com.*\/([a-zA-Z0-9_-]+)/);
            if (match) {
                // Google Photos doesn't allow easy embedding, return as-is
                return url;
            }
            
            // Dropbox link conversion
            if (url.includes('dropbox.com')) {
                return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
            }
            
            // OneDrive/SharePoint link (limited support)
            if (url.includes('1drv.ms') || url.includes('onedrive.live.com')) {
                return url;
            }
            
            // iCloud link (not easily embeddable)
            if (url.includes('icloud.com')) {
                return url;
            }
            
            // Fallback - return as is (might be a direct URL)
            return url;
        };
        
        // Check if a string looks like a cloud storage or image URL
        const isGoogleDriveUrl = (str) => {
            if (!str || typeof str !== 'string') return false;
            return str.includes('drive.google.com') || 
                   str.includes('docs.google.com') ||
                   str.includes('photos.google.com') ||
                   str.includes('dropbox.com') ||
                   str.includes('1drv.ms') ||
                   str.includes('onedrive.live.com') ||
                   str.includes('icloud.com') ||
                   str.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        };

        // Parse Google Sheet data
        const parseSheetData = (rows, headers) => {
            const headerMap = {};
            let driveUrlColumnIndex = -1;
            
            headers.forEach((h, i) => {
                const headerLower = h.toLowerCase().trim();
                // Auto-detect columns
                if (headerLower.includes('receipt') || headerLower === 'inv' || headerLower === 'id') headerMap.receiptNumber = i;
                if (headerLower.includes('date') || headerLower.includes('received') || headerLower.includes('transaction')) headerMap.dateReceived = i;
                if (headerLower.includes('desc') || headerLower.includes('material') || headerLower.includes('name')) headerMap.description = i;
                if (headerLower.includes('poster') && headerLower.includes('code')) headerMap.posterCode = i;
                if (headerLower.includes('client') || headerLower.includes('advertiser') || headerLower.includes('customer')) headerMap.client = i;
                if (headerLower.includes('printer') || headerLower.includes('vendor')) headerMap.printer = i;
                if (headerLower.includes('qty') || headerLower.includes('quantity') || headerLower.includes('units') || headerLower.includes('total')) headerMap.quantity = i;
                if (headerLower.includes('box')) headerMap.boxes = i;
                if (headerLower.includes('design')) headerMap.designs = i;
                if (headerLower.includes('comment') || headerLower.includes('note')) headerMap.comments = i;
                if (headerLower.includes('status')) headerMap.status = i;
                if (headerLower.includes('location') || headerLower.includes('warehouse') || headerLower.includes('bay')) headerMap.warehouseLocation = i;
                // Image/File link detection
                if (headerLower.includes('image') || headerLower.includes('photo') || headerLower.includes('picture') || 
                    headerLower.includes('file') || headerLower.includes('link') || headerLower.includes('url') ||
                    headerLower.includes('pdf') || headerLower.includes('attachment')) headerMap.imageLink = i;
            });
            
            // Smart detection: If no image column found, scan first row for Google Drive URLs
            if (headerMap.imageLink === undefined && rows.length > 0) {
                const firstRow = rows[0];
                for (let i = 0; i < firstRow.length; i++) {
                    if (isGoogleDriveUrl(firstRow[i])) {
                        driveUrlColumnIndex = i;
                        console.log('Auto-detected Google Drive URL in column', i, ':', headers[i]);
                        break;
                    }
                }
            }
            
            console.log('Detected columns:', headerMap);
            console.log('Headers:', headers);
            if (driveUrlColumnIndex >= 0) console.log('Drive URL column index:', driveUrlColumnIndex);
            
            return rows.map((row, idx) => {
                // Get the image URL - check mapped column first, then auto-detected Drive URL column
                let rawImageLink = null;
                if (headerMap.imageLink !== undefined) {
                    rawImageLink = row[headerMap.imageLink];
                } else if (driveUrlColumnIndex >= 0) {
                    rawImageLink = row[driveUrlColumnIndex];
                } else {
                    // Last resort: scan this row for any Google Drive URL
                    for (let cell of row) {
                        if (isGoogleDriveUrl(cell)) {
                            rawImageLink = cell;
                            break;
                        }
                    }
                }
                
                const imageUrl = rawImageLink 
                    ? convertDriveLink(rawImageLink.trim())
                    : null; // Don't use placeholder images - show "No image" instead
                
                const receiptNum = row[headerMap.receiptNumber] || '';
                
                return {
                    id: receiptNum ? `${receiptNum}_${idx}` : `ROW-${idx}`, // Always unique ID with row index
                    receiptNumber: receiptNum,
                    dateReceived: row[headerMap.dateReceived] ? new Date(row[headerMap.dateReceived]) : new Date(),
                    description: row[headerMap.description] || '',
                    posterCode: row[headerMap.posterCode] || row[headerMap.description] || '',
                    client: row[headerMap.client] || '',
                    advertiser: row[headerMap.client] || '',
                    printer: row[headerMap.printer] || '',
                    quantity: parseInt(row[headerMap.quantity]) || 0,
                    boxes: parseInt(row[headerMap.boxes]) || 1,
                    designs: parseInt(row[headerMap.designs]) || 1,
                    comments: row[headerMap.comments] || '',
                    status: row[headerMap.status] || 'Received',
                    warehouseLocation: row[headerMap.warehouseLocation] || '',
                    posterImage: imageUrl,
                    originalFileLink: rawImageLink || null,
                    keywords: (row[headerMap.description] || '').toLowerCase().split(/[\s\-]+/).filter(w => w.length > 2)
                };
            }).filter(m => m.receiptNumber || m.client); // Filter out empty rows
        };

        // Handle CSV file upload
        const handleFileUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            setIsLoading(true);
            setConnectionError('');
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target.result;
                    const lines = text.split('\n').filter(l => l.trim());
                    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                    const rows = lines.slice(1).map(line => {
                        // Handle CSV with quoted values
                        const values = [];
                        let current = '';
                        let inQuotes = false;
                        for (let char of line) {
                            if (char === '"') inQuotes = !inQuotes;
                            else if (char === ',' && !inQuotes) {
                                values.push(current.trim());
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        values.push(current.trim());
                        return values;
                    });
                    
                    const parsed = parseSheetData(rows, headers);
                    setMaterials(parsed);
                    setLinkedSheet({ name: file.name, type: 'csv' });
                    setLastSync(new Date());
                    setShowLinkModal(false);
                    // Enable live mode - hides all demo features globally
                    if (setIsLiveMode) setIsLiveMode(true);
                } catch (err) {
                    setConnectionError('Failed to parse CSV file: ' + err.message);
                }
                setIsLoading(false);
            };
            reader.onerror = () => {
                setConnectionError('Failed to read file');
                setIsLoading(false);
            };
            reader.readAsText(file);
        };

        // Fetch from Google Sheet published URL
        const handleConnectSheet = async () => {
            if (!sheetUrl) return;
            
            setIsLoading(true);
            setConnectionError('');
            
            try {
                // Try with CORS proxy
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(sheetUrl)}`;
                const response = await fetch(proxyUrl);
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const text = await response.text();
                const lines = text.split('\n').filter(l => l.trim());
                
                if (lines.length < 2) throw new Error('No data found in spreadsheet');
                
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const rows = lines.slice(1).map(line => {
                    const values = [];
                    let current = '';
                    let inQuotes = false;
                    for (let char of line) {
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === ',' && !inQuotes) {
                            values.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    values.push(current.trim());
                    return values;
                });
                
                const parsed = parseSheetData(rows, headers);
                setMaterials(parsed);
                setLinkedSheet({ name: 'Google Sheet (Live)', type: 'live-csv', url: sheetUrl });
                setLastSync(new Date());
                setShowLinkModal(false);
                localStorage.setItem('stap_material_sheet_url', sheetUrl);
                if (setIsLiveMode) setIsLiveMode(true);
                
                console.log(`📦 Loaded ${parsed.length} materials from Google Sheet`);
            } catch (err) {
                console.error('Failed to fetch sheet:', err);
                setConnectionError(`Failed to connect: ${err.message}. Make sure the sheet is published to web as CSV.`);
            } finally {
                setIsLoading(false);
            }
        };

        // Load saved sheet URL on mount and auto-reconnect
        useEffect(() => {
            const savedUrl = localStorage.getItem('stap_material_sheet_url');
            if (savedUrl && !linkedSheet) {
                setSheetUrl(savedUrl);
                // Auto-reconnect to the saved sheet
                const autoConnect = async () => {
                    setIsLoading(true);
                    try {
                        let csvUrl = savedUrl;
                        const match = savedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
                        if (match) {
                            const sheetId = match[1];
                            const gidMatch = savedUrl.match(/gid=(\d+)/);
                            const gid = gidMatch ? gidMatch[1] : '0';
                            csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
                        }
                        
                        // Use CORS proxy (same as handleConnectSheet) — Loop 4 fix
                        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl)}`;
                        const response = await fetch(proxyUrl);
                        if (!response.ok) throw new Error('Failed to fetch');
                        const text = await response.text();
                        const lines = text.split('\n').filter(line => line.trim());
                        if (lines.length < 2) throw new Error('No data found');
                        
                        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                        const rows = lines.slice(1).map(line => {
                            const values = [];
                            let current = '';
                            let inQuotes = false;
                            for (const char of line) {
                                if (char === '"') inQuotes = !inQuotes;
                                else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
                                else current += char;
                            }
                            values.push(current.trim());
                            return values;
                        });
                        
                        const parsed = parseSheetData(rows, headers);
                        setMaterials(parsed);
                        setLinkedSheet({ name: 'Google Sheet (Live)', type: 'live-csv', url: savedUrl });
                        setLastSync(new Date());
                        if (setIsLiveMode) setIsLiveMode(true);
                        console.log(`📦 Auto-reconnected: Loaded ${parsed.length} materials from Google Sheet`);
                    } catch (err) {
                        console.error('Auto-reconnect failed:', err);
                        // Don't show error modal, just log it - user can manually reconnect
                    } finally {
                        setIsLoading(false);
                    }
                };
                autoConnect();
            }
        }, []);

        // Google Sheets Link Modal Component
        const LinkSheetModal = () => {
            if (!showLinkModal) return null;
            
            return (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkModal(false)}>
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                            <div className="text-white">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Icon name="FileSpreadsheet" size={24} /> Connect Google Sheet
                                </h3>
                                <p className="text-green-100 text-sm">Import material receipts from your spreadsheet</p>
                            </div>
                            <button onClick={() => setShowLinkModal(false)} className="text-white/80 hover:text-white p-2">
                                <Icon name="X" size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            {/* Connection Status */}
                            {linkedSheet && (
                                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                                            <Icon name="Check" size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-green-800">Connected</div>
                                            <div className="text-sm text-green-600">{linkedSheet.name}</div>
                                            {lastSync && <div className="text-xs text-green-500">Last sync: {lastSync.toLocaleString()}</div>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {linkedSheet?.type === 'live-csv' && (
                                            <button 
                                                onClick={handleConnectSheet}
                                                disabled={isLoading}
                                                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium flex items-center gap-1"
                                            >
                                                <Icon name="RefreshCw" size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => { setMaterials([]); setLinkedSheet(null); localStorage.removeItem('stap_material_sheet_url'); localStorage.removeItem('stap_materials_data'); localStorage.removeItem('stap_materials_sheet'); if (window.STAP_IDB) window.STAP_IDB.clear('materials'); if (setIsLiveMode) setIsLiveMode(false); }}
                                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            {connectionError && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    ⚠️ {connectionError}
                                </div>
                            )}
                            
                            {/* Option 1: Google Sheet URL (Primary) */}
                            <div className="mb-6">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                                    Connect Published Google Sheet (Recommended)
                                </h4>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                                    <strong>How to publish:</strong> In Google Sheets → File → Share → Publish to web → Select CSV format → Copy link
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                                        value={sheetUrl}
                                        onChange={e => setSheetUrl(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <button 
                                        onClick={handleConnectSheet}
                                        disabled={!sheetUrl || isLoading}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm flex items-center gap-2"
                                    >
                                        {isLoading ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Link" size={16} />}
                                        Connect
                                    </button>
                                </div>
                            </div>
                            
                            {/* Option 2: CSV Upload (Fallback) */}
                            <div className="mb-6">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                    Or Upload CSV File
                                </h4>
                                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-400 transition-colors">
                                    <input 
                                        type="file" 
                                        accept=".csv,.tsv,.txt"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="csv-upload"
                                    />
                                    <label htmlFor="csv-upload" className="cursor-pointer">
                                        <Icon name="Upload" size={32} className="mx-auto text-gray-400 mb-2" />
                                        <div className="text-gray-600 font-medium">Drop CSV file here or click to browse</div>
                                        <div className="text-xs text-gray-400 mt-1">Export your Google Sheet as CSV (File → Download → CSV)</div>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Option 3: PDF Upload (NEW!) */}
                            <div className="mb-6">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                    Or Upload Receiver PDFs
                                    <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full">NEW!</span>
                                </h4>
                                <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-dashed border-red-300 rounded-xl p-6 text-center hover:border-red-400 transition-colors">
                                    <input 
                                        type="file" 
                                        accept=".pdf"
                                        multiple
                                        onChange={handlePdfUpload}
                                        className="hidden"
                                        id="pdf-upload"
                                        disabled={pdfProcessing}
                                    />
                                    <label htmlFor="pdf-upload" className={`cursor-pointer ${pdfProcessing ? 'opacity-50' : ''}`}>
                                        {pdfProcessing ? (
                                            <>
                                                <Icon name="Loader" size={32} className="mx-auto text-red-500 mb-2 animate-spin" />
                                                <div className="text-red-600 font-medium">{pdfProgress}</div>
                                            </>
                                        ) : (
                                            <>
                                                <Icon name="FileText" size={32} className="mx-auto text-red-400 mb-2" />
                                                <div className="text-red-600 font-medium">Drop PDF receiver(s) here or click to browse</div>
                                                <div className="text-xs text-red-400 mt-1">Auto-extracts: Receipt #, Client, Qty, Date + generates thumbnail</div>
                                            </>
                                        )}
                                    </label>
                                </div>
                                
                                {/* PDF Results Preview with Campaign Assignment */}
                                {pdfResults.length > 0 && (
                                    <div className="mt-4 p-4 bg-white border border-red-200 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className="font-bold text-gray-800 flex items-center gap-2">
                                                <Icon name="CheckCircle" size={16} className="text-green-500" />
                                                {pdfResults.filter(r => !r.error).length} PDF(s) Ready - Assign Campaigns
                                            </h5>
                                            <div className="flex items-center gap-2">
                                                {webhookUrl ? (
                                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                                        <Icon name="Cloud" size={12} /> Will sync to Sheet
                                                    </span>
                                                ) : (
                                                    <button 
                                                        onClick={() => setShowWebhookSetup(true)}
                                                        className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
                                                    >
                                                        <Icon name="AlertCircle" size={12} /> Setup auto-sync →
                                                    </button>
                                                )}
                                                <button
                                                    onClick={handleImportPdfResults}
                                                    disabled={webhookSending}
                                                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center gap-2"
                                                >
                                                    {webhookSending ? (
                                                        <><Icon name="Loader" size={16} className="animate-spin" /> Syncing...</>
                                                    ) : (
                                                        <><Icon name="Download" size={16} /> Import{webhookUrl ? ' & Sync' : ' All'}</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        {webhookStatus && (
                                            <div className={`mb-3 text-xs px-3 py-2 rounded-lg ${
                                                webhookStatus.includes('✅') ? 'bg-green-50 text-green-700' : 
                                                webhookStatus.includes('❌') ? 'bg-red-50 text-red-700' : 
                                                'bg-blue-50 text-blue-700'
                                            }`}>
                                                {webhookStatus}
                                            </div>
                                        )}
                                        
                                        {/* PDF Results with Campaign Selection */}
                                        <div className="space-y-3 max-h-80 overflow-auto">
                                            {pdfResults.map((result, idx) => (
                                                <div key={idx} className={`p-3 rounded-lg border ${result.error ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex gap-3">
                                                        {result.posterImage && (
                                                            <img src={result.posterImage} alt="PDF thumbnail" className="w-20 h-24 object-cover rounded border flex-shrink-0" />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <div>
                                                                    <div className="font-mono text-xs text-orange-600">{result.receiptNumber}</div>
                                                                    <div className="font-bold text-sm text-gray-800">{result.client}</div>
                                                                    <div className="text-xs text-gray-500">Qty: {result.quantity} • {result.dateReceived}</div>
                                                                </div>
                                                                {result.error && <span className="text-xs text-red-600">⚠️ Error</span>}
                                                            </div>
                                                            
                                                            {/* Campaign Assignment - Searchable */}
                                                            <div className="bg-white rounded border border-gray-200 p-2">
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">
                                                                    Assign to Campaign
                                                                </label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={result.campaignId ? (result.matchedCampaign || result.campaignId) : "🔍 Search advertiser, campaign..."}
                                                                        value={result.campaignSearch || ''}
                                                                        onChange={(e) => {
                                                                            const newResults = [...pdfResults];
                                                                            newResults[idx] = { ...result, campaignSearch: e.target.value, showDropdown: true };
                                                                            setPdfResults(newResults);
                                                                        }}
                                                                        onFocus={() => {
                                                                            const newResults = [...pdfResults];
                                                                            newResults[idx] = { ...result, showDropdown: true };
                                                                            setPdfResults(newResults);
                                                                        }}
                                                                        className={`w-full text-xs border rounded px-2 py-1.5 ${
                                                                            result.campaignId && result.campaignId !== '__PENDING__' 
                                                                                ? 'border-green-400 bg-green-50' 
                                                                                : 'border-gray-300 bg-white'
                                                                        }`}
                                                                    />
                                                                    {result.campaignId && result.campaignId !== '__PENDING__' && (
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">
                                                                            <Icon name="CheckCircle" size={14} />
                                                                        </span>
                                                                    )}
                                                                    
                                                                    {/* Dropdown */}
                                                                    {result.showDropdown && (
                                                                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-48 overflow-auto">
                                                                            <div 
                                                                                onClick={() => {
                                                                                    const newResults = [...pdfResults];
                                                                                    newResults[idx] = { ...result, campaignId: '__PENDING__', matchedCampaign: 'Pending', showDropdown: false, campaignSearch: '' };
                                                                                    setPdfResults(newResults);
                                                                                }}
                                                                                className="px-3 py-2 hover:bg-amber-50 cursor-pointer text-amber-700 border-b text-xs"
                                                                            >
                                                                                ⏳ Keep Pending
                                                                            </div>
                                                                            {data
                                                                                .filter(c => {
                                                                                    const search = (result.campaignSearch || result.client || '').toLowerCase();
                                                                                    if (!search) return true;
                                                                                    return (
                                                                                        (c['Campaign ID'] || '').toLowerCase().includes(search) ||
                                                                                        (c['Advertiser'] || '').toLowerCase().includes(search) ||
                                                                                        (c['Flight Name'] || '').toLowerCase().includes(search)
                                                                                    );
                                                                                })
                                                                                .slice(0, 20)
                                                                                .map(campaign => (
                                                                                    <div
                                                                                        key={campaign['Campaign ID'] || campaign.id}
                                                                                        onClick={() => {
                                                                                            const newResults = [...pdfResults];
                                                                                            newResults[idx] = { 
                                                                                                ...result, 
                                                                                                campaignId: campaign['Campaign ID'] || campaign.id,
                                                                                                matchedCampaign: campaign['Flight Name'] || campaign['Advertiser'],
                                                                                                // Auto-inherit production source from campaign
                                                                                                productionSource: campaign.productionProof || result.productionSource,
                                                                                                showDropdown: false,
                                                                                                campaignSearch: ''
                                                                                            };
                                                                                            setPdfResults(newResults);
                                                                                        }}
                                                                                        className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 text-xs"
                                                                                    >
                                                                                        <div className="font-medium text-gray-800 flex items-center gap-2">
                                                                                            {campaign['Advertiser'] || 'Unknown'}
                                                                                            {/* Show production source badge if available */}
                                                                                            {campaign.productionProof && (
                                                                                                <ProductionIcon type={campaign.productionProof} size={12} compact />
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="text-[10px] text-gray-500">
                                                                                            <span className="font-mono text-orange-600">{campaign['Campaign ID']}</span>
                                                                                            {' • '}{campaign['Flight Name'] || 'Untitled'}
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {result.matchedCampaign && result.campaignId !== '__PENDING__' && (
                                                                    <div className="mt-1 text-[10px] text-green-600 flex items-center gap-1">
                                                                        <Icon name="Link" size={10} /> Linked: {result.matchedCampaign}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Summary */}
                                        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                                            <div className="text-gray-500">
                                                <span className="font-medium text-green-600">{pdfResults.filter(r => r.campaignId && r.campaignId !== '__PENDING__').length}</span> assigned • 
                                                <span className="font-medium text-amber-600 ml-1">{pdfResults.filter(r => !r.campaignId || r.campaignId === '__PENDING__').length}</span> pending
                                            </div>
                                            <div className="text-gray-400">
                                                💡 You can assign campaigns later from the table view
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Webhook Setup Prompt */}
                                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${webhookUrl ? 'bg-green-500' : 'bg-blue-500'}`}>
                                                <Icon name={webhookUrl ? "Check" : "Zap"} size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">
                                                    {webhookUrl ? '✅ Auto-Sync Enabled' : '⚡ Enable Auto-Sync to Google Sheet'}
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    {webhookUrl 
                                                        ? 'PDF imports will automatically save to your Google Sheet' 
                                                        : 'Never lose data - PDF uploads sync directly to your sheet'}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setShowWebhookSetup(true)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                                                webhookUrl 
                                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                        >
                                            <Icon name="Settings" size={16} />
                                            {webhookUrl ? 'Configure' : 'Setup Now'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Expected Columns */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-bold text-gray-700 mb-2 text-sm">📋 Expected Columns (auto-detected)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    {[
                                        { name: 'Receipt #', desc: 'INV number' },
                                        { name: 'Transaction Date', desc: 'When received' },
                                        { name: 'Client', desc: 'Advertiser name' },
                                        { name: 'Description', desc: 'Material name' },
                                        { name: 'Poster Code', desc: 'Unique ID' },
                                        { name: 'Qty / Total', desc: 'Units received' },
                                        { name: 'Printer', desc: 'Vendor' },
                                        { name: 'Image/File Link', desc: 'Google Drive URL', highlight: true },
                                    ].map(col => (
                                        <div key={col.name} className={`rounded p-2 border ${col.highlight ? 'bg-green-50 border-green-300' : 'bg-white'}`}>
                                            <div className={`font-medium ${col.highlight ? 'text-green-800' : 'text-gray-800'}`}>{col.name}</div>
                                            <div className={col.highlight ? 'text-green-600' : 'text-gray-500'}>{col.desc}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="text-xs text-green-800">
                                        <strong>📷 Image Link Support:</strong> The system auto-detects any column containing Google Drive URLs - 
                                        even if the column is named after the poster code! Just make sure your sheet has the Drive link somewhere.
                                        <div className="mt-2 text-[10px] text-green-600">
                                            ✓ Detects: <code className="bg-white px-1 rounded">drive.google.com/file/d/...</code>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Column names are flexible - the system auto-detects based on common patterns.
                                </p>
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                                {materialsArray.length > 0 ? `✓ ${materialsArray.length} receipts loaded` : 'No data loaded yet'}
                            </div>
                            <button 
                                onClick={() => setShowLinkModal(false)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            );
        };
        
        // Safety: materials might be undefined if prop not passed correctly
        const materialsArray = materials || [];

        // Track deleted savedMaterial IDs so they don't come back
        const [deletedSavedIds, setDeletedSavedIds] = useState(new Set());

        // Load saved material data from DetailModal (localStorage)
        const savedMaterialEntries = useMemo(() => {
            const savedData = JSON.parse(localStorage.getItem('stap_material_data') || '{}');
            const entries = [];

            Object.entries(savedData).forEach(([key, data]) => {
                if (data.materialBreakdown && data.materialBreakdown.length > 0) {
                    const [campaignId, date] = key.split('_');

                    data.materialBreakdown.forEach((item, idx) => {
                        if (item.code || item.qty) {
                            const id = `SAVED-${key}-${idx}`;
                            if (!deletedSavedIds.has(id)) {
                                entries.push({
                                    id,
                                    receiptNumber: `${campaignId}-D${idx + 1}`,
                                    dateReceived: new Date(data.updatedAt || Date.now()),
                                    description: item.code || 'Design Material',
                                    posterCode: item.code || '',
                                    client: campaignId,
                                    advertiser: campaignId,
                                    quantity: parseInt(item.qty) || 0,
                                    boxes: 1,
                                    designs: 1,
                                    status: 'Received',
                                    comments: `Logged from Update Stages - ${data.mediaType || ''}`,
                                    warehouseLocation: '',
                                    posterImage: item.link || `https://picsum.photos/seed/${key}-${idx}/400/500`,
                                    originalFileLink: item.link || null,
                                    keywords: [campaignId.toLowerCase(), (item.code || '').toLowerCase()],
                                    fromDetailModal: true,
                                    _savedKey: key,
                                    _savedIdx: idx
                                });
                            }
                        }
                    });
                }
            });
            return entries;
        }, [deletedSavedIds]);

        // Delete handler that works for BOTH regular materials AND savedMaterial entries
        const handleDeleteMaterial = (material) => {
            if (!confirm('Delete this receipt?')) return;
            const id = material.id;
            console.log('🗑️ Deleting material:', id, material.fromDetailModal ? '(from DetailModal)' : '(from IDB)');

            if (material.fromDetailModal && material._savedKey !== undefined) {
                // Remove from stap_material_data in localStorage
                try {
                    const savedData = JSON.parse(localStorage.getItem('stap_material_data') || '{}');
                    const key = material._savedKey;
                    const idx = material._savedIdx;
                    if (savedData[key] && savedData[key].materialBreakdown) {
                        savedData[key].materialBreakdown.splice(idx, 1);
                        // Clean up empty entries
                        if (savedData[key].materialBreakdown.length === 0) {
                            delete savedData[key];
                        }
                        localStorage.setItem('stap_material_data', JSON.stringify(savedData));
                        console.log('🗑️ Removed from stap_material_data:', key, 'idx:', idx);
                    }
                } catch (e) { console.warn('Failed to clean stap_material_data:', e); }
                // Track so useMemo excludes it immediately
                setDeletedSavedIds(prev => new Set([...prev, id]));
            } else {
                // Regular material — remove from React state + IDB
                setMaterials(prev => prev.filter(m => m.id !== id));
                if (window.STAP_IDB) window.STAP_IDB.delete('materials', id);
            }
        };

        // Combine: uploaded data + saved entries from DetailModal
        // Deduplicate: skip savedMaterialEntries that match an existing IDB entry
        // (PDF upload from detail modal creates both an IDB entry AND a breakdown row)
        const combinedMaterials = useMemo(() => {
            const idbCodes = new Set(materialsArray.map(m => {
                const code = (m.posterCode || m.designCode || m.description || '').toLowerCase();
                const camp = (m.campaignId || m.campaign_id || '').toLowerCase();
                return `${camp}::${code}`;
            }));
            const deduped = savedMaterialEntries.filter(s => {
                const code = (s.posterCode || '').toLowerCase();
                const camp = (s.client || s.advertiser || '').toLowerCase();
                return !idbCodes.has(`${camp}::${code}`);
            });
            return [...materialsArray, ...deduped];
        }, [materialsArray, savedMaterialEntries]);

        // Use combined materials or empty array in production mode
        const allMaterials = combinedMaterials;

        // Get unique clients
        const clients = useMemo(() => {
            return [...new Set(allMaterials.map(m => m.client))].sort();
        }, [allMaterials]);

        // Filter materials
        const filteredMaterials = useMemo(() => {
            return allMaterials.filter(m => {
                if (selectedClient !== 'ALL' && m.client !== selectedClient) return false;
                if (selectedStatus !== 'ALL' && m.status !== selectedStatus) return false;
                if (dateFilter.start && m.dateReceived < new Date(dateFilter.start)) return false;
                if (dateFilter.end && m.dateReceived > new Date(dateFilter.end + 'T23:59:59')) return false;
                if (searchTerm) {
                    const search = searchTerm.toLowerCase();
                    // Search across ALL fields
                    return (
                        m.receiptNumber?.toLowerCase().includes(search) ||
                        m.client?.toLowerCase().includes(search) ||
                        m.advertiser?.toLowerCase().includes(search) ||
                        m.description?.toLowerCase().includes(search) ||
                        m.posterCode?.toLowerCase().includes(search) ||
                        m.printer?.toLowerCase().includes(search) ||
                        m.status?.toLowerCase().includes(search) ||
                        m.comments?.toLowerCase().includes(search) ||
                        m.campaignId?.toLowerCase().includes(search) ||
                        m.matchedCampaign?.toLowerCase().includes(search) ||
                        m.pdfSource?.toLowerCase().includes(search) ||
                        (typeof m.dateReceived === 'string' && m.dateReceived.toLowerCase().includes(search)) ||
                        String(m.quantity).includes(search)
                    );
                }
                return true;
            });
        }, [allMaterials, selectedClient, selectedStatus, dateFilter, searchTerm]);

        // Stats
        const stats = useMemo(() => {
            const totalQty = filteredMaterials.reduce((sum, m) => sum + m.quantity, 0);
            const deployedQty = filteredMaterials.reduce((sum, m) => sum + (m.deployedQty || 0), 0);
            const byStatus = {
                received: filteredMaterials.filter(m => m.status === 'Received').length,
                inWarehouse: filteredMaterials.filter(m => m.status === 'In Warehouse').length,
                partiallyDeployed: filteredMaterials.filter(m => m.status === 'Partially Deployed').length,
                fullyDeployed: filteredMaterials.filter(m => m.status === 'Fully Deployed').length
            };
            return { totalQty, deployedQty, byStatus, totalReceipts: filteredMaterials.length };
        }, [filteredMaterials]);

        // Performance Analytics
        const analytics = useMemo(() => {
            // Group by date (last 14 days)
            const last14Days = [];
            for (let i = 13; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);
                last14Days.push({
                    date,
                    dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    receipts: 0,
                    units: 0
                });
            }
            
            allMaterials.forEach(m => {
                const mDate = new Date(m.dateReceived);
                mDate.setHours(0, 0, 0, 0);
                const dayEntry = last14Days.find(d => d.date.getTime() === mDate.getTime());
                if (dayEntry) {
                    dayEntry.receipts++;
                    dayEntry.units += m.quantity;
                }
            });
            
            // By client breakdown
            const byClient = {};
            allMaterials.forEach(m => {
                if (!byClient[m.client]) {
                    byClient[m.client] = { receipts: 0, units: 0, deployed: 0 };
                }
                byClient[m.client].receipts++;
                byClient[m.client].units += m.quantity;
                byClient[m.client].deployed += m.deployedQty || 0;
            });
            
            // Sort clients by units
            const clientRanking = Object.entries(byClient)
                .map(([client, data]) => ({ client, ...data }))
                .sort((a, b) => b.units - a.units);
            
            // By printer breakdown
            const byPrinter = {};
            allMaterials.forEach(m => {
                const printer = m.printer || 'Unknown';
                if (!byPrinter[printer]) {
                    byPrinter[printer] = { receipts: 0, units: 0 };
                }
                byPrinter[printer].receipts++;
                byPrinter[printer].units += m.quantity;
            });
            
            // Recent activity (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentReceipts = allMaterials.filter(m => m.dateReceived >= sevenDaysAgo);
            const recentUnits = recentReceipts.reduce((sum, m) => sum + m.quantity, 0);
            
            // Deployment rate
            const totalUnits = allMaterials.reduce((sum, m) => sum + m.quantity, 0);
            const totalDeployed = allMaterials.reduce((sum, m) => sum + (m.deployedQty || 0), 0);
            const deploymentRate = totalUnits > 0 ? Math.round((totalDeployed / totalUnits) * 100) : 0;
            
            // Average units per receipt
            const avgUnitsPerReceipt = allMaterials.length > 0 
                ? Math.round(totalUnits / allMaterials.length) 
                : 0;
            
            return {
                dailyData: last14Days,
                clientRanking,
                byPrinter: Object.entries(byPrinter).map(([printer, data]) => ({ printer, ...data })),
                recentReceipts: recentReceipts.length,
                recentUnits,
                deploymentRate,
                avgUnitsPerReceipt,
                totalUnits,
                totalDeployed
            };
        }, [allMaterials]);

        // Status colors
        const getStatusColor = (status) => {
            switch(status) {
                case 'Received': return 'bg-blue-100 text-blue-700 border-blue-300';
                case 'Material Ready': 
                case 'Material Ready for Install': return 'bg-amber-100 text-amber-700 border-amber-300';
                case 'Deployed':
                case 'Partially Deployed':
                case 'Fully Deployed': return 'bg-purple-100 text-purple-700 border-purple-300';
                case 'Installed': return 'bg-green-100 text-green-700 border-green-300 ring-2 ring-green-400';
                // Legacy statuses for backwards compatibility
                case 'Processed': return 'bg-sky-100 text-sky-700 border-sky-300';
                case 'In Warehouse': return 'bg-amber-100 text-amber-700 border-amber-300';
                default: return 'bg-gray-100 text-gray-700 border-gray-300';
            }
        };

        // Receipt Detail Modal
        const ReceiptModal = ({ receipt, onClose, onDelete }) => {
            if (!receipt) return null;
            
            const deploymentPercent = receipt.quantity > 0 
                ? Math.round(((receipt.deployedQty || 0) / receipt.quantity) * 100) 
                : 0;
            
            return (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
                    <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
                            <div className="text-white">
                                <h3 className="text-xl font-bold">Receipt #{receipt.receiptNumber}</h3>
                                <p className="text-orange-100 text-sm">{typeof receipt.dateReceived === 'string' ? receipt.dateReceived : (receipt.dateReceived?.toLocaleDateString?.() || '')} at {typeof receipt.dateReceived === 'object' ? receipt.dateReceived?.toLocaleTimeString?.() : ''}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {onDelete && (
                                    <button
                                        onClick={() => {
                                            onDelete(receipt);
                                            onClose();
                                        }}
                                        className="text-white/80 hover:text-white hover:bg-red-600/50 p-2 rounded transition-colors"
                                        title="Delete receipt"
                                    >
                                        <Icon name="Trash2" size={20} />
                                    </button>
                                )}
                                <button onClick={onClose} className="text-white/80 hover:text-white p-2">
                                    <Icon name="X" size={24} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Poster Image */}
                                <div>
                                    <div className="aspect-[4/5] bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden border-4 border-gray-200 relative">
                                        {receipt.posterImage ? (
                                            <img 
                                                src={receipt.posterImage} 
                                                alt={receipt.description || 'Material receipt'}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        {/* Placeholder for missing/broken images */}
                                        <div 
                                            className="absolute inset-0 flex flex-col items-center justify-center text-gray-400"
                                            style={{ display: receipt.posterImage ? 'none' : 'flex' }}
                                        >
                                            <Icon name="Package" size={64} className="text-gray-300 mb-2" />
                                            <span className="text-sm text-gray-400">No image available</span>
                                            {receipt.originalFileLink && (
                                                <a 
                                                    href={receipt.originalFileLink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                                                >
                                                    Open original file →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-3 text-center">
                                        <span className="text-xs text-gray-500">Poster Code: </span>
                                        <span className="text-sm font-mono font-bold text-gray-800">{receipt.posterCode}</span>
                                    </div>
                                </div>
                                
                                {/* Details */}
                                <div className="space-y-4">
                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between">
                                        <span className={`px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(receipt.status)}`}>
                                            {receipt.status}
                                        </span>
                                        {receipt.matchedCampaign && (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                ✓ Matched to {receipt.matchedCampaign}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Campaign ID */}
                                    {receipt.campaignId && receipt.campaignId !== '__PENDING__' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                            <div className="text-[10px] text-blue-500 font-medium">CAMPAIGN ID</div>
                                            <div className="text-sm font-mono font-bold text-blue-700">{receipt.campaignId}</div>
                                            {receipt.matchedCampaign && (
                                                <div className="text-xs text-blue-600 mt-0.5">{receipt.matchedCampaign}</div>
                                            )}
                                        </div>
                                    )}

                                    {/* Info Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-xs text-gray-500 uppercase font-bold">Client</div>
                                            <div className="text-lg font-bold text-gray-800">{receipt.client}</div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-xs text-gray-500 uppercase font-bold">Quantity</div>
                                            <div className="text-lg font-bold text-gray-800">{receipt.quantity} units</div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-xs text-gray-500 uppercase font-bold">Boxes</div>
                                            <div className="text-lg font-bold text-gray-800">{receipt.boxes}</div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <div className="text-xs text-gray-500 uppercase font-bold">Designs</div>
                                            <div className="text-lg font-bold text-gray-800">{receipt.designs}</div>
                                        </div>
                                    </div>
                                    
                                    {/* Deployment Progress */}
                                    {receipt.status !== 'Received' && receipt.status !== 'In Warehouse' && (
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-bold text-gray-700">Deployment Progress</span>
                                                <span className="text-sm font-bold text-gray-800">{receipt.deployedQty || 0} / {receipt.quantity}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-3">
                                                <div 
                                                    className={`h-3 rounded-full transition-all ${deploymentPercent >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                                                    style={{ width: `${deploymentPercent}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-right text-xs text-gray-500 mt-1">{deploymentPercent}% deployed</div>
                                        </div>
                                    )}
                                    
                                    {/* Details List */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-500 text-sm">Description</span>
                                            <span className="font-medium text-gray-800 text-sm">{receipt.description}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-500 text-sm">Printer</span>
                                            <span className="font-medium text-gray-800 text-sm">{receipt.printer}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-500 text-sm">Warehouse Location</span>
                                            <span className="font-medium text-gray-800 text-sm">{receipt.warehouseLocation}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Comments */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                        <div className="text-xs text-amber-600 uppercase font-bold mb-1">Comments</div>
                                        <div className="text-sm text-amber-800">{receipt.comments}</div>
                                    </div>
                                    
                                    {/* Keywords for OCR matching */}
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase font-bold mb-2">Expected Keywords (for POP verification)</div>
                                        <div className="flex flex-wrap gap-1">
                                            {receipt.keywords?.map(kw => (
                                                <span key={kw} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2 pt-4">
                                        <button className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2">
                                            <Icon name="Camera" size={16} /> View in POP Gallery
                                        </button>
                                        {receipt.originalFileLink && (
                                            <a 
                                                href={receipt.originalFileLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                                            >
                                                <Icon name="FileText" size={16} /> Open Original PDF
                                            </a>
                                        )}
                                        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
                                            <Icon name="Printer" size={16} /> Print
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {/* Header - Compact */}
                <div className="px-4 py-2 border-b flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="p-1 hover:bg-orange-200 rounded-full transition-colors" title="Back">
                            <Icon name="ArrowLeft" size={16} className="text-orange-600" />
                        </button>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                <Icon name="Package" size={16} className="text-orange-600" />
                                Material Receivers
                                {linkedSheet && (
                                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded-full flex items-center gap-1">
                                        <Icon name="CheckCircle" size={10} /> Live
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {allMaterials.length} receipts
                                {linkedSheet && <span className="ml-1 text-green-600">• {linkedSheet.name}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Export CSV Button */}
                        {materialsArray.length > 0 && (
                            <button 
                                onClick={() => {
                                    const headers = ['Receipt #', 'Date', 'Client', 'Description', 'Poster Code', 'Quantity', 'Printer', 'Status', 'Comments'];
                                    const rows = materialsArray.map(m => [
                                        m.receiptNumber, m.dateReceived, m.client, m.description, 
                                        m.posterCode, m.quantity, m.printer, m.status, m.comments
                                    ]);
                                    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `materials_export_${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                }}
                                className="px-2 py-1 bg-blue-100 border border-blue-200 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium flex items-center gap-1"
                                title="Export to CSV"
                            >
                                <Icon name="Download" size={14} /> Export
                            </button>
                        )}
                        {/* Clear All Button */}
                        {materialsArray.length > 0 && (
                            <button 
                                onClick={() => {
                                    if (confirm(`Delete all ${allMaterials.length} receipts? This cannot be undone.`)) {
                                        setMaterials([]);
                                        localStorage.removeItem('stap_materials_data');
                                        localStorage.removeItem('stap_material_data');
                                        if (window.STAP_IDB) window.STAP_IDB.clear('materials');
                                        setDeletedSavedIds(new Set(savedMaterialEntries.map(m => m.id)));
                                    }
                                }}
                                className="px-2 py-1 bg-red-100 border border-red-200 hover:bg-red-200 text-red-700 rounded text-xs font-medium flex items-center gap-1"
                                title="Clear all materials"
                            >
                                <Icon name="Trash2" size={14} /> Clear
                            </button>
                        )}
                        {/* Link Google Sheet Button */}
                        <button 
                            onClick={() => setShowLinkModal(true)}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                                linkedSheet 
                                    ? 'bg-green-100 border border-green-300 hover:bg-green-200 text-green-700'
                                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                            }`}
                        >
                            <Icon name="FileSpreadsheet" size={14} />
                            {linkedSheet ? 'Connected' : 'Link Sheet'}
                        </button>
                        <button 
                            onClick={() => setView && setView('popGallery')}
                            className="px-2 py-1 bg-indigo-100 border border-indigo-200 hover:bg-indigo-200 text-indigo-700 rounded text-xs font-medium flex items-center gap-1"
                        >
                            <Icon name="Camera" size={14} /> POP
                        </button>
                        <div className="flex bg-white border border-gray-300 rounded p-0.5">
                            <button 
                                onClick={() => setViewMode('cards')}
                                className={`p-1 rounded transition-all ${viewMode === 'cards' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="Card View"
                            >
                                <Icon name="Grid" size={14} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`p-1 rounded transition-all ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="List View"
                            >
                                <Icon name="List" size={14} />
                            </button>
                            <button 
                                onClick={() => setViewMode('timeline')}
                                className={`p-1 rounded transition-all ${viewMode === 'timeline' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="Timeline View"
                            >
                                <Icon name="Clock" size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats + Filters Combined Row */}
                <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
                    {/* Stats */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <span className="text-base font-bold text-gray-800">{stats.totalReceipts}</span>
                            <span className="text-[9px] text-gray-500">RCPTS</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-base font-bold text-orange-600">{stats.totalQty}</span>
                            <span className="text-[9px] text-gray-500">UNITS</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-base font-bold text-green-600">{stats.deployedQty}</span>
                            <span className="text-[9px] text-gray-500">DEPLOYED</span>
                        </div>
                    </div>
                    
                    <div className="h-4 w-px bg-gray-300"></div>
                    
                    {/* Filters inline */}
                    <select 
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                    >
                        <option value="ALL">All Clients</option>
                        {clients.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    
                    <select 
                        value={selectedStatus}
                        onChange={e => setSelectedStatus(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                    >
                        <option value="ALL">All Status</option>
                        <option value="Received">📥 Received</option>
                        <option value="In Warehouse">🏭 Warehouse</option>
                        <option value="Partially Deployed">🚚 Partial</option>
                        <option value="Fully Deployed">✅ Complete</option>
                    </select>
                    
                    <div className="relative flex-1 min-w-[200px] max-w-[350px]">
                        <Icon name="Search" size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Search receipt #, client, description, printer..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-7 pr-8 py-1.5 border border-gray-300 rounded text-xs bg-white focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <Icon name="X" size={12} />
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1"></div>
                    
                    {/* Status badges */}
                    <div className="flex gap-1">
                        <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">📥{stats.byStatus.received}</span>
                        <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px]">🏭{stats.byStatus.inWarehouse}</span>
                        <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">🚚{stats.byStatus.partiallyDeployed}</span>
                        <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">✅{stats.byStatus.fullyDeployed}</span>
                    </div>
                    
                    {/* Analytics toggle */}
                    <button 
                        onClick={() => setShowAnalytics(!showAnalytics)}
                        className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 ${showAnalytics ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                        <Icon name="TrendingUp" size={12} /> {showAnalytics ? 'Hide' : 'Stats'}
                    </button>
                </div>

                {/* Performance Analytics Panel - Compact */}
                {showAnalytics && (
                    <div className="px-3 py-2 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                            <div className="bg-white rounded p-2 border border-orange-200">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Last 7 Days</div>
                                <div className="text-lg font-bold text-orange-600">{analytics.recentReceipts}</div>
                                <div className="text-[9px] text-gray-500">({analytics.recentUnits} units)</div>
                            </div>
                            <div className="bg-white rounded p-2 border border-green-200">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Deploy Rate</div>
                                <div className="text-lg font-bold text-green-600">{analytics.deploymentRate}%</div>
                                <div className="text-[9px] text-gray-500">{analytics.totalDeployed}/{analytics.totalUnits}</div>
                            </div>
                            <div className="bg-white rounded p-2 border border-blue-200">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Avg/Receipt</div>
                                <div className="text-lg font-bold text-blue-600">{analytics.avgUnitsPerReceipt}</div>
                                <div className="text-[9px] text-gray-500">units</div>
                            </div>
                            <div className="bg-white rounded p-2 border border-purple-200">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Clients</div>
                                <div className="text-lg font-bold text-purple-600">{analytics.clientRanking.length}</div>
                                <div className="text-[9px] text-gray-500">active</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white rounded p-2 border border-gray-200">
                                <div className="text-[10px] font-bold text-gray-700 mb-1">📊 Daily (14d)</div>
                                <div className="flex items-end gap-px h-10">
                                    {analytics.dailyData.map((day, idx) => {
                                        const maxUnits = Math.max(...analytics.dailyData.map(d => d.units), 1);
                                        const height = (day.units / maxUnits) * 100;
                                        return (
                                            <div key={idx} className="flex-1">
                                                <div 
                                                    className={`w-full rounded-t ${day.units > 0 ? 'bg-orange-400' : 'bg-gray-200'}`}
                                                    style={{ height: `${Math.max(height, 8)}%` }}
                                                    title={`${day.dateStr}: ${day.units} units`}
                                                ></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="bg-white rounded p-2 border border-gray-200">
                                <div className="text-[10px] font-bold text-gray-700 mb-1">👥 Top Clients</div>
                                <div className="space-y-0.5">
                                    {analytics.clientRanking.slice(0, 3).map((client, idx) => {
                                        const maxUnits = analytics.clientRanking[0]?.units || 1;
                                        const pct = (client.units / maxUnits) * 100;
                                        return (
                                            <div key={client.client} className="flex items-center gap-1">
                                                <span className="text-[8px] text-gray-400 w-3">#{idx + 1}</span>
                                                <span className="text-[9px] text-gray-700 truncate w-16">{client.client}</span>
                                                <div className="flex-1 bg-gray-100 rounded h-1.5">
                                                    <div className="h-1.5 rounded bg-orange-400" style={{ width: `${pct}%` }}></div>
                                                </div>
                                                <span className="text-[8px] text-gray-500 w-6 text-right">{client.units}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-3">
                    {filteredMaterials.length === 0 ? (
                        <div className="text-center py-16">
                            <Icon name="Package" size={48} className="mx-auto text-gray-300 mb-4" />
                            {allMaterials.length === 0 ? (
                                /* No data at all - prompt to upload */
                                <>
                                    <h3 className="text-lg font-semibold text-gray-500">No materials yet</h3>
                                    <p className="text-gray-400 text-sm mt-1 mb-4">Upload PDFs or connect a Google Sheet to get started</p>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            onClick={() => setShowLinkModal(true)}
                                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                        >
                                            <Icon name="Upload" size={16} /> Upload Data
                                        </button>
                                    </div>
                                </>
                            ) : (
                                /* Has data but filters are hiding it */
                                <>
                                    <h3 className="text-lg font-semibold text-gray-500">No matches</h3>
                                    <p className="text-gray-400 text-sm mt-1 mb-4">
                                        {allMaterials.length} receipt{allMaterials.length !== 1 ? 's' : ''} loaded, but none match current filters
                                    </p>
                                    <button
                                        onClick={() => {
                                            setSelectedClient('ALL');
                                            setSelectedStatus('ALL');
                                            setSearchTerm('');
                                            setDateFilter({ start: '', end: '' });
                                        }}
                                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 mx-auto"
                                    >
                                        <Icon name="RotateCcw" size={16} /> Clear All Filters
                                    </button>
                                </>
                            )}
                        </div>
                    ) : viewMode === 'cards' ? (
                        /* Card View */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredMaterials.map(material => (
                                <div 
                                    key={material.id}
                                    className="group cursor-pointer bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-orange-300 transition-all relative"
                                >
                                    {/* Delete button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteMaterial(material);
                                        }}
                                        className="absolute top-2 left-2 z-10 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm"
                                        title="Delete"
                                    >
                                        <Icon name="X" size={14} />
                                    </button>
                                    
                                    <div onClick={() => setSelectedReceipt(material)}>
                                    {/* Poster Preview */}
                                    <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200">
                                        {material.posterImage ? (
                                            <img 
                                                src={material.posterImage}
                                                alt={material.description || 'Material receipt'}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                onError={(e) => {
                                                    // Replace with placeholder on error
                                                    e.target.style.display = 'none';
                                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        {/* Placeholder for missing/broken images */}
                                        <div 
                                            className="absolute inset-0 flex flex-col items-center justify-center text-gray-400"
                                            style={{ display: material.posterImage ? 'none' : 'flex' }}
                                        >
                                            <Icon name="Package" size={32} className="text-gray-300 mb-1" />
                                            <span className="text-[10px] text-gray-400 text-center px-2">
                                                {material.originalFileLink ? 'Image unavailable' : 'No image'}
                                            </span>
                                            {material.originalFileLink && (
                                                <a 
                                                    href={material.originalFileLink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[9px] text-blue-500 hover:underline mt-1"
                                                >
                                                    Open original link →
                                                </a>
                                            )}
                                        </div>
                                        {/* Quantity badge */}
                                        <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-lg text-sm font-bold">
                                            📦 {material.quantity}
                                        </div>
                                        {/* Status badge */}
                                        <div className={`absolute bottom-2 left-2 px-2 py-1 rounded text-[10px] font-bold ${getStatusColor(material.status)}`}>
                                            {material.status}
                                        </div>
                                    </div>
                                    
                                    {/* Info */}
                                    <div className="p-3">
                                        <h4 className="font-bold text-gray-800 truncate">{material.client}</h4>
                                        <p className="text-xs text-gray-500 truncate">{material.description}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] text-gray-400 font-mono">{material.receiptNumber}</span>
                                            <span className="text-[10px] text-gray-400">{typeof material.dateReceived === 'string' ? material.dateReceived : (material.dateReceived?.toLocaleDateString?.() || '')}</span>
                                        </div>
                                        {material.campaignId && material.campaignId !== '__PENDING__' && (
                                            <div className="text-[10px] font-mono text-blue-600 truncate mt-0.5">
                                                📋 {material.campaignId}
                                            </div>
                                        )}
                                        {/* Deployment progress */}
                                        {material.deployedQty !== undefined && (
                                            <div className="mt-2">
                                                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                    <span>Deployed</span>
                                                    <span>{material.deployedQty}/{material.quantity || 0}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                    <div
                                                        className="h-1.5 rounded-full bg-green-500"
                                                        style={{ width: `${Math.min((material.deployedQty / (material.quantity || 1)) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                        {/* Matched campaign indicator */}
                                        {material.matchedCampaign && (
                                            <div className="mt-2 text-[10px] text-green-600 flex items-center gap-1">
                                                <Icon name="CheckCircle" size={10} /> Matched: {material.matchedCampaign}
                                            </div>
                                        )}
                                    </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : viewMode === 'list' ? (
                        /* Enhanced List View - Editable Table */
                        <div className="overflow-x-auto overflow-y-visible" style={{ overflow: 'visible' }}>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                                        <th className="text-left p-2 font-semibold text-xs sticky left-0 bg-orange-500">Receipt #</th>
                                        <th className="text-left p-2 font-semibold text-xs">Date</th>
                                        <th className="text-left p-2 font-semibold text-xs">Client</th>
                                        <th className="text-left p-2 font-semibold text-xs min-w-[150px]">Description</th>
                                        <th className="text-center p-2 font-semibold text-xs">Qty</th>
                                        <th className="text-left p-2 font-semibold text-xs">Printer</th>
                                        <th className="text-center p-2 font-semibold text-xs">Source</th>
                                        <th className="text-left p-2 font-semibold text-xs">Status</th>
                                        <th className="text-left p-2 font-semibold text-xs min-w-[150px]">Campaign ID</th>
                                        <th className="text-left p-2 font-semibold text-xs min-w-[100px]">Comments</th>
                                        <th className="text-center p-2 font-semibold text-xs w-16">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterials.map((material, idx) => (
                                        <tr 
                                            key={material.id}
                                            className={`border-b hover:bg-orange-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                        >
                                            <td className="p-2 font-mono text-orange-600 font-medium text-xs sticky left-0 bg-inherit">
                                                <EditableCell material={material} field="receiptNumber" className="text-orange-600 font-mono text-xs" />
                                            </td>
                                            <td className="p-2 text-xs">
                                                <EditableCell material={material} field="dateReceived" className="text-gray-600 text-xs" />
                                            </td>
                                            <td className="p-2 text-xs">
                                                <EditableCell material={material} field="client" className="font-medium text-gray-800 text-xs" />
                                            </td>
                                            <td className="p-2 text-xs">
                                                <EditableCell material={material} field="description" className="text-gray-600 text-xs" />
                                            </td>
                                            <td className="p-2 text-center text-xs">
                                                <EditableCell material={material} field="quantity" className="font-bold text-gray-800 text-center text-xs" type="number" />
                                            </td>
                                            <td className="p-2 text-xs">
                                                <EditableCell material={material} field="printer" className="text-gray-600 text-xs" />
                                            </td>
                                            {/* Production Source - toggleable */}
                                            <td className="p-2 text-center text-xs">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMaterials(prev => prev.map(m => 
                                                            m.id === material.id 
                                                                ? { ...m, productionSource: m.productionSource === 'in-house' ? 'client' : 'in-house' } 
                                                                : m
                                                        ));
                                                    }}
                                                    className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                                                        material.productionSource === 'in-house'
                                                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                    }`}
                                                    title="Click to toggle production source"
                                                >
                                                    {material.productionSource === 'in-house' 
                                                        ? <><Icon name="Home" size={10} /> In-House</>
                                                        : <><Icon name="Upload" size={10} /> Client</>
                                                    }
                                                </button>
                                            </td>
                                            <td className="p-2 text-xs">
                                                {editingCell?.id === material.id && editingCell?.field === 'status' ? (
                                                    <select
                                                        value={editValue}
                                                        onChange={(e) => {
                                                            setEditValue(e.target.value);
                                                            // Auto-save on select change
                                                            setTimeout(() => {
                                                                setMaterials(prev => prev.map(m => 
                                                                    m.id === material.id ? { ...m, status: e.target.value } : m
                                                                ));
                                                                setEditingCell(null);
                                                            }, 0);
                                                        }}
                                                        onBlur={() => setEditingCell(null)}
                                                        className="text-xs border rounded px-1 py-0.5"
                                                        autoFocus
                                                    >
                                                        <option value="Received">📥 Received at Warehouse</option>
                                                        <option value="Material Ready">📋 Material Ready for Install</option>
                                                        <option value="Deployed">🚚 Deployed (Work Orders Sent)</option>
                                                        <option value="Installed">✅ Installed</option>
                                                    </select>
                                                ) : (
                                                    <span 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startEditing(material.id, 'status', material.status);
                                                        }}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${getStatusColor(material.status)}`}
                                                        title="Click to change status"
                                                    >
                                                        {material.status}
                                                    </span>
                                                )}
                                            </td>
                                            {/* Campaign ID Column - Searchable */}
                                            <td className="p-2 text-xs" style={{ overflow: 'visible' }}>
                                                {editingCell?.id === material.id && editingCell?.field === 'campaignId' ? (
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Search advertiser, campaign..."
                                                            value={campaignSearchTerm}
                                                            onChange={(e) => setCampaignSearchTerm(e.target.value)}
                                                            className="text-xs border-2 border-orange-400 rounded px-2 py-1 w-full min-w-[200px] focus:outline-none"
                                                            autoFocus
                                                        />
                                                        <div 
                                                            className="bg-white border border-gray-300 rounded-lg shadow-2xl max-h-72 overflow-auto"
                                                            style={{ 
                                                                position: 'fixed',
                                                                zIndex: 9999,
                                                                width: '320px',
                                                                marginTop: '4px'
                                                            }}
                                                        >
                                                            {/* Quick options */}
                                                            <div 
                                                                onClick={() => {
                                                                    setMaterials(prev => prev.map(m => 
                                                                        m.id === material.id ? { ...m, campaignId: '', matchedCampaign: null } : m
                                                                    ));
                                                                    setEditingCell(null);
                                                                    setCampaignSearchTerm('');
                                                                }}
                                                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-500 border-b"
                                                            >
                                                                ✖️ Clear / Unassign
                                                            </div>
                                                            <div 
                                                                onClick={() => {
                                                                    setMaterials(prev => prev.map(m => 
                                                                        m.id === material.id ? { ...m, campaignId: '__PENDING__', matchedCampaign: 'Pending' } : m
                                                                    ));
                                                                    setEditingCell(null);
                                                                    setCampaignSearchTerm('');
                                                                }}
                                                                className="px-3 py-2 hover:bg-amber-50 cursor-pointer text-amber-700 border-b"
                                                            >
                                                                ⏳ Mark as Pending
                                                            </div>
                                                            
                                                            {/* Filtered campaigns - only show when searching */}
                                                            {campaignSearchTerm.length >= 2 ? (
                                                                (() => {
                                                                    const search = campaignSearchTerm.toLowerCase().trim();
                                                                    
                                                                    // Filter campaigns that match search
                                                                    const matchingCampaigns = data.filter(c => {
                                                                        const advertiser = String(c['Advertiser'] || c.advertiser || c.client || '').toLowerCase();
                                                                        const campaignId = String(c['Campaign ID'] || c.campaignId || c.id || '').toLowerCase();
                                                                        const flightName = String(c['Flight Name'] || c.flightName || c.title || c.name || '').toLowerCase();
                                                                        const market = String(c['Market'] || c.market || '').toLowerCase();
                                                                        const mediaType = String(c['Media Type'] || c.mediaType || '').toLowerCase();
                                                                        
                                                                        return advertiser.includes(search) ||
                                                                            campaignId.includes(search) ||
                                                                            flightName.includes(search) ||
                                                                            market.includes(search) ||
                                                                            mediaType.includes(search);
                                                                    });
                                                                    
                                                                    // De-duplicate by Campaign ID (keep first occurrence)
                                                                    const seen = new Set();
                                                                    const uniqueCampaigns = matchingCampaigns.filter(c => {
                                                                        const id = c['Campaign ID'] || c.id || '';
                                                                        if (seen.has(id)) return false;
                                                                        seen.add(id);
                                                                        return true;
                                                                    });
                                                                    
                                                                    console.log(`🔍 "${search}" - Found ${uniqueCampaigns.length} unique campaigns (${matchingCampaigns.length} total matches)`);
                                                                    
                                                                    if (uniqueCampaigns.length === 0) {
                                                                        return (
                                                                            <div className="px-3 py-4 text-center text-gray-400 text-xs">
                                                                                No campaigns found for "{campaignSearchTerm}"
                                                                            </div>
                                                                        );
                                                                    }
                                                                    
                                                                    // Debug: log first campaign's keys to see field names
                                                                    if (uniqueCampaigns.length > 0) {
                                                                        console.log('📋 Campaign fields:', Object.keys(uniqueCampaigns[0]));
                                                                        console.log('📋 First campaign:', uniqueCampaigns[0]);
                                                                    }
                                                                    
                                                                    return uniqueCampaigns.slice(0, 30).map((campaign, idx) => {
                                                                        // Try to find the best name/title for this campaign
                                                                        const campaignName = campaign['Flight Name'] || campaign['Campaign Name'] || campaign['Name'] || 
                                                                            campaign['Title'] || campaign.flightName || campaign.campaignName || 
                                                                            campaign.name || campaign.title || '';
                                                                        const advertiser = campaign['Advertiser'] || campaign.advertiser || campaign['Client'] || campaign.client || 'Unknown';
                                                                        const market = campaign['Market'] || campaign.market || '';
                                                                        const mediaType = campaign['Media Type'] || campaign['Product'] || campaign.mediaType || '';
                                                                        const campaignId = campaign['Campaign ID'] || campaign.id || '';
                                                                        
                                                                        return (
                                                                        <div
                                                                            key={`campaign-${idx}-${campaignId}`}
                                                                            onClick={() => {
                                                                                setMaterials(prev => prev.map(m => 
                                                                                    m.id === material.id ? { 
                                                                                        ...m, 
                                                                                        campaignId: campaignId,
                                                                                        matchedCampaign: `${advertiser}${campaignName ? ' - ' + campaignName : ''}`,
                                                                                        // Auto-inherit production source from campaign
                                                                                        productionSource: campaign.productionProof || m.productionSource
                                                                                    } : m
                                                                                ));
                                                                                setEditingCell(null);
                                                                                setCampaignSearchTerm('');
                                                                            }}
                                                                            className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100"
                                                                        >
                                                                            <div className="font-medium text-gray-800 flex items-center gap-2">
                                                                                {advertiser}
                                                                                {/* Show production source badge if available */}
                                                                                {campaign.productionProof && (
                                                                                    <ProductionIcon type={campaign.productionProof} size={12} compact />
                                                                                )}
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500 flex gap-2">
                                                                                <span className="font-mono text-orange-600">{campaignId}</span>
                                                                                {campaignName && (
                                                                                    <>
                                                                                        <span>•</span>
                                                                                        <span className="truncate">{campaignName}</span>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            {(market || mediaType) && (
                                                                                <div className="text-[9px] text-gray-400">
                                                                                    {market}{market && mediaType ? ' • ' : ''}{mediaType}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )});
                                                                })()
                                                            ) : (
                                                                <div className="px-3 py-4 text-center text-gray-400 text-xs">
                                                                    Type at least 2 characters to search {data.length.toLocaleString()} campaigns
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Click outside to close */}
                                                        <div 
                                                            className="fixed inset-0" 
                                                            style={{ zIndex: 9998 }}
                                                            onClick={() => { setEditingCell(null); setCampaignSearchTerm(''); }}
                                                        ></div>
                                                    </div>
                                                ) : (
                                                    <span 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startEditing(material.id, 'campaignId', material.campaignId || '');
                                                            setCampaignSearchTerm('');
                                                        }}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer block truncate max-w-[140px] ${
                                                            material.campaignId && material.campaignId !== '__PENDING__'
                                                                ? 'bg-green-100 text-green-700 border border-green-300'
                                                                : material.campaignId === '__PENDING__'
                                                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                                                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                                                        }`}
                                                        title={material.matchedCampaign || 'Click to assign campaign'}
                                                    >
                                                        {material.campaignId && material.campaignId !== '__PENDING__' 
                                                            ? (material.campaignId.length > 12 ? material.campaignId.substring(0, 12) + '...' : material.campaignId)
                                                            : material.campaignId === '__PENDING__'
                                                            ? '⏳ Pending'
                                                            : '🔍 Search...'}
                                                    </span>
                                                )}
                                                {material.matchedCampaign && material.campaignId !== '__PENDING__' && (
                                                    <div className="text-[9px] text-green-600 truncate mt-0.5" title={material.matchedCampaign}>
                                                        {material.matchedCampaign}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 text-xs">
                                                <EditableCell material={material} field="comments" className="text-gray-500 text-xs" />
                                            </td>
                                            <td className="p-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => setSelectedReceipt(material)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        title="View details"
                                                    >
                                                        <Icon name="Eye" size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMaterial(material)}
                                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete"
                                                    >
                                                        <Icon name="Trash2" size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredMaterials.length > 0 && (
                                <div className="text-xs text-gray-500 p-2 bg-gray-50 border-t">
                                    💡 Click any cell to edit • Changes auto-save to localStorage {webhookUrl && '& sync to Google Sheet'}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Enhanced Timeline View with Journey Stages */
                        <div className="space-y-4">
                            {filteredMaterials.map((material, idx) => {
                                // Determine journey stage based on status and campaign match
                                const getJourneyStage = () => {
                                    // Check if linked to a campaign that's installed
                                    const linkedCampaign = material.campaignId && data.find(c => 
                                        (c['Campaign ID'] || c.id) === material.campaignId
                                    );
                                    const campaignStage = linkedCampaign?.['Install Stage']?.toLowerCase() || '';
                                    
                                    if (campaignStage.includes('installed') || campaignStage.includes('complete') || material.status === 'Installed') {
                                        return 4; // Installed
                                    }
                                    if (material.status === 'Deployed' || material.status === 'Fully Deployed' || material.status === 'Partially Deployed') return 3;
                                    if (material.status === 'Material Ready' || material.status === 'Material Ready for Install') return 2;
                                    return 1; // Received at Warehouse
                                };
                                
                                const journeyStage = getJourneyStage();
                                const isInHouse = material.productionSource === 'in-house';
                                
                                // Core stages (always shown) - Your warehouse workflow
                                const coreStages = [
                                    { num: 1, label: 'Received', sublabel: 'At Warehouse', icon: '📥', color: 'blue' },
                                    { num: 2, label: 'Material Ready', sublabel: 'For Install', icon: '📋', color: 'amber' },
                                    { num: 3, label: 'Deployed', sublabel: 'Work Orders Sent', icon: '🚚', color: 'purple' },
                                    { num: 4, label: 'Installed', sublabel: 'Complete', icon: '✅', color: 'green' }
                                ];
                                
                                // Extended stages for in-house production (pre-warehouse)
                                const inHousePreStages = [
                                    { num: -3, label: 'Proofs', sublabel: 'Approved', icon: '✓', color: 'slate', pre: true },
                                    { num: -2, label: 'Printing', sublabel: 'In Progress', icon: '🖨️', color: 'slate', pre: true },
                                    { num: -1, label: 'Material', sublabel: 'Ready', icon: '📦', color: 'slate', pre: true },
                                    { num: 0, label: 'Shipped', sublabel: 'To Warehouse', icon: '🚛', color: 'slate', pre: true },
                                ];
                                
                                // Client workflow pre-stage
                                const clientPreStages = [
                                    { num: 0, label: 'Contract', sublabel: 'Signed', icon: '📝', color: 'slate', pre: true },
                                ];
                                
                                const allStages = isInHouse 
                                    ? [...inHousePreStages, ...coreStages]
                                    : [...clientPreStages, ...coreStages];
                                
                                const totalSteps = allStages.length - 1;
                                const currentIndex = allStages.findIndex(s => s.num === Math.floor(journeyStage));
                                const progressPercent = currentIndex >= 0 ? (currentIndex / totalSteps) * 100 : 0;
                                
                                return (
                                    <div 
                                        key={material.id}
                                        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-orange-300 transition-all group"
                                    >
                                        {/* Header with client info */}
                                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                                                    <Icon name="Package" size={20} className="text-orange-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white">{material.client || 'Unknown Client'}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 font-mono">{material.receiptNumber}</span>
                                                        {/* Production source badge */}
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                                            isInHouse 
                                                                ? 'bg-purple-500/30 text-purple-300' 
                                                                : 'bg-blue-500/30 text-blue-300'
                                                        }`}>
                                                            <Icon name={isInHouse ? 'Home' : 'Upload'} size={10} />
                                                            {isInHouse ? 'In-House' : 'Client-Produced'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-orange-400">{material.quantity}</div>
                                                <div className="text-[10px] text-slate-400">units</div>
                                            </div>
                                        </div>
                                        
                                        {/* Journey Timeline */}
                                        <div className="px-4 py-4">
                                            <div className="relative">
                                                {/* Progress line background */}
                                                <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full"></div>
                                                {/* Progress line fill */}
                                                <div 
                                                    className="absolute top-5 left-0 h-1 rounded-full transition-all duration-500"
                                                    style={{ 
                                                        width: `${Math.min(progressPercent, 100)}%`,
                                                        background: 'linear-gradient(to right, #94a3b8, #3b82f6, #f59e0b, #8b5cf6, #22c55e)'
                                                    }}
                                                ></div>
                                                
                                                {/* Stage dots */}
                                                <div className="relative flex justify-between">
                                                    {allStages.map((stage, i) => {
                                                        const isActive = journeyStage >= stage.num;
                                                        const isCurrent = Math.floor(journeyStage) === stage.num;
                                                        const isPre = stage.pre;
                                                        
                                                        return (
                                                            <div key={`${stage.num}-${stage.label}`} className="flex flex-col items-center" style={{ minWidth: isPre ? '50px' : '65px' }}>
                                                                <div 
                                                                    className={`rounded-full flex items-center justify-center transition-all ${
                                                                        isPre ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-lg'
                                                                    }`}
                                                                    style={{
                                                                        backgroundColor: isActive 
                                                                            ? stage.color === 'blue' ? '#3b82f6' 
                                                                            : stage.color === 'amber' ? '#f59e0b'
                                                                            : stage.color === 'purple' ? '#8b5cf6'
                                                                            : stage.color === 'green' ? '#22c55e'
                                                                            : '#64748b'
                                                                            : '#e5e7eb',
                                                                        color: isActive ? 'white' : '#9ca3af',
                                                                        boxShadow: isCurrent && !isPre ? `0 0 0 4px ${
                                                                            stage.color === 'blue' ? '#dbeafe' 
                                                                            : stage.color === 'amber' ? '#fef3c7'
                                                                            : stage.color === 'purple' ? '#ede9fe'
                                                                            : stage.color === 'green' ? '#dcfce7'
                                                                            : '#f1f5f9'
                                                                        }` : 'none',
                                                                        transform: isCurrent && !isPre ? 'scale(1.15)' : 'scale(1)',
                                                                        opacity: isPre && !isActive ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    {stage.icon}
                                                                </div>
                                                                <span className={`mt-1.5 font-medium text-center leading-tight ${isPre ? 'text-[8px]' : 'text-[9px]'} ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                                                                    {stage.label}
                                                                </span>
                                                                <span className={`text-center leading-tight ${isPre ? 'text-[7px]' : 'text-[8px]'} ${isActive ? 'text-gray-500' : 'text-gray-300'}`}>
                                                                    {stage.sublabel}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Details section */}
                                        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Icon name="Calendar" size={12} />
                                                        {typeof material.dateReceived === 'string' 
                                                            ? material.dateReceived 
                                                            : (material.dateReceived?.toLocaleDateString?.() || 'N/A')}
                                                    </span>
                                                    {material.printer && (
                                                        <span className="flex items-center gap-1">
                                                            <Icon name="Printer" size={12} />
                                                            {material.printer}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {material.matchedCampaign ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-medium flex items-center gap-1">
                                                            <Icon name="Link" size={10} /> {typeof material.matchedCampaign === 'string' && material.matchedCampaign.length > 20 ? material.matchedCampaign.substring(0, 20) + '...' : String(material.matchedCampaign || '')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px]">
                                                            No campaign linked
                                                        </span>
                                                    )}
                                                    <button 
                                                        onClick={() => setSelectedReceipt(material)}
                                                        className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                                    >
                                                        <Icon name="Eye" size={12} /> Details
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Description */}
                                            {material.description && (
                                                <p className="text-xs text-gray-500 mt-2 truncate">{material.description}</p>
                                            )}
                                            
                                            {/* Deployment Progress Bar (if partially deployed) */}
                                            {material.deployedQty !== undefined && material.deployedQty > 0 && (
                                                <div className="mt-3 bg-gray-50 rounded-lg p-2">
                                                    <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                                                        <span className="font-medium">Deployment Progress</span>
                                                        <span>{material.deployedQty} / {material.quantity || 0} units ({Math.round((material.deployedQty / (material.quantity || 1)) * 100)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-green-500 transition-all"
                                                            style={{ width: `${Math.min((material.deployedQty / (material.quantity || 1)) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Receipt Detail Modal */}
                {selectedReceipt && (
                    <ReceiptModal
                        receipt={selectedReceipt}
                        onClose={() => setSelectedReceipt(null)}
                        onDelete={(receipt) => handleDeleteMaterial(receipt)}
                    />
                )}
                
                {/* Link Google Sheet Modal */}
                <LinkSheetModal />
                
                {/* Webhook Setup Modal */}
                <WebhookSetupModal />
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // SHARED PDF PARSER — used by Detail Modal for inline receiver upload
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAP_parseMaterialPdf = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Thumbnail from first page
        const page = await pdf.getPage(1);
        const scale = 0.5;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);

        // Extract text from first 3 pages
        let fullText = '';
        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
            const textPage = await pdf.getPage(pageNum);
            const textContent = await textPage.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + ' ';
        }

        // Reuse the same parse logic as MaterialReceivers component
        const upperText = fullText.toUpperCase();
        let receiptNumber = '';
        const invMatch = fullText.match(/(?:RECEIPT|INVOICE|ORDER)\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]{3,})/i)
            || fullText.match(/\bPO\s*#\s*([A-Z0-9\-]{3,})/i)
            || fullText.match(/\b(INV[#\-]?\d{4,})\b/i);
        if (invMatch) receiptNumber = invMatch[1].trim();
        else { const fm = file.name.match(/(\d{5,})/); receiptNumber = fm ? `INV-${fm[1]}` : `INV-${Date.now().toString().slice(-6)}`; }

        let dateReceived = new Date().toLocaleDateString();
        for (const pattern of [/(\d{1,2}\/\d{1,2}\/\d{2,4})/, /(\d{4}-\d{2}-\d{2})/, /(?:DATE|RECEIVED)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i]) {
            const m = fullText.match(pattern);
            if (m) { dateReceived = m[1]; break; }
        }

        const commonClients = ['NETFLIX','NIKE','APPLE','AMAZON','DISNEY','WARNER','PARAMOUNT','UNIVERSAL','SONY','HBO','HULU','GOOGLE','META','FACEBOOK','MICROSOFT'];
        let client = '';
        for (const c of commonClients) { if (upperText.includes(c)) { client = c; break; } }
        if (!client) {
            const cm = fullText.match(/(?:CLIENT|CUSTOMER|ADVERTISER|BILL TO)[:\s]*([^:\n]{2,30}?)(?=\s*(?:Printer|Vendor|Receipt|Invoice|Comments|Date|Qty|Total|Description|\n|$))/i)
                || fullText.match(/(?:CLIENT|CUSTOMER|ADVERTISER|BILL TO)[:\s]*([^:\n]{2,30})/i);
            client = cm ? cm[1].trim().substring(0, 30) : 'Unknown Client';
        }

        let quantity = 1;
        // Try multiple quantity patterns — most specific first
        // Note: quantities can be decimal (e.g. "48.0") — match \d+\.?\d* then parseInt
        const qtyPatterns = [
            /Total\s*Received[:\s]*(\d+\.?\d*)/i,
            /(?:TOTAL\s*(?:QUANTITY|QTY|UNITS|FACES|SHEETS|POSTERS)?)[:\s]*(\d+\.?\d*)/i,
            /\bQty\b[^]*?(\d{2,}\.?\d*)/i,
            /(?:QTY|QUANTITY|UNITS|FACES|SHEETS|POSTERS)[:\s]*(\d+\.?\d*)/i,
            /(\d+\.?\d*)\s*(?:POSTERS|FACES|SHEETS|UNITS|PCS|PIECES|PANELS)\b/i,
            /(?:SHIP|DELIVER|SEND|TOTAL)[:\s]*(\d{2,}\.?\d*)/i,
        ];
        for (const pat of qtyPatterns) {
            const qm = fullText.match(pat);
            if (qm && parseInt(qm[1]) > 1) { quantity = parseInt(qm[1]); break; }
        }

        let description = 'Material Receipt';
        const dm = fullText.match(/(?:DESCRIPTION)[:\s]*([^:]{5,50}?)(?=\s*(?:Client|Printer|Comments|Receipt|Invoice|Poster|Code|Date|Qty|Total))/i)
            || fullText.match(/(?:DESCRIPTION)[:\s]*([^:]{5,40})/i);
        if (dm) description = dm[1].trim();

        let printer = '';
        const pm = fullText.match(/(?:PRINTER|VENDOR|SHIP FROM)[:\s]*([A-Za-z][A-Za-z\s&]*?)(?=\s*(?:Comments|Client|Receipt|Invoice|Poster|Code|Date|Qty|Total|Description|\n|$|:))/i);
        if (pm) printer = pm[1].trim().substring(0, 30);
        if (!printer) {
            const pf = fullText.match(/(?:PRINTER|VENDOR|SHIP FROM)[:\s]*([^:\n]{2,30})/i);
            if (pf) printer = pf[1].trim().replace(/\s+(Comments|Client|Receipt|Poster|Date|Qty).*$/i, '').trim();
        }
        if (!printer && upperText.includes('CIRCLE GRAPHICS')) printer = 'Circle Graphics';

        let posterCode = receiptNumber;
        const cm = fullText.match(/(?:POSTER\s*CODE|CODE|SKU)[:\s]*([A-Z0-9\-]+)/i);
        if (cm) posterCode = cm[1].trim();

        let pdfComments = '';
        const commMatch = fullText.match(/(?:COMMENTS|NOTES|REMARKS)[:\s]*(.+?)(?=\s*(?:Receipt|Invoice|Poster|Transaction|Total|Summary|Client|Printer|Date|Qty|\b[A-Z][a-z]+:))/i)
            || fullText.match(/(?:COMMENTS|NOTES|REMARKS)[:\s]*([^]{3,80})/i);
        if (commMatch) pdfComments = commMatch[1].trim();

        return {
            id: `PDF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            receiptNumber, dateReceived, description, posterCode,
            client, advertiser: client, printer: printer || 'Unknown Vendor',
            quantity, boxes: 1, designs: 1,
            comments: pdfComments || `Imported from: ${file.name}`,
            status: 'Received', warehouseLocation: '',
            posterImage: thumbnailUrl, pdfSource: file.name
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAPMaterialReceivers = {
        MaterialReceivers
    };

    console.log('✅ STAP Material Receivers loaded');

})(window);
