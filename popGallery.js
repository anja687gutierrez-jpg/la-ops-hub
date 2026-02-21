// ═══════════════════════════════════════════════════════════════════════════════
// STAP POP Gallery - Proof of Performance Component
// External module for LA STAP Operations Portal
// Must load AFTER icon.js (depends on window.STAP_Icon)
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useState, useEffect, useMemo, useRef, useCallback } = React;
    
    // Get Icon from global export
    const Icon = window.STAP_Icon || (({ name }) => React.createElement('span', { title: name }, '?'));

    const POPGallery = ({ data: rawData, onBack, setView }) => {
        // Safety: ensure data is always an array
        const data = Array.isArray(rawData) ? rawData : [];
        
        const [viewMode, setViewMode] = useState('campaigns'); // 'campaigns', 'grid', or 'list'
        const [selectedMarket, setSelectedMarket] = useState('ALL');
        const [selectedAdvertiser, setSelectedAdvertiser] = useState('ALL');
        const [selectedCampaign, setSelectedCampaign] = useState('ALL');
        const [selectedStatus, setSelectedStatus] = useState('ALL'); // NEW: Status filter
        const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
        const [searchTerm, setSearchTerm] = useState('');
        const [selectedPhoto, setSelectedPhoto] = useState(null);
        const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'advertiser', 'campaign'
        const [expandedCampaign, setExpandedCampaign] = useState(null); // For viewing all photos in a campaign
        
        // Local Folder State
        const [linkedFolder, setLinkedFolder] = useState(null); // Folder handle
        const [localPhotos, setLocalPhotos] = useState([]); // Photos from local folder
        const [scanningFolder, setScanningFolder] = useState(false);
        const [folderError, setFolderError] = useState(null);
        // Demo data toggle (disabled in production mode)
        const [showDemoData, setShowDemoData] = useState(false);
        
        // Google Sheet POP Log State
        const [popSheetUrl, setPopSheetUrl] = useState(localStorage.getItem('stap_pop_sheet_url') || '');
        const [popCampaigns, setPopCampaigns] = useState([]);
        const [popLoading, setPopLoading] = useState(false);
        const [popError, setPopError] = useState('');
        const [popLastSync, setPopLastSync] = useState(null);
        const [showPopLinkModal, setShowPopLinkModal] = useState(false);
        
        // ============================================
        // PHOTO ANALYSIS STATE (OCR & Recognition)
        // ============================================
        const [photoAnalysis, setPhotoAnalysis] = useState({}); // { photoId: { text, matchScore, flags, analyzing } }
        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const [analysisQueue, setAnalysisQueue] = useState([]);
        const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

        // Fetch POP data from Google Sheet
        const handleConnectPopSheet = async () => {
            if (!popSheetUrl) return;
            
            setPopLoading(true);
            setPopError('');
            
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(popSheetUrl)}`;
                const response = await fetch(proxyUrl);
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const text = await response.text();
                const lines = text.split('\n').filter(l => l.trim());
                
                if (lines.length < 2) throw new Error('No data found in spreadsheet');
                
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
                const campaigns = lines.slice(1).map((line, idx) => {
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
                    
                    // Map to object
                    const row = {};
                    headers.forEach((h, i) => row[h] = values[i] || '');
                    
                    // Find folder link
                    let folderLink = null;
                    for (const [key, value] of Object.entries(row)) {
                        if (value && typeof value === 'string' && (value.includes('drive.google.com') || value.includes('http'))) {
                            folderLink = value;
                            break;
                        }
                    }
                    
                    // Auto-detect fields
                    const getField = (keywords) => {
                        for (const [key, value] of Object.entries(row)) {
                            if (keywords.some(k => key.includes(k)) && value) return value;
                        }
                        return '';
                    };
                    
                    return {
                        id: `pop-${idx}`,
                        campaignNumber: getField(['campaign', 'id', 'number']) || `POP-${idx}`,
                        advertiser: getField(['advertiser', 'client', 'customer']) || 'Unknown',
                        description: getField(['desc', 'location', 'address', 'site']) || '',
                        market: getField(['market', 'city']) || 'Los Angeles',
                        installDate: getField(['date', 'install']),
                        folderLink: folderLink,
                        hasEvidence: !!folderLink
                    };
                }).filter(c => c.campaignNumber || c.advertiser);
                
                setPopCampaigns(campaigns);
                setPopLastSync(new Date());
                localStorage.setItem('stap_pop_sheet_url', popSheetUrl);
                setShowPopLinkModal(false);
                
                console.log(`📸 Loaded ${campaigns.length} POP campaigns from Google Sheet`);
            } catch (err) {
                console.error('Failed to fetch POP sheet:', err);
                setPopError(`Failed to connect: ${err.message}`);
            } finally {
                setPopLoading(false);
            }
        };

        // Load saved POP sheet URL on mount and auto-reconnect
        useEffect(() => {
            const savedUrl = localStorage.getItem('stap_pop_sheet_url');
            if (savedUrl) {
                setPopSheetUrl(savedUrl);
                // Auto-fetch POP data
                const autoFetchPOPs = async () => {
                    setPopLoading(true);
                    try {
                        let csvUrl = savedUrl;
                        const match = savedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
                        if (match) {
                            const sheetId = match[1];
                            const gidMatch = savedUrl.match(/gid=(\d+)/);
                            const gid = gidMatch ? gidMatch[1] : '0';
                            csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
                        }
                        
                        const response = await fetch(csvUrl);
                        if (!response.ok) throw new Error('Failed to fetch');
                        const text = await response.text();
                        const lines = text.split('\n').filter(l => l.trim());
                        if (lines.length < 2) throw new Error('No data');
                        
                        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
                        const campaigns = lines.slice(1).map((line, idx) => {
                            const values = [];
                            let current = '';
                            let inQuotes = false;
                            for (const char of line) {
                                if (char === '"') inQuotes = !inQuotes;
                                else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
                                else current += char;
                            }
                            values.push(current.trim());
                            
                            const row = {};
                            headers.forEach((h, i) => row[h] = values[i] || '');
                            
                            return {
                                id: row['campaign id'] || row['id'] || `pop_${idx}`,
                                advertiser: row['advertiser'] || row['client'] || '',
                                campaign: row['campaign'] || row['campaign name'] || '',
                                market: row['market'] || '',
                                product: row['product type'] || row['product'] || '',
                                startDate: row['start date'] || row['start'] || '',
                                endDate: row['end date'] || row['end'] || '',
                                address: row['address'] || row['location'] || '',
                                popUrl: row['pop url'] || row['pop'] || row['image'] || '',
                                status: row['status'] || 'Pending'
                            };
                        });
                        
                        setPopCampaigns(campaigns.filter(c => c.advertiser || c.campaign));
                        setPopLastSync(new Date());
                        console.log(`📷 Auto-reconnected: Loaded ${campaigns.length} POPs from Google Sheet`);
                    } catch (err) {
                        console.error('POP auto-reconnect failed:', err);
                    } finally {
                        setPopLoading(false);
                    }
                };
                autoFetchPOPs();
            }
        }, []);

        // Generate expected keywords from campaign data
        const getExpectedKeywords = (photo) => {
            const keywords = new Set();
            
            // Add advertiser name and variations
            if (photo.advertiser) {
                photo.advertiser.split(/[\s-]+/).forEach(word => {
                    if (word.length > 2) keywords.add(word.toLowerCase());
                });
            }
            
            // Add campaign name words
            if (photo.campaign) {
                photo.campaign.split(/[\s-]+/).forEach(word => {
                    if (word.length > 2) keywords.add(word.toLowerCase());
                });
            }
            
            // Add product type
            if (photo.product) {
                photo.product.split(/[\s-]+/).forEach(word => {
                    if (word.length > 2) keywords.add(word.toLowerCase());
                });
            }
            
            // Common ad-related words to look for
            const commonAdWords = ['sale', 'new', 'now', 'free', 'limited', 'exclusive', 'shop', 'buy', 'get', 'save', 'offer'];
            
            return {
                primary: [...keywords], // Must match at least one
                common: commonAdWords
            };
        };

        // Calculate match score between detected text and expected keywords
        const calculateMatchScore = (detectedText, expectedKeywords) => {
            if (!detectedText || detectedText.length < 3) {
                return { score: 0, matched: [], unmatched: [], suspicious: [] };
            }
            
            const words = detectedText.toLowerCase().split(/[\s\n\r]+/).filter(w => w.length > 2);
            const matched = [];
            const suspicious = [];
            
            // Check for primary keyword matches
            expectedKeywords.primary.forEach(keyword => {
                if (words.some(w => w.includes(keyword) || keyword.includes(w))) {
                    matched.push(keyword);
                }
            });
            
            // Check for suspicious/graffiti words
            const graffitiPatterns = ['tag', 'crew', 'fuck', 'shit', 'dick', 'ass', 'hate', 'kill', 'gang'];
            words.forEach(word => {
                if (graffitiPatterns.some(pattern => word.includes(pattern))) {
                    suspicious.push(word);
                }
            });
            
            // Also flag random letter combinations (potential graffiti tags)
            words.forEach(word => {
                // If word is 2-4 chars, all caps style, and not a known word
                if (word.length >= 2 && word.length <= 5 && 
                    !expectedKeywords.primary.includes(word) && 
                    !expectedKeywords.common.includes(word) &&
                    /^[a-z]+$/.test(word)) {
                    // Could be a graffiti tag - flag if it seems random
                    const vowels = (word.match(/[aeiou]/g) || []).length;
                    if (vowels === 0 || vowels > 3) {
                        suspicious.push(word);
                    }
                }
            });
            
            // Calculate score
            const primaryMatches = matched.length;
            const primaryTotal = expectedKeywords.primary.length || 1;
            const score = Math.min(100, Math.round((primaryMatches / primaryTotal) * 100));
            
            return {
                score,
                matched,
                unmatched: expectedKeywords.primary.filter(k => !matched.includes(k)),
                suspicious: [...new Set(suspicious)],
                totalWords: words.length,
                detectedText: detectedText.substring(0, 500) // Truncate for display
            };
        };

        // Analyze a single photo using Tesseract OCR
        const analyzePhoto = async (photo) => {
            if (!photo || !photo.photoUrl) return null;
            
            // Mark as analyzing
            setPhotoAnalysis(prev => ({
                ...prev,
                [photo.id]: { ...prev[photo.id], analyzing: true }
            }));
            
            try {
                // Check if Tesseract is available
                if (typeof Tesseract === 'undefined') {
                    throw new Error('Tesseract.js not loaded');
                }
                
                console.log('Analyzing photo:', photo.id);
                
                // Run OCR
                const result = await Tesseract.recognize(
                    photo.photoUrl,
                    'eng',
                    {
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                // Could update progress here
                                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                            }
                        }
                    }
                );
                
                const detectedText = result.data.text;
                const expectedKeywords = getExpectedKeywords(photo);
                const matchResult = calculateMatchScore(detectedText, expectedKeywords);
                
                // Determine flags
                const flags = [];
                if (matchResult.score < 30) flags.push('LOW_MATCH');
                if (matchResult.score === 0 && detectedText.length > 10) flags.push('WRONG_POSTER');
                if (matchResult.suspicious.length > 0) flags.push('GRAFFITI_DETECTED');
                if (detectedText.length < 5) flags.push('NO_TEXT_FOUND');
                if (matchResult.score >= 70) flags.push('VERIFIED');
                
                const analysis = {
                    analyzing: false,
                    timestamp: new Date(),
                    text: detectedText,
                    ...matchResult,
                    flags,
                    confidence: result.data.confidence,
                    expectedKeywords: expectedKeywords.primary
                };
                
                setPhotoAnalysis(prev => ({
                    ...prev,
                    [photo.id]: analysis
                }));
                
                return analysis;
                
            } catch (error) {
                console.error('OCR Error:', error);
                
                setPhotoAnalysis(prev => ({
                    ...prev,
                    [photo.id]: {
                        analyzing: false,
                        error: error.message,
                        flags: ['SCAN_ERROR']
                    }
                }));
                
                return null;
            }
        };

        // Analyze all photos in a campaign
        const analyzeCampaign = async (campaign) => {
            if (!campaign || !campaign.photos) return;
            
            setIsAnalyzing(true);
            const results = [];
            
            for (let i = 0; i < campaign.photos.length; i++) {
                const photo = campaign.photos[i];
                // Skip already analyzed
                if (photoAnalysis[photo.id] && !photoAnalysis[photo.id].error) {
                    results.push(photoAnalysis[photo.id]);
                    continue;
                }
                
                const result = await analyzePhoto(photo);
                if (result) results.push(result);
                
                // Small delay to prevent UI freeze
                await new Promise(r => setTimeout(r, 100));
            }
            
            setIsAnalyzing(false);
            return results;
        };

        // Get campaign analysis summary
        const getCampaignAnalysisSummary = (campaign) => {
            if (!campaign || !campaign.photos) return null;
            
            const analyzed = campaign.photos.filter(p => photoAnalysis[p.id] && !photoAnalysis[p.id].analyzing);
            if (analyzed.length === 0) return null;
            
            const verified = analyzed.filter(p => photoAnalysis[p.id].flags?.includes('VERIFIED')).length;
            const issues = analyzed.filter(p => 
                photoAnalysis[p.id].flags?.includes('GRAFFITI_DETECTED') ||
                photoAnalysis[p.id].flags?.includes('LOW_MATCH') ||
                photoAnalysis[p.id].flags?.includes('WRONG_POSTER')
            ).length;
            const avgScore = Math.round(analyzed.reduce((sum, p) => sum + (photoAnalysis[p.id].score || 0), 0) / analyzed.length);
            
            return {
                analyzed: analyzed.length,
                total: campaign.photos.length,
                verified,
                issues,
                avgScore,
                needsReview: issues > 0
            };
        };
        
        // Debug: Log data received
        console.log('POPGallery received data:', data.length, 'campaigns');

        // Debug: Log data received
        console.log('POPGallery received data:', data.length, 'campaigns');
        
        // NOTE: No pre-populated fake analysis - let real OCR run on actual photos
        // Demo photos are placeholders - real install photos would be scanned

        // Scan local folder for photos
        // Expected structure: Market / Campaign ID / Date (optional) / photos
        const scanFolder = async (dirHandle, path = '') => {
            const photos = [];
            
            try {
                for await (const entry of dirHandle.values()) {
                    const entryPath = path ? `${path}/${entry.name}` : entry.name;
                    
                    if (entry.kind === 'directory') {
                        // Recurse into subdirectory
                        const subPhotos = await scanFolder(entry, entryPath);
                        photos.push(...subPhotos);
                    } else if (entry.kind === 'file') {
                        // Check if it's an image
                        const ext = entry.name.toLowerCase().split('.').pop();
                        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
                            // Parse path: Market / Campaign ID / Date / photo
                            const pathParts = entryPath.split('/');
                            let market = '', campaignId = '', dateStr = '', fileName = entry.name;
                            
                            if (pathParts.length >= 2) {
                                market = pathParts[0];
                                campaignId = pathParts[1];
                                if (pathParts.length >= 3) {
                                    // Check if 3rd part is a date or just the filename
                                    const possibleDate = pathParts[2];
                                    if (possibleDate.match(/^\d{4}-\d{2}-\d{2}$/) || possibleDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
                                        dateStr = possibleDate;
                                        fileName = pathParts[3] || entry.name;
                                    } else if (pathParts.length === 3) {
                                        // No date folder, file is directly under campaign
                                        fileName = possibleDate;
                                    }
                                }
                            }
                            
                            // Get file for creating object URL
                            const file = await entry.getFile();
                            const objectUrl = URL.createObjectURL(file);
                            
                            // Parse install date
                            let installDate = new Date();
                            if (dateStr) {
                                const parsed = new Date(dateStr);
                                if (!isNaN(parsed.getTime())) {
                                    installDate = parsed;
                                }
                            }
                            
                            // Try to match campaign ID to uploaded data for more details
                            const matchedCampaign = data.find(d => d.campaignNumber === campaignId);
                            
                            photos.push({
                                id: `local-${entryPath}`,
                                campaignNumber: campaignId,
                                market: market,
                                advertiser: matchedCampaign?.advertiser || 'Unknown',
                                campaign: matchedCampaign?.campaign || campaignId,
                                product: matchedCampaign?.product || 'Unknown',
                                quantity: matchedCampaign?.quantity || matchedCampaign?.totalQty || '-',
                                installDate: installDate,
                                stage: matchedCampaign?.stage || 'Installed',
                                owner: matchedCampaign?.owner || '-',
                                photoUrl: objectUrl,
                                thumbnailUrl: objectUrl,
                                fileName: fileName,
                                filePath: entryPath,
                                fileSize: file.size,
                                isLocal: true,
                                fileHandle: entry
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Error scanning folder:', err);
            }
            
            return photos;
        };

        // Handle folder selection
        const handleLinkFolder = async () => {
            try {
                // Check if File System Access API is supported
                if (!window.showDirectoryPicker) {
                    setFolderError('Your browser does not support folder selection. Please use Chrome, Edge, or another Chromium-based browser.');
                    return;
                }
                
                setScanningFolder(true);
                setFolderError(null);
                
                // Open folder picker
                const dirHandle = await window.showDirectoryPicker({
                    mode: 'read'
                });
                
                setLinkedFolder(dirHandle);
                
                // Scan the folder
                const photos = await scanFolder(dirHandle);
                
                // Group photos by campaign to get total counts
                const campaignPhotoCounts = {};
                photos.forEach(p => {
                    if (!campaignPhotoCounts[p.campaignNumber]) {
                        campaignPhotoCounts[p.campaignNumber] = 0;
                    }
                    campaignPhotoCounts[p.campaignNumber]++;
                });
                
                // Add photo index info
                const photosWithIndex = photos.map(p => {
                    const sameCapaign = photos.filter(pp => pp.campaignNumber === p.campaignNumber);
                    const idx = sameCapaign.findIndex(pp => pp.id === p.id);
                    return {
                        ...p,
                        photoIndex: idx + 1,
                        totalPhotos: campaignPhotoCounts[p.campaignNumber]
                    };
                });
                
                setLocalPhotos(photosWithIndex);
                setShowDemoData(false); // Switch to local data
                setScanningFolder(false);
                
            } catch (err) {
                if (err.name === 'AbortError') {
                    // User cancelled - not an error
                    setScanningFolder(false);
                    return;
                }
                console.error('Error linking folder:', err);
                setFolderError(`Failed to link folder: ${err.message}`);
                setScanningFolder(false);
            }
        };

        // Refresh folder scan
        const handleRefreshFolder = async () => {
            if (!linkedFolder) return;
            
            setScanningFolder(true);
            const photos = await scanFolder(linkedFolder);
            
            const campaignPhotoCounts = {};
            photos.forEach(p => {
                if (!campaignPhotoCounts[p.campaignNumber]) {
                    campaignPhotoCounts[p.campaignNumber] = 0;
                }
                campaignPhotoCounts[p.campaignNumber]++;
            });
            
            const photosWithIndex = photos.map(p => {
                const sameCapaign = photos.filter(pp => pp.campaignNumber === p.campaignNumber);
                const idx = sameCapaign.findIndex(pp => pp.id === p.id);
                return {
                    ...p,
                    photoIndex: idx + 1,
                    totalPhotos: campaignPhotoCounts[p.campaignNumber]
                };
            });
            
            setLocalPhotos(photosWithIndex);
            setScanningFolder(false);
        };

        // Extract unique values from MASTER TRACKER data for filters
        // Filters are driven by tracker data - photos will match via Campaign ID
        const markets = useMemo(() => {
            const trackerMarkets = data.map(d => d.market).filter(Boolean);
            // Also add markets from local photos if linked (for unmatched photos)
            const localMarkets = localPhotos.map(p => p.market).filter(Boolean);
            const unique = [...new Set([...trackerMarkets, ...localMarkets])];
            return unique.sort();
        }, [data, localPhotos]);

        const advertisers = useMemo(() => {
            let filtered = data;
            if (selectedMarket !== 'ALL') {
                filtered = filtered.filter(d => d.market === selectedMarket);
            }
            const trackerAdvertisers = filtered.map(d => d.advertiser);
            // Add local photo advertisers
            const localAdvertisers = localPhotos
                .filter(p => selectedMarket === 'ALL' || p.market === selectedMarket)
                .map(p => p.advertiser);
            const unique = [...new Set([...trackerAdvertisers, ...localAdvertisers].filter(Boolean))];
            return unique.sort();
        }, [data, localPhotos, selectedMarket]);

        const campaigns = useMemo(() => {
            let filtered = data;
            if (selectedMarket !== 'ALL') {
                filtered = filtered.filter(d => d.market === selectedMarket);
            }
            if (selectedAdvertiser !== 'ALL') {
                filtered = filtered.filter(d => d.advertiser === selectedAdvertiser);
            }
            const trackerCampaigns = filtered.map(d => d.campaignNumber);
            // Add local photo campaigns
            const localCampaigns = localPhotos
                .filter(p => selectedMarket === 'ALL' || p.market === selectedMarket)
                .filter(p => selectedAdvertiser === 'ALL' || p.advertiser === selectedAdvertiser)
                .map(p => p.campaignNumber);
            const unique = [...new Set([...trackerCampaigns, ...localCampaigns].filter(Boolean))];
            return unique.sort();
        }, [data, localPhotos, selectedMarket, selectedAdvertiser]);

        // Create a lookup for expected quantities from Master Tracker
        const campaignExpectedQty = useMemo(() => {
            const lookup = {};
            data.forEach(d => {
                if (d.campaignNumber) {
                    lookup[d.campaignNumber] = {
                        expectedQty: parseInt(d.quantity) || parseInt(d.totalQty) || 0,
                        advertiser: d.advertiser,
                        product: d.product,
                        market: d.market,
                        startDate: d.date || d.dateObj,
                        stage: d.stage,
                        owner: d.owner
                    };
                }
            });
            return lookup;
        }, [data]);

        // POP data - empty in production until real photos are linked
        // Real photos come from localPhotos (linked folder) or popCampaigns (Google Sheet)
        const popData = useMemo(() => {
            return [];
        }, [data]);

        // Count photos per campaign (for comparison with expected qty)
        const photoCountByCampaign = useMemo(() => {
            const photoSource = (localPhotos.length > 0 && !showDemoData) ? localPhotos : popData;
            const counts = {};
            photoSource.forEach(p => {
                if (p.campaignNumber) {
                    if (!counts[p.campaignNumber]) {
                        counts[p.campaignNumber] = 0;
                    }
                    counts[p.campaignNumber]++;
                }
            });
            return counts;
        }, [localPhotos, popData, showDemoData]);

        // Filter POP data - use local photos if linked, otherwise demo data
        const filteredPOP = useMemo(() => {
            // Choose data source: local folder photos or demo data
            const sourceData = (localPhotos.length > 0 && !showDemoData) ? localPhotos : popData;
            let filtered = [...sourceData];

            // Market filter
            if (selectedMarket !== 'ALL') {
                filtered = filtered.filter(p => p.market === selectedMarket);
            }

            // Advertiser filter
            if (selectedAdvertiser !== 'ALL') {
                filtered = filtered.filter(p => p.advertiser === selectedAdvertiser);
            }

            // Campaign filter
            if (selectedCampaign !== 'ALL') {
                filtered = filtered.filter(p => p.campaignNumber === selectedCampaign);
            }

            // Status filter (NEW)
            if (selectedStatus !== 'ALL') {
                if (selectedStatus === 'POP Completed') {
                    filtered = filtered.filter(p => p.stage === 'POP Completed');
                } else if (selectedStatus === 'Photos Taken') {
                    filtered = filtered.filter(p => p.stage === 'Photos Taken');
                } else if (selectedStatus === 'Installed') {
                    filtered = filtered.filter(p => p.stage === 'Installed');
                } else if (selectedStatus === 'Needs Photos') {
                    // Show installed campaigns that might need more photos
                    filtered = filtered.filter(p => p.stage === 'Installed' && !p.stage?.includes('POP'));
                }
            }

            // Date filter
            if (dateFilter.start) {
                const startDate = new Date(dateFilter.start);
                filtered = filtered.filter(p => p.installDate >= startDate);
            }
            if (dateFilter.end) {
                const endDate = new Date(dateFilter.end);
                filtered = filtered.filter(p => p.installDate <= endDate);
            }

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(p => 
                    p.campaignNumber?.toLowerCase().includes(term) ||
                    p.advertiser?.toLowerCase().includes(term) ||
                    p.campaign?.toLowerCase().includes(term) ||
                    p.product?.toLowerCase().includes(term) ||
                    p.market?.toLowerCase().includes(term) ||
                    p.fileName?.toLowerCase().includes(term)
                );
            }

            // Sort
            switch (sortBy) {
                case 'date-desc':
                    filtered.sort((a, b) => b.installDate - a.installDate);
                    break;
                case 'date-asc':
                    filtered.sort((a, b) => a.installDate - b.installDate);
                    break;
                case 'advertiser':
                    filtered.sort((a, b) => (a.advertiser || '').localeCompare(b.advertiser || ''));
                    break;
                case 'campaign':
                    filtered.sort((a, b) => (a.campaignNumber || '').localeCompare(b.campaignNumber || ''));
                    break;
            }

            return filtered;
        }, [popData, localPhotos, showDemoData, selectedMarket, selectedAdvertiser, selectedCampaign, selectedStatus, dateFilter, searchTerm, sortBy]);

        // Campaign validation - compare photos vs Master Tracker expected quantities
        const campaignValidation = useMemo(() => {
            // Group photos by campaign
            const photosByCampaign = {};
            filteredPOP.forEach(p => {
                if (!photosByCampaign[p.campaignNumber]) {
                    photosByCampaign[p.campaignNumber] = [];
                }
                photosByCampaign[p.campaignNumber].push(p);
            });

            // Check against master tracking data
            const validation = {
                matched: [],      // Photo count matches expected
                mismatched: [],   // Photo count doesn't match
                notInTracker: [], // Campaign in photos but not in master tracker
                missingPhotos: [] // Campaign in tracker but no photos yet
            };

            // Check each campaign in photos
            Object.keys(photosByCampaign).forEach(campaignId => {
                const photos = photosByCampaign[campaignId];
                const trackerEntry = data.find(d => d.campaignNumber === campaignId);
                
                if (!trackerEntry) {
                    validation.notInTracker.push({
                        campaignNumber: campaignId,
                        photoCount: photos.length,
                        photos: photos
                    });
                } else {
                    const expectedQty = trackerEntry.quantity || trackerEntry.totalQty || 0;
                    // For now, we're just counting unique photo entries per campaign
                    // In real scenario, you might want different logic
                    const uniquePhotos = photos.length;
                    
                    if (uniquePhotos > 0) {
                        validation.matched.push({
                            campaignNumber: campaignId,
                            photoCount: uniquePhotos,
                            expectedQty: expectedQty,
                            advertiser: trackerEntry.advertiser,
                            status: trackerEntry.stage
                        });
                    }
                }
            });

            // Check for campaigns in tracker that should have photos but don't
            const installedCampaigns = data.filter(d => 
                d.stage === 'Installed' || d.stage === 'Photos Taken' || d.stage === 'POP Completed'
            );
            installedCampaigns.forEach(campaign => {
                if (!photosByCampaign[campaign.campaignNumber]) {
                    validation.missingPhotos.push({
                        campaignNumber: campaign.campaignNumber,
                        advertiser: campaign.advertiser,
                        expectedQty: campaign.quantity || campaign.totalQty || 0,
                        status: campaign.stage
                    });
                }
            });

            return validation;
        }, [filteredPOP, data]);

        // Group by campaign for summary stats
        const stats = useMemo(() => {
            const uniqueCampaigns = new Set(filteredPOP.map(p => p.campaignNumber));
            const uniqueAdvertisers = new Set(filteredPOP.map(p => p.advertiser));
            const uniqueMarkets = new Set(filteredPOP.map(p => p.market));
            const localCount = filteredPOP.filter(p => p.isLocal).length;
            
            return {
                totalPhotos: filteredPOP.length,
                campaigns: uniqueCampaigns.size,
                advertisers: uniqueAdvertisers.size,
                markets: uniqueMarkets.size,
                localPhotos: localCount,
                isShowingLocal: localPhotos.length > 0 && !showDemoData
            };
        }, [filteredPOP, localPhotos, showDemoData]);

        // Group photos by campaign for Campaign Cards view
        const campaignGroups = useMemo(() => {
            const groups = {};
            
            filteredPOP.forEach(photo => {
                const cid = photo.campaignNumber;
                if (!cid) return;
                
                if (!groups[cid]) {
                    // Get expected qty from tracker
                    const trackerInfo = campaignExpectedQty[cid] || {};
                    groups[cid] = {
                        campaignNumber: cid,
                        advertiser: photo.advertiser || trackerInfo.advertiser || 'Unknown',
                        campaign: photo.campaign || trackerInfo.campaign || cid,
                        market: photo.market || trackerInfo.market || 'Unknown',
                        product: photo.product || trackerInfo.product || 'Unknown',
                        stage: photo.stage || trackerInfo.stage || 'Unknown',
                        owner: photo.owner || trackerInfo.owner || '-',
                        expectedQty: trackerInfo.expectedQty || 0,
                        photos: [],
                        coverPhoto: null,
                        latestDate: null
                    };
                }
                
                groups[cid].photos.push(photo);
                
                // Set cover photo (first photo)
                if (!groups[cid].coverPhoto) {
                    groups[cid].coverPhoto = photo;
                }
                
                // Track latest date
                if (photo.installDate && (!groups[cid].latestDate || photo.installDate > groups[cid].latestDate)) {
                    groups[cid].latestDate = photo.installDate;
                }
            });
            
            // Convert to array and calculate progress
            const groupArray = Object.values(groups).map(g => ({
                ...g,
                photoCount: g.photos.length,
                progress: g.expectedQty > 0 ? Math.min(100, Math.round((g.photos.length / g.expectedQty) * 100)) : 0,
                isComplete: g.expectedQty > 0 && g.photos.length >= g.expectedQty,
                missing: g.expectedQty > 0 ? Math.max(0, g.expectedQty - g.photos.length) : 0
            }));
            
            // Sort by latest date or photo count
            groupArray.sort((a, b) => {
                if (sortBy === 'date-desc') return (b.latestDate || 0) - (a.latestDate || 0);
                if (sortBy === 'date-asc') return (a.latestDate || 0) - (b.latestDate || 0);
                if (sortBy === 'advertiser') return (a.advertiser || '').localeCompare(b.advertiser || '');
                return (a.campaignNumber || '').localeCompare(b.campaignNumber || '');
            });
            
            return groupArray;
        }, [filteredPOP, campaignExpectedQty, sortBy]);

        // Expanded Campaign Modal - shows all photos for a campaign
        const CampaignPhotosModal = ({ campaign, onClose }) => {
            if (!campaign) return null;
            
            const [photoIndex, setPhotoIndex] = useState(0);
            const [viewAllGrid, setViewAllGrid] = useState(true);
            const [showAnalysis, setShowAnalysis] = useState(false);
            const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
            
            // Get analysis summary for this campaign
            const analysisSummary = getCampaignAnalysisSummary(campaign);
            
            // Run analysis on all photos
            const handleAnalyzeAll = async () => {
                setScanProgress({ current: 0, total: campaign.photos.length });
                setShowAnalysis(true);
                
                for (let i = 0; i < campaign.photos.length; i++) {
                    const photo = campaign.photos[i];
                    if (!photoAnalysis[photo.id] || photoAnalysis[photo.id].error) {
                        await analyzePhoto(photo);
                    }
                    setScanProgress({ current: i + 1, total: campaign.photos.length });
                }
            };
            
            // Get flag badge color
            const getFlagColor = (flag) => {
                switch(flag) {
                    case 'VERIFIED': return 'bg-green-500 text-white';
                    case 'GRAFFITI_DETECTED': return 'bg-red-500 text-white';
                    case 'LOW_MATCH': return 'bg-amber-500 text-white';
                    case 'WRONG_POSTER': return 'bg-red-600 text-white';
                    case 'NO_TEXT_FOUND': return 'bg-gray-500 text-white';
                    case 'SCAN_ERROR': return 'bg-gray-600 text-white';
                    default: return 'bg-gray-500 text-white';
                }
            };
            
            return (
                <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={onClose}>
                    <div className="flex-1 flex flex-col max-h-screen" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-700">
                            <div className="flex items-center gap-4">
                                <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-white">
                                    <Icon name="ArrowLeft" size={20} />
                                </button>
                                <div>
                                    <h3 className="text-white font-bold text-lg">{campaign.advertiser}</h3>
                                    <p className="text-gray-400 text-sm">
                                        {campaign.campaignNumber} • {campaign.product?.split('-').slice(0, 2).join('-')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {/* Analysis Summary */}
                                {analysisSummary && (
                                    <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg">
                                        <div className="flex items-center gap-1">
                                            <Icon name="CheckCircle" size={14} className="text-green-400" />
                                            <span className="text-green-400 text-sm font-bold">{analysisSummary.verified}</span>
                                        </div>
                                        {analysisSummary.issues > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Icon name="AlertTriangle" size={14} className="text-red-400" />
                                                <span className="text-red-400 text-sm font-bold">{analysisSummary.issues}</span>
                                            </div>
                                        )}
                                        <span className="text-gray-400 text-xs">
                                            {analysisSummary.analyzed}/{analysisSummary.total} scanned
                                        </span>
                                    </div>
                                )}
                                
                                {/* Analyze Button */}
                                <button 
                                    onClick={handleAnalyzeAll}
                                    disabled={isAnalyzing}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                                        isAnalyzing 
                                            ? 'bg-indigo-800 text-indigo-300 cursor-wait' 
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    }`}
                                >
                                    <Icon name={isAnalyzing ? "Loader" : "Scan"} size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                                    {isAnalyzing 
                                        ? `Scanning ${scanProgress.current}/${scanProgress.total}...` 
                                        : analysisSummary ? 'Re-scan All' : '🔍 Analyze Photos'
                                    }
                                </button>
                                
                                {/* Toggle Analysis Panel */}
                                <button 
                                    onClick={() => setShowAnalysis(!showAnalysis)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                                        showAnalysis ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'
                                    }`}
                                >
                                    <Icon name="FileSearch" size={16} />
                                    Analysis
                                </button>
                                
                                {/* Progress */}
                                <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-lg">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-white">{campaign.photoCount}</div>
                                        <div className="text-[10px] text-gray-400 uppercase">Photos</div>
                                    </div>
                                    <div className="text-gray-500 text-xl">/</div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-gray-400">{campaign.expectedQty || '?'}</div>
                                        <div className="text-[10px] text-gray-400 uppercase">Expected</div>
                                    </div>
                                    {campaign.expectedQty > 0 && (
                                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                                            campaign.isComplete ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                                        }`}>
                                            {campaign.isComplete ? '✓ Complete' : `${campaign.missing} missing`}
                                        </div>
                                    )}
                                </div>
                                {/* View toggle */}
                                <div className="flex bg-gray-800 rounded-lg p-1">
                                    <button 
                                        onClick={() => setViewAllGrid(true)}
                                        className={`px-3 py-1.5 rounded text-sm font-medium ${viewAllGrid ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Icon name="Grid" size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setViewAllGrid(false)}
                                        className={`px-3 py-1.5 rounded text-sm font-medium ${!viewAllGrid ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Icon name="Maximize" size={16} />
                                    </button>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-white">
                                    <Icon name="X" size={24} />
                                </button>
                            </div>
                        </div>
                        
                        {/* DEMO MODE Banner */}
                        {showDemoData && (
                            <div className="bg-amber-500 px-4 py-2 flex items-center justify-center gap-3">
                                <Icon name="AlertTriangle" size={16} className="text-amber-900" />
                                <span className="text-amber-900 text-sm font-medium">
                                    <strong>DEMO MODE:</strong> These are placeholder images. In production, real install photos would be scanned by OCR to verify advertiser text and detect graffiti.
                                </span>
                                <button 
                                    onClick={() => setShowAnalysis(true)}
                                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded"
                                >
                                    Try OCR Anyway →
                                </button>
                            </div>
                        )}
                        
                        {/* Content */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Main Photo Area */}
                            <div className={`flex-1 overflow-auto p-4 ${showAnalysis ? 'w-2/3' : 'w-full'}`}>
                                {viewAllGrid ? (
                                    /* Grid of all photos with analysis badges */
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                                        {campaign.photos.map((photo, idx) => {
                                            const analysis = photoAnalysis[photo.id];
                                            return (
                                                <div 
                                                    key={photo.id}
                                                    onClick={() => { setPhotoIndex(idx); setViewAllGrid(false); }}
                                                    className={`relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all group ${
                                                        analysis?.flags?.includes('GRAFFITI_DETECTED') || analysis?.flags?.includes('WRONG_POSTER') 
                                                            ? 'ring-2 ring-red-500' 
                                                            : analysis?.flags?.includes('VERIFIED') 
                                                                ? 'ring-2 ring-green-500' 
                                                                : 'hover:ring-2 hover:ring-indigo-500'
                                                    }`}
                                                >
                                                    <img 
                                                        src={photo.thumbnailUrl || photo.photoUrl}
                                                        alt={`Photo ${idx + 1}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                    {/* Photo number */}
                                                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                        {idx + 1}
                                                    </div>
                                                    {/* Analysis status badge */}
                                                    {analysis && !analysis.analyzing && (
                                                        <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                            analysis.flags?.includes('VERIFIED') ? 'bg-green-500 text-white' :
                                                            analysis.flags?.includes('GRAFFITI_DETECTED') ? 'bg-red-500 text-white' :
                                                            analysis.flags?.includes('LOW_MATCH') ? 'bg-amber-500 text-white' :
                                                            'bg-gray-600 text-white'
                                                        }`}>
                                                            {analysis.flags?.includes('VERIFIED') ? '✓' :
                                                             analysis.flags?.includes('GRAFFITI_DETECTED') ? '⚠️' :
                                                             analysis.flags?.includes('LOW_MATCH') ? '?' :
                                                             `${analysis.score || 0}%`}
                                                        </div>
                                                    )}
                                                    {/* Analyzing spinner */}
                                                    {analysis?.analyzing && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <Icon name="Loader" size={20} className="text-white animate-spin" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Single photo view with navigation */
                                    <div className="flex flex-col items-center justify-center h-full">
                                        <div className="relative max-w-4xl w-full">
                                            <img 
                                                src={campaign.photos[photoIndex]?.photoUrl}
                                                alt={`Photo ${photoIndex + 1}`}
                                                className="max-h-[70vh] mx-auto object-contain rounded-lg"
                                            />
                                            {/* Navigation */}
                                            <button 
                                                onClick={() => setPhotoIndex(i => i > 0 ? i - 1 : campaign.photos.length - 1)}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white"
                                            >
                                                <Icon name="ChevronLeft" size={24} />
                                            </button>
                                            <button 
                                                onClick={() => setPhotoIndex(i => i < campaign.photos.length - 1 ? i + 1 : 0)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white"
                                            >
                                                <Icon name="ChevronRight" size={24} />
                                            </button>
                                            
                                            {/* Single photo analysis badge */}
                                            {photoAnalysis[campaign.photos[photoIndex]?.id] && (
                                                <div className="absolute top-4 right-4 bg-gray-900/90 rounded-lg p-3 max-w-xs">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {photoAnalysis[campaign.photos[photoIndex].id].flags?.map(flag => (
                                                            <span key={flag} className={`px-2 py-0.5 rounded text-[10px] font-bold ${getFlagColor(flag)}`}>
                                                                {flag.replace(/_/g, ' ')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="text-white text-sm">
                                                        Match: <strong>{photoAnalysis[campaign.photos[photoIndex].id].score || 0}%</strong>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Photo counter */}
                                        <div className="mt-4 bg-gray-800 px-4 py-2 rounded-full text-white flex items-center gap-3">
                                            <span>{photoIndex + 1} / {campaign.photos.length}</span>
                                            {/* Quick analyze button for single photo */}
                                            {!photoAnalysis[campaign.photos[photoIndex]?.id] && (
                                                <button 
                                                    onClick={() => analyzePhoto(campaign.photos[photoIndex])}
                                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold"
                                                >
                                                    🔍 Scan
                                                </button>
                                            )}
                                        </div>
                                        {/* Thumbnail strip */}
                                        <div className="mt-4 flex gap-1 overflow-x-auto max-w-full pb-2">
                                            {campaign.photos.slice(0, 20).map((photo, idx) => (
                                                <button
                                                    key={photo.id}
                                                    onClick={() => setPhotoIndex(idx)}
                                                    className={`relative flex-shrink-0 w-12 h-12 rounded overflow-hidden ${idx === photoIndex ? 'ring-2 ring-indigo-500' : 'opacity-60 hover:opacity-100'}`}
                                                >
                                                    <img src={photo.thumbnailUrl || photo.photoUrl} alt="" className="w-full h-full object-cover" />
                                                    {photoAnalysis[photo.id]?.flags?.includes('GRAFFITI_DETECTED') && (
                                                        <div className="absolute inset-0 ring-2 ring-red-500 rounded"></div>
                                                    )}
                                                </button>
                                            ))}
                                            {campaign.photos.length > 20 && (
                                                <div className="flex-shrink-0 w-12 h-12 rounded bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
                                                    +{campaign.photos.length - 20}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Analysis Panel (Sidebar) */}
                            {showAnalysis && (
                                <div className="w-1/3 bg-gray-900 border-l border-gray-700 overflow-auto">
                                    <div className="p-4">
                                        <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                                            <Icon name="FileSearch" size={18} />
                                            Photo Analysis
                                        </h4>
                                        
                                        {/* Demo Mode Explanation */}
                                        {showDemoData && !analysisSummary && (
                                            <div className="mb-4 p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
                                                <div className="text-amber-300 text-xs mb-2 font-bold">📋 HOW IT WORKS:</div>
                                                <ol className="text-amber-200 text-[11px] space-y-1 list-decimal list-inside">
                                                    <li>OCR scans each photo for text</li>
                                                    <li>Compares found text to advertiser keywords</li>
                                                    <li>Flags graffiti or wrong posters</li>
                                                    <li>Generates match score %</li>
                                                </ol>
                                                <div className="mt-2 pt-2 border-t border-amber-700">
                                                    <div className="text-amber-400 text-[10px]">
                                                        ⚠️ Demo uses placeholder images. Real install photos would show actual OCR results.
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Summary Cards */}
                                        {analysisSummary && (
                                            <div className="grid grid-cols-2 gap-2 mb-4">
                                                <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-green-400">{analysisSummary.verified}</div>
                                                    <div className="text-[10px] text-green-300 uppercase">Verified</div>
                                                </div>
                                                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-red-400">{analysisSummary.issues}</div>
                                                    <div className="text-[10px] text-red-300 uppercase">Issues</div>
                                                </div>
                                                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-blue-400">{analysisSummary.avgScore}%</div>
                                                    <div className="text-[10px] text-blue-300 uppercase">Avg Match</div>
                                                </div>
                                                <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-gray-300">{analysisSummary.analyzed}/{analysisSummary.total}</div>
                                                    <div className="text-[10px] text-gray-400 uppercase">Scanned</div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Expected Keywords */}
                                        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                                            <div className="text-xs text-gray-400 mb-2 font-bold uppercase">Looking For:</div>
                                            <div className="flex flex-wrap gap-1">
                                                {getExpectedKeywords(campaign).primary.slice(0, 10).map(kw => (
                                                    <span key={kw} className="px-2 py-1 bg-indigo-600/50 text-indigo-200 rounded text-xs">
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Issue List */}
                                        <div className="mb-4">
                                            <div className="text-xs text-gray-400 mb-2 font-bold uppercase">⚠️ Photos Needing Review</div>
                                            <div className="space-y-2 max-h-64 overflow-auto">
                                                {campaign.photos.filter(p => 
                                                    photoAnalysis[p.id]?.flags?.includes('GRAFFITI_DETECTED') ||
                                                    photoAnalysis[p.id]?.flags?.includes('LOW_MATCH') ||
                                                    photoAnalysis[p.id]?.flags?.includes('WRONG_POSTER')
                                                ).map((photo, idx) => (
                                                    <div 
                                                        key={photo.id}
                                                        onClick={() => {
                                                            const realIdx = campaign.photos.findIndex(p => p.id === photo.id);
                                                            setPhotoIndex(realIdx);
                                                            setViewAllGrid(false);
                                                        }}
                                                        className="flex items-center gap-2 p-2 bg-red-900/30 border border-red-700 rounded-lg cursor-pointer hover:bg-red-900/50"
                                                    >
                                                        <img src={photo.thumbnailUrl || photo.photoUrl} className="w-10 h-10 rounded object-cover" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap gap-1">
                                                                {photoAnalysis[photo.id]?.flags?.map(flag => (
                                                                    <span key={flag} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getFlagColor(flag)}`}>
                                                                        {flag.replace(/_/g, ' ')}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            {photoAnalysis[photo.id]?.suspicious?.length > 0 && (
                                                                <div className="text-[10px] text-red-300 mt-1 truncate">
                                                                    Found: {photoAnalysis[photo.id].suspicious.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {campaign.photos.filter(p => 
                                                    photoAnalysis[p.id]?.flags?.includes('GRAFFITI_DETECTED') ||
                                                    photoAnalysis[p.id]?.flags?.includes('LOW_MATCH') ||
                                                    photoAnalysis[p.id]?.flags?.includes('WRONG_POSTER')
                                                ).length === 0 && (
                                                    <div className="text-center text-gray-500 text-sm py-4">
                                                        {analysisSummary ? 'No issues found ✓' : 'Run analysis to detect issues'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Current Photo Analysis Details */}
                                        {!viewAllGrid && photoAnalysis[campaign.photos[photoIndex]?.id] && (
                                            <div className="p-3 bg-gray-800 rounded-lg">
                                                <div className="text-xs text-gray-400 mb-2 font-bold uppercase">Current Photo Analysis</div>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Match Score:</span>
                                                        <span className={`font-bold ${
                                                            photoAnalysis[campaign.photos[photoIndex].id].score >= 70 ? 'text-green-400' :
                                                            photoAnalysis[campaign.photos[photoIndex].id].score >= 30 ? 'text-amber-400' :
                                                            'text-red-400'
                                                        }`}>
                                                            {photoAnalysis[campaign.photos[photoIndex].id].score}%
                                                        </span>
                                                    </div>
                                                    {photoAnalysis[campaign.photos[photoIndex].id].matched?.length > 0 && (
                                                        <div>
                                                            <span className="text-gray-400 text-xs">Matched:</span>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {photoAnalysis[campaign.photos[photoIndex].id].matched.map(m => (
                                                                    <span key={m} className="px-1.5 py-0.5 bg-green-600/50 text-green-200 rounded text-[10px]">{m}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {photoAnalysis[campaign.photos[photoIndex].id].suspicious?.length > 0 && (
                                                        <div>
                                                            <span className="text-red-400 text-xs">⚠️ Suspicious Text:</span>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {photoAnalysis[campaign.photos[photoIndex].id].suspicious.map(s => (
                                                                    <span key={s} className="px-1.5 py-0.5 bg-red-600/50 text-red-200 rounded text-[10px]">{s}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {photoAnalysis[campaign.photos[photoIndex].id].detectedText && (
                                                        <div className="mt-2">
                                                            <span className="text-gray-400 text-xs">Detected Text:</span>
                                                            <div className="mt-1 p-2 bg-gray-900 rounded text-[10px] text-gray-300 max-h-24 overflow-auto font-mono">
                                                                {photoAnalysis[campaign.photos[photoIndex].id].detectedText || 'No text detected'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        };
        const PhotoModal = ({ photo, onClose, onNext, onPrev }) => {
            if (!photo) return null;

            // Find all photos from same campaign
            const campaignPhotos = filteredPOP.filter(p => p.campaignNumber === photo.campaignNumber);
            const currentIndex = campaignPhotos.findIndex(p => p.id === photo.id);

            return (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={onClose}>
                    <div className="relative max-w-6xl w-full mx-4" onClick={e => e.stopPropagation()}>
                        {/* Close button */}
                        <button 
                            onClick={onClose}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
                        >
                            <Icon name="X" size={32} />
                        </button>

                        <div className="bg-gray-900 rounded-xl overflow-hidden">
                            <div className="flex flex-col lg:flex-row">
                                {/* Photo */}
                                <div className="flex-1 relative bg-black flex items-center justify-center min-h-[400px]">
                                    <img 
                                        src={photo.photoUrl} 
                                        alt={`${photo.advertiser} - ${photo.campaignNumber}`}
                                        className="max-w-full max-h-[70vh] object-contain"
                                    />
                                    
                                    {/* Navigation arrows */}
                                    {campaignPhotos.length > 1 && (
                                        <>
                                            <button 
                                                onClick={() => {
                                                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : campaignPhotos.length - 1;
                                                    setSelectedPhoto(campaignPhotos[prevIndex]);
                                                }}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                            >
                                                <Icon name="ChevronLeft" size={24} />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const nextIndex = currentIndex < campaignPhotos.length - 1 ? currentIndex + 1 : 0;
                                                    setSelectedPhoto(campaignPhotos[nextIndex]);
                                                }}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                            >
                                                <Icon name="ChevronRight" size={24} />
                                            </button>
                                        </>
                                    )}

                                    {/* Photo counter */}
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1 rounded-full text-white text-sm">
                                        {currentIndex + 1} / {campaignPhotos.length}
                                    </div>
                                </div>

                                {/* Details sidebar */}
                                <div className="w-full lg:w-80 p-6 bg-gray-800 text-white">
                                    <h3 className="text-lg font-bold mb-1">{photo.advertiser}</h3>
                                    <p className="text-gray-400 text-sm mb-4">{photo.campaign}</p>

                                    <div className="space-y-3">
                                        <div className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Campaign #</span>
                                            <span className="font-mono">{photo.campaignNumber}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Market</span>
                                            <span>{photo.market?.split(',')[0] || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Media Type</span>
                                            <span className="text-right text-sm">{photo.product || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Quantity</span>
                                            <span>{photo.quantity || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Install Date</span>
                                            <span>{photo.installDate?.toLocaleDateString() || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Status</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                photo.stage === 'Installed' ? 'bg-green-600' :
                                                photo.stage === 'POP Completed' ? 'bg-blue-600' :
                                                'bg-gray-600'
                                            }`}>{photo.stage}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Owner</span>
                                            <span>{photo.owner || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex gap-2">
                                        <button className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2">
                                            <Icon name="Download" size={16} /> Download
                                        </button>
                                        <button className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-bold transition-colors">
                                            <Icon name="Share2" size={16} />
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
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-1 hover:bg-indigo-200 rounded-full transition-colors" title="Back">
                            <Icon name="ArrowLeft" size={20} className="text-indigo-600" />
                        </button>
                        <div>
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Icon name="Camera" size={20} className="text-indigo-600" />
                                Proof of Performance Gallery
                            </h3>
                            <p className="text-sm text-gray-500">
                                Campaign evidence folders and installation documentation
                                {popCampaigns.length > 0 && <span className="ml-2 text-xs text-green-600">(📋 {popCampaigns.length} from POP Log)</span>}
                                {data.length > 0 && popCampaigns.length === 0 && <span className="ml-2 text-xs text-blue-600">(📊 {data.length} from tracker)</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* POP Sheet Connection */}
                        <button 
                            onClick={() => setShowPopLinkModal(true)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                                popLastSync 
                                    ? 'bg-green-100 border border-green-300 text-green-700 hover:bg-green-200' 
                                    : 'bg-amber-100 border border-amber-300 text-amber-700 hover:bg-amber-200'
                            }`}
                        >
                            <Icon name={popLastSync ? "CheckCircle" : "Link"} size={16} />
                            {popLastSync ? 'POP Log Connected' : 'Connect POP Log'}
                        </button>
                        {popLastSync && (
                            <button 
                                onClick={handleConnectPopSheet}
                                disabled={popLoading}
                                className="p-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-lg"
                                title="Refresh data"
                            >
                                <Icon name="RefreshCw" size={16} className={popLoading ? 'animate-spin' : ''} />
                            </button>
                        )}
                        <button 
                            onClick={() => setView && setView('performanceReport')}
                            className="px-3 py-1.5 bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            <Icon name="FileText" size={16} /> Report
                        </button>
                        <span className="text-sm text-gray-500 mr-2">{popCampaigns.length || stats.campaigns} campaigns</span>
                        <div className="flex bg-white border border-gray-300 rounded-lg p-0.5">
                            <button 
                                onClick={() => setViewMode('campaigns')}
                                className={`p-1.5 rounded transition-all ${viewMode === 'campaigns' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="Campaign Cards (Grouped)"
                            >
                                <Icon name="Layers" size={18} />
                            </button>
                            <button 
                                onClick={() => setViewMode('timeline')}
                                className={`p-1.5 rounded transition-all ${viewMode === 'timeline' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="Installation Timeline"
                            >
                                <Icon name="Calendar" size={18} />
                            </button>
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="All Photos Grid"
                            >
                                <Icon name="Grid" size={18} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="All Photos List"
                            >
                                <Icon name="List" size={18} />
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* POP Sheet Link Modal */}
                {showPopLinkModal && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowPopLinkModal(false)}>
                        <div className="bg-white rounded-xl max-w-xl w-full" onClick={e => e.stopPropagation()}>
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
                                <div className="text-white">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Icon name="FileSpreadsheet" size={24} /> Connect POP Master Log
                                    </h3>
                                    <p className="text-indigo-100 text-sm">Link your Proof of Performance spreadsheet</p>
                                </div>
                                <button onClick={() => setShowPopLinkModal(false)} className="text-white/80 hover:text-white p-2">
                                    <Icon name="X" size={24} />
                                </button>
                            </div>
                            
                            <div className="p-6">
                                {popError && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                        ⚠️ {popError}
                                    </div>
                                )}
                                
                                {popLastSync && (
                                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-green-700">
                                            <Icon name="CheckCircle" size={16} />
                                            <span className="text-sm">Connected • {popCampaigns.length} campaigns • Last sync: {popLastSync.toLocaleString()}</span>
                                        </div>
                                        <button 
                                            onClick={() => { setPopCampaigns([]); setPopLastSync(null); localStorage.removeItem('stap_pop_sheet_url'); }}
                                            className="text-red-600 hover:text-red-800 text-xs"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                )}
                                
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Published Sheet URL</label>
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                                        <strong>How to publish:</strong> In Google Sheets → File → Share → Publish to web → Select CSV → Copy link
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text"
                                            placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                                            value={popSheetUrl}
                                            onChange={e => setPopSheetUrl(e.target.value)}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                        <button 
                                            onClick={handleConnectPopSheet}
                                            disabled={!popSheetUrl || popLoading}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm flex items-center gap-2"
                                        >
                                            {popLoading ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Link" size={16} />}
                                            Connect
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                                    <strong>Expected columns:</strong> Campaign ID, Advertiser, Location/Description, Date, Folder Link (Google Drive URL)
                                </div>
                            </div>
                            
                            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end rounded-b-xl">
                                <button onClick={() => setShowPopLinkModal(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="px-6 py-4 border-b bg-gray-50">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Market Filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Market</label>
                            <select 
                                value={selectedMarket}
                                onChange={e => {
                                    setSelectedMarket(e.target.value);
                                    setSelectedAdvertiser('ALL');
                                    setSelectedCampaign('ALL');
                                }}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[200px]"
                            >
                                <option value="ALL">All Markets ({markets.length})</option>
                                {markets.map(m => {
                                    const marketCampaigns = data.filter(d => d.market === m).length;
                                    const marketPhotos = photoCountByCampaign ? Object.keys(photoCountByCampaign).filter(cid => {
                                        const photoSource = (localPhotos.length > 0 && !showDemoData) ? localPhotos : popData;
                                        return photoSource.some(p => p.campaignNumber === cid && p.market === m);
                                    }).length : 0;
                                    return (
                                        <option key={m} value={m}>
                                            {m.split(',')[0]} ({marketCampaigns} campaigns)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Advertiser Filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Advertiser</label>
                            <select 
                                value={selectedAdvertiser}
                                onChange={e => {
                                    setSelectedAdvertiser(e.target.value);
                                    setSelectedCampaign('ALL');
                                }}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[200px]"
                            >
                                <option value="ALL">All Advertisers ({advertisers.length})</option>
                                {advertisers.map(a => {
                                    let filtered = data.filter(d => d.advertiser === a);
                                    if (selectedMarket !== 'ALL') {
                                        filtered = filtered.filter(d => d.market === selectedMarket);
                                    }
                                    return (
                                        <option key={a} value={a}>
                                            {a} ({filtered.length})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Campaign Filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Campaign ID</label>
                            <select 
                                value={selectedCampaign}
                                onChange={e => setSelectedCampaign(e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[220px]"
                            >
                                <option value="ALL">All Campaigns ({campaigns.length})</option>
                                {campaigns.map(c => {
                                    const expected = campaignExpectedQty[c];
                                    const photoCount = photoCountByCampaign[c] || 0;
                                    const expectedQty = expected?.expectedQty || '?';
                                    // Show comparison: photos/expected
                                    const comparison = expected 
                                        ? `📷${photoCount}/${expectedQty}` 
                                        : `📷${photoCount}`;
                                    const status = photoCount > 0 && expected && photoCount >= expectedQty ? '✓' : '';
                                    return (
                                        <option key={c} value={c}>
                                            {c} {comparison} {status}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Date Range - Flight/Product Start Date */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Flight Date</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="date" 
                                    value={dateFilter.start}
                                    onChange={e => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                />
                                <span className="text-gray-400">→</span>
                                <input 
                                    type="date" 
                                    value={dateFilter.end}
                                    onChange={e => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                />
                            </div>
                        </div>

                        {/* Search */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Search</label>
                            <div className="relative">
                                <Icon name="Search" size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search campaigns..."
                                    className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white w-48"
                                />
                            </div>
                        </div>

                        {/* Status Filter (NEW) */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Status</label>
                            <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                                <button 
                                    onClick={() => setSelectedStatus('ALL')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded transition-all ${selectedStatus === 'ALL' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    All
                                </button>
                                <button 
                                    onClick={() => setSelectedStatus('Installed')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1 ${selectedStatus === 'Installed' ? 'bg-green-500 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Installed
                                </button>
                                <button 
                                    onClick={() => setSelectedStatus('Photos Taken')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1 ${selectedStatus === 'Photos Taken' ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> Photos
                                </button>
                                <button 
                                    onClick={() => setSelectedStatus('POP Completed')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1 ${selectedStatus === 'POP Completed' ? 'bg-blue-500 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> POP
                                </button>
                            </div>
                        </div>

                        {/* Sort */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Sort By</label>
                            <select 
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                            >
                                <option value="date-desc">Newest First</option>
                                <option value="date-asc">Oldest First</option>
                                <option value="advertiser">By Advertiser</option>
                                <option value="campaign">By Campaign #</option>
                            </select>
                        </div>

                        {/* Reset */}
                        <button 
                            onClick={() => {
                                setSelectedMarket('ALL');
                                setSelectedAdvertiser('ALL');
                                setSelectedCampaign('ALL');
                                setSelectedStatus('ALL');
                                setDateFilter({ start: '', end: '' });
                                setSearchTerm('');
                                setSortBy('date-desc');
                            }}
                            className="mt-5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Icon name="RotateCcw" size={14} /> Reset
                        </button>
                    </div>
                </div>

                {/* Campaign Detail Panel - Shows when a specific campaign is selected */}
                {selectedCampaign !== 'ALL' && (
                    <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200">
                        <div className="flex items-start justify-between gap-6">
                            {/* Campaign Info */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-mono text-lg font-bold text-indigo-800">{selectedCampaign}</span>
                                    {campaignExpectedQty[selectedCampaign] ? (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                            ✓ In Master Tracker
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">
                                            ⚠ Not in Tracker
                                        </span>
                                    )}
                                </div>
                                {campaignExpectedQty[selectedCampaign] && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Advertiser:</span>
                                            <span className="ml-1 font-medium">{campaignExpectedQty[selectedCampaign].advertiser}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Product:</span>
                                            <span className="ml-1 font-medium text-xs">{campaignExpectedQty[selectedCampaign].product?.split('-')[0]}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Market:</span>
                                            <span className="ml-1 font-medium">{campaignExpectedQty[selectedCampaign].market?.split(',')[0]}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Status:</span>
                                            <span className={`ml-1 font-bold ${
                                                campaignExpectedQty[selectedCampaign].stage === 'POP Completed' ? 'text-blue-600' :
                                                campaignExpectedQty[selectedCampaign].stage === 'Installed' ? 'text-green-600' :
                                                'text-gray-600'
                                            }`}>{campaignExpectedQty[selectedCampaign].stage}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Photo Count vs Expected */}
                            <div className="flex items-center gap-4">
                                <div className="text-center px-4 py-2 bg-white rounded-lg border border-indigo-200">
                                    <div className="text-2xl font-bold text-indigo-600">
                                        {photoCountByCampaign[selectedCampaign] || 0}
                                    </div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold">Photos</div>
                                </div>
                                <div className="text-gray-400 text-xl">/</div>
                                <div className="text-center px-4 py-2 bg-white rounded-lg border border-gray-200">
                                    <div className="text-2xl font-bold text-gray-700">
                                        {campaignExpectedQty[selectedCampaign]?.expectedQty || '?'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 uppercase font-bold">Expected</div>
                                </div>
                                {/* Status indicator */}
                                <div className={`p-3 rounded-lg ${
                                    !campaignExpectedQty[selectedCampaign] ? 'bg-amber-100' :
                                    (photoCountByCampaign[selectedCampaign] || 0) >= campaignExpectedQty[selectedCampaign].expectedQty ? 'bg-green-100' :
                                    (photoCountByCampaign[selectedCampaign] || 0) > 0 ? 'bg-blue-100' :
                                    'bg-gray-100'
                                }`}>
                                    {!campaignExpectedQty[selectedCampaign] ? (
                                        <div className="text-center">
                                            <Icon name="AlertCircle" size={24} className="text-amber-600 mx-auto" />
                                            <div className="text-[10px] text-amber-700 font-bold mt-1">No Tracker Data</div>
                                        </div>
                                    ) : (photoCountByCampaign[selectedCampaign] || 0) >= campaignExpectedQty[selectedCampaign].expectedQty ? (
                                        <div className="text-center">
                                            <Icon name="CheckCircle" size={24} className="text-green-600 mx-auto" />
                                            <div className="text-[10px] text-green-700 font-bold mt-1">Complete!</div>
                                        </div>
                                    ) : (photoCountByCampaign[selectedCampaign] || 0) > 0 ? (
                                        <div className="text-center">
                                            <Icon name="Clock" size={24} className="text-blue-600 mx-auto" />
                                            <div className="text-[10px] text-blue-700 font-bold mt-1">In Progress</div>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <Icon name="Camera" size={24} className="text-gray-500 mx-auto" />
                                            <div className="text-[10px] text-gray-600 font-bold mt-1">No Photos</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Bar */}
                <div className="px-6 py-3 bg-white border-b flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Icon name="Image" size={16} className="text-indigo-500" />
                            <span className="text-sm"><strong>{stats.totalPhotos}</strong> photos</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Icon name="Briefcase" size={16} className="text-purple-500" />
                            <span className="text-sm"><strong>{stats.campaigns}</strong> campaigns</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Icon name="Building" size={16} className="text-blue-500" />
                            <span className="text-sm"><strong>{stats.advertisers}</strong> advertisers</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Icon name="MapPin" size={16} className="text-green-500" />
                            <span className="text-sm"><strong>{stats.markets}</strong> markets</span>
                        </div>
                    </div>
                    
                    {/* Validation Status - Soft warnings */}
                    <div className="flex items-center gap-3">
                        {campaignValidation.matched.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                <Icon name="CheckCircle" size={12} />
                                <span>{campaignValidation.matched.length} matched</span>
                            </div>
                        )}
                        {campaignValidation.notInTracker.length > 0 && (
                            <div 
                                className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full cursor-help"
                                title={`${campaignValidation.notInTracker.length} campaign(s) in photos not found in Master Tracker. This is OK during testing.`}
                            >
                                <Icon name="AlertCircle" size={12} />
                                <span>{campaignValidation.notInTracker.length} not in tracker</span>
                            </div>
                        )}
                        {campaignValidation.missingPhotos.length > 0 && showDemoData === false && (
                            <div 
                                className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full cursor-help"
                                title={`${campaignValidation.missingPhotos.length} installed campaign(s) don't have photos yet.`}
                            >
                                <Icon name="Camera" size={12} />
                                <span>{campaignValidation.missingPhotos.length} need photos</span>
                            </div>
                        )}
                        {stats.isShowingLocal && (
                            <div className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                <Icon name="Folder" size={12} />
                                <span>Local folder</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Validation Alert Banner - Only show if there are issues and using real data */}
                {!showDemoData && (campaignValidation.notInTracker.length > 0 || campaignValidation.missingPhotos.length > 0) && (
                    <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
                        <Icon name="Info" size={16} className="text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                            <strong>Data Sync Notice:</strong> Some campaigns in your photos aren't in the Master Tracker yet, or some installed campaigns are missing photos. 
                            This is normal during testing - data will sync when both sources are fully connected.
                        </p>
                        <button 
                            onClick={() => {/* Could add a details modal here */}}
                            className="text-xs text-amber-700 underline hover:text-amber-900 flex-shrink-0"
                        >
                            View details
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="p-6">
                    {filteredPOP.length === 0 ? (
                        <div className="text-center py-16">
                            <Icon name="Camera" size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-500">No photos found</h3>
                            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or upload POP photos</p>
                        </div>
                    ) : viewMode === 'campaigns' ? (
                        /* Campaign Cards View - Grouped by campaign */
                        <div>
                            {/* Demo Mode Banner */}
                            {showDemoData && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-3">
                                    <Icon name="AlertTriangle" size={20} className="text-amber-600 flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="text-amber-800 font-bold text-sm">Demo Mode - Placeholder Images</div>
                                        <div className="text-amber-700 text-xs">
                                            Campaign data is real from your tracker. Photos are placeholders (random stock images). 
                                            <strong> Connect your Google Drive folder</strong> to see actual install photos.
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleLinkFolder(); }}
                                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                                    >
                                        <Icon name="Folder" size={14} /> Link Real Photos
                                    </button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {campaignGroups.map(campaign => (
                                <div 
                                    key={campaign.campaignNumber}
                                    onClick={() => setExpandedCampaign(campaign)}
                                    className="group cursor-pointer bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-indigo-400 transition-all"
                                >
                                    {/* Cover Photo with Stack Effect */}
                                    <div className="relative h-48 bg-gray-100">
                                        {/* Stacked effect background */}
                                        <div className="absolute inset-0 bg-gray-300 rounded-lg transform rotate-2 translate-x-1 -translate-y-1 opacity-30"></div>
                                        <div className="absolute inset-0 bg-gray-200 rounded-lg transform -rotate-1 translate-x-0.5 opacity-50"></div>
                                        
                                        {/* Main cover photo */}
                                        <img 
                                            src={campaign.coverPhoto?.thumbnailUrl || campaign.coverPhoto?.photoUrl}
                                            alt={campaign.advertiser}
                                            className="relative w-full h-full object-cover group-hover:scale-105 transition-transform z-10"
                                        />
                                        
                                        {/* Photo count badge */}
                                        <div className="absolute top-3 right-3 bg-black/80 text-white px-2 py-1 rounded-lg flex items-center gap-1.5 z-20">
                                            <Icon name="Image" size={14} />
                                            <span className="font-bold">{campaign.photoCount}</span>
                                            <span className="text-gray-300 text-xs">photos</span>
                                        </div>
                                        
                                        {/* Progress overlay */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 z-20">
                                            <div className="flex items-center justify-between text-white mb-1">
                                                <span className="text-xs font-medium">
                                                    {campaign.photoCount} / {campaign.expectedQty || '?'} installed
                                                </span>
                                                {campaign.expectedQty > 0 && (
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                        campaign.isComplete ? 'bg-green-500' : 'bg-amber-500'
                                                    }`}>
                                                        {campaign.isComplete ? '✓ Complete' : `${campaign.missing} missing`}
                                                    </span>
                                                )}
                                            </div>
                                            {campaign.expectedQty > 0 && (
                                                <div className="w-full bg-gray-600 rounded-full h-1.5">
                                                    <div 
                                                        className={`h-1.5 rounded-full transition-all ${campaign.isComplete ? 'bg-green-400' : 'bg-amber-400'}`}
                                                        style={{ width: `${campaign.progress}%` }}
                                                    ></div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-colors z-10 flex items-center justify-center">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-4 py-2 rounded-lg shadow-lg">
                                                <span className="text-indigo-700 font-bold text-sm">View All Photos →</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Campaign Info */}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-800 truncate">{campaign.advertiser}</h4>
                                                <p className="text-xs text-gray-500 truncate">{campaign.product}</p>
                                            </div>
                                            <span className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold ${
                                                campaign.stage === 'POP Completed' ? 'bg-blue-100 text-blue-700' :
                                                campaign.stage === 'Photos Taken' ? 'bg-purple-100 text-purple-700' :
                                                campaign.stage === 'Installed' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {campaign.stage === 'POP Completed' ? '✓ POP' : campaign.stage}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                            <span className="font-mono">{campaign.campaignNumber}</span>
                                            <span>{campaign.market?.split(',')[0]}</span>
                                        </div>
                                        {campaign.latestDate && (
                                            <div className="mt-1 text-[10px] text-gray-400">
                                                Latest: {campaign.latestDate.toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    ) : viewMode === 'timeline' ? (
                        /* Timeline View - Photos organized by date for selected campaign */
                        <div>
                            {/* Campaign selector for timeline */}
                            {selectedCampaign === 'ALL' ? (
                                <div className="mb-6 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl text-center">
                                    <Icon name="Calendar" size={48} className="mx-auto text-indigo-400 mb-3" />
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Select a Campaign to View Timeline</h3>
                                    <p className="text-gray-600 text-sm mb-4">Choose a specific campaign from the filter above to see installation photos organized by date.</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {campaignGroups.slice(0, 6).map(c => (
                                            <button
                                                key={c.campaignNumber}
                                                onClick={() => setSelectedCampaign(c.campaignNumber)}
                                                className="px-3 py-2 bg-white border border-indigo-300 hover:bg-indigo-100 hover:border-indigo-400 rounded-lg text-sm font-medium text-indigo-700 transition-all"
                                            >
                                                {c.advertiser} ({c.photoCount} photos)
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {/* Timeline header */}
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800">
                                                Installation Timeline: {campaignGroups.find(c => c.campaignNumber === selectedCampaign)?.advertiser || selectedCampaign}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {filteredPOP.length} photos across {[...new Set(filteredPOP.map(p => p.installDate?.toDateString()))].filter(Boolean).length} days
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedCampaign('ALL')}
                                            className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1"
                                        >
                                            <Icon name="X" size={14} /> Clear Selection
                                        </button>
                                    </div>
                                    
                                    {/* Timeline by date */}
                                    <div className="space-y-6">
                                        {(() => {
                                            // Group photos by date
                                            const photosByDate = {};
                                            filteredPOP.forEach(photo => {
                                                const dateKey = photo.installDate?.toDateString() || 'Unknown Date';
                                                if (!photosByDate[dateKey]) photosByDate[dateKey] = [];
                                                photosByDate[dateKey].push(photo);
                                            });
                                            
                                            // Sort dates newest first
                                            const sortedDates = Object.keys(photosByDate).sort((a, b) => {
                                                if (a === 'Unknown Date') return 1;
                                                if (b === 'Unknown Date') return -1;
                                                return new Date(b) - new Date(a);
                                            });
                                            
                                            return sortedDates.map((dateKey, idx) => (
                                                <div key={dateKey} className="relative">
                                                    {/* Timeline connector */}
                                                    {idx < sortedDates.length - 1 && (
                                                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-indigo-200"></div>
                                                    )}
                                                    
                                                    {/* Date header */}
                                                    <div className="flex items-center gap-4 mb-3">
                                                        <div className="w-12 h-12 rounded-full bg-indigo-500 text-white flex flex-col items-center justify-center flex-shrink-0 shadow-lg">
                                                            <span className="text-xs font-bold">
                                                                {dateKey !== 'Unknown Date' ? new Date(dateKey).toLocaleDateString('en-US', { month: 'short' }) : '?'}
                                                            </span>
                                                            <span className="text-lg font-bold leading-none">
                                                                {dateKey !== 'Unknown Date' ? new Date(dateKey).getDate() : '?'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-800">
                                                                {dateKey !== 'Unknown Date' ? new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown Date'}
                                                            </h4>
                                                            <p className="text-sm text-gray-500">{photosByDate[dateKey].length} photos installed</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Photos for this date */}
                                                    <div className="ml-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                        {photosByDate[dateKey].map(photo => (
                                                            <div 
                                                                key={photo.id}
                                                                onClick={() => setSelectedPhoto(photo)}
                                                                className="group cursor-pointer bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-indigo-300 transition-all"
                                                            >
                                                                <div className="relative aspect-[4/3] bg-gray-100">
                                                                    <img 
                                                                        src={photo.thumbnailUrl}
                                                                        alt={photo.advertiser}
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                        <Icon name="ZoomIn" size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                </div>
                                                                <div className="p-2">
                                                                    <p className="text-xs text-gray-600 truncate">{photo.product || photo.mediaType}</p>
                                                                    <p className="text-[10px] text-gray-400">{photo.market}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* Grid View */
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {filteredPOP.map(photo => (
                                <div 
                                    key={photo.id}
                                    onClick={() => setSelectedPhoto(photo)}
                                    className="group cursor-pointer bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-indigo-300 transition-all"
                                >
                                    <div className="relative aspect-[4/3] bg-gray-100">
                                        <img 
                                            src={photo.thumbnailUrl}
                                            alt={photo.advertiser}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <Icon name="ZoomIn" size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        {/* Photo count badge */}
                                        {photo.totalPhotos > 1 && (
                                            <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Icon name="Image" size={10} /> {photo.totalPhotos}
                                            </div>
                                        )}
                                        {/* Status badge */}
                                        <div className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            photo.stage === 'Installed' ? 'bg-green-500 text-white' :
                                            photo.stage === 'POP Completed' ? 'bg-blue-500 text-white' :
                                            'bg-gray-500 text-white'
                                        }`}>
                                            {photo.stage === 'POP Completed' ? '✓ POP' : photo.stage}
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <p className="font-semibold text-sm text-gray-800 truncate">{photo.advertiser}</p>
                                        <p className="text-[11px] text-gray-500 truncate">{photo.product}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] text-gray-400 font-mono">{photo.campaignNumber}</span>
                                            <span className="text-[10px] text-gray-400">{photo.installDate?.toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* List View */
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="text-left p-3 font-semibold text-gray-600">Photo</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Campaign</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Advertiser</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Market</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Media</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Install Date</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPOP.map(photo => (
                                        <tr 
                                            key={photo.id}
                                            onClick={() => setSelectedPhoto(photo)}
                                            className="border-b hover:bg-indigo-50 cursor-pointer transition-colors"
                                        >
                                            <td className="p-3">
                                                <img 
                                                    src={photo.thumbnailUrl}
                                                    alt={photo.advertiser}
                                                    className="w-16 h-12 object-cover rounded"
                                                />
                                            </td>
                                            <td className="p-3 font-mono text-xs">{photo.campaignNumber}</td>
                                            <td className="p-3 font-medium">{photo.advertiser}</td>
                                            <td className="p-3 text-gray-600">{photo.market?.split(',')[0]}</td>
                                            <td className="p-3 text-gray-600 text-xs">{photo.product}</td>
                                            <td className="p-3 text-gray-600">{photo.installDate?.toLocaleDateString()}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    photo.stage === 'Installed' ? 'bg-green-100 text-green-700' :
                                                    photo.stage === 'POP Completed' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {photo.stage}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Local Folder Connection Banner */}
                <div className="px-6 py-4 border-t bg-gradient-to-r from-blue-50 to-indigo-50">
                    {linkedFolder ? (
                        /* Connected State */
                        <div className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg shadow-sm flex items-center justify-center">
                                        <Icon name="FolderOpen" size={24} className="text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-green-700 flex items-center gap-2">
                                            <Icon name="CheckCircle" size={16} /> Folder Linked
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            <strong>{linkedFolder.name}</strong> • {localPhotos.length} photos found
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleRefreshFolder}
                                        disabled={scanningFolder}
                                        className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Icon name="RefreshCw" size={14} className={scanningFolder ? 'animate-spin' : ''} />
                                        {scanningFolder ? 'Scanning...' : 'Refresh'}
                                    </button>
                                    <button
                                        onClick={() => { setLinkedFolder(null); setLocalPhotos([]); }}
                                        className="px-3 py-2 bg-white hover:bg-red-50 border border-gray-300 text-red-600 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Unlink
                                    </button>
                                </div>
                            </div>
                            {!showDemoData && localPhotos.length > 0 && (
                                <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                    <Icon name="Info" size={14} className="text-green-600" />
                                    <span className="text-xs text-green-700">
                                        Showing <strong>{localPhotos.length}</strong> photos from your local Google Drive folder. Photos are NOT uploaded - they're read directly from your computer.
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Disconnected State */
                        <div className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
                                        <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                                            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                                            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                                            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                                            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                                            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">Link Your POP Photos Folder</p>
                                        <p className="text-sm text-gray-500">
                                            Browse photos directly from your Google Drive (via Desktop app)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleLinkFolder}
                                        disabled={scanningFolder}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                    >
                                        {scanningFolder ? (
                                            <>
                                                <Icon name="RefreshCw" size={16} className="animate-spin" /> Scanning...
                                            </>
                                        ) : (
                                            <>
                                                <Icon name="FolderOpen" size={16} /> Select Folder
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            {folderError && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                    <Icon name="AlertCircle" size={14} className="text-red-600" />
                                    <span className="text-xs text-red-700">{folderError}</span>
                                </div>
                            )}
                            <div className="p-3 bg-white/50 rounded-lg border border-blue-200">
                                <p className="text-xs text-gray-600 mb-2">
                                    <strong>📁 Expected folder structure:</strong>
                                </p>
                                <code className="text-xs text-indigo-600 block bg-white p-2 rounded border">
                                    POP Photos/<br/>
                                    ├── Los Angeles - STAP/<br/>
                                    │   ├── 250922043-0/<br/>
                                    │   │   ├── 2025-01-15/<br/>
                                    │   │   │   ├── install_1.jpg<br/>
                                    │   │   │   └── install_2.jpg<br/>
                                    │   │   └── 2025-01-20/<br/>
                                    │   └── 251021006-0/<br/>
                                    └── Miami/
                                </code>
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 <strong>Tip:</strong> Install <a href="https://www.google.com/drive/download/" target="_blank" className="text-indigo-600 underline">Google Drive for Desktop</a> to sync your Drive folder locally.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Photo Modal */}
                {selectedPhoto && (
                    <PhotoModal 
                        photo={selectedPhoto}
                        onClose={() => setSelectedPhoto(null)}
                    />
                )}

                {/* Expanded Campaign Modal - All photos for a campaign */}
                {expandedCampaign && (
                    <CampaignPhotosModal 
                        campaign={expandedCampaign}
                        onClose={() => setExpandedCampaign(null)}
                    />
                )}
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAPPOPGallery = {
        POPGallery
    };

    console.log('✅ STAP POP Gallery loaded');

})(window);
