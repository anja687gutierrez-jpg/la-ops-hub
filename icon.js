// ═══════════════════════════════════════════════════════════════════════════════
// STAP Icon System - Foundation Module
// Must load BEFORE any component that uses Icon
// ═══════════════════════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const { useRef, useEffect } = React;

    // ═══════════════════════════════════════════════════════════════════════════════
    // ICON_MAP - Maps friendly names to Lucide icon identifiers
    // ═══════════════════════════════════════════════════════════════════════════════
    const ICON_MAP = {
        UploadCloud: 'upload-cloud',
        FileText: 'file-text',
        AlertTriangle: 'alert-triangle',
        CheckCircle: 'check-circle',
        Clock: 'clock',
        Search: 'search',
        LayoutDashboard: 'layout-dashboard',
        Calendar: 'calendar',
        Menu: 'menu',
        X: 'x',
        ArrowRight: 'arrow-right',
        ArrowLeft: 'arrow-left',
        RefreshCw: 'refresh-cw',
        Layers: 'layers',
        Download: 'download',
        Hammer: 'hammer',
        Sun: 'sun',
        Cloud: 'cloud',
        CloudRain: 'cloud-rain',
        Wind: 'wind',
        CheckSquare: 'check-square',
        BarChart: 'bar-chart-2',
        History: 'history',
        Edit: 'edit-2',
        Save: 'save',
        XCircle: 'x-circle',
        Megaphone: 'megaphone',
        Rocket: 'rocket',
        Flame: 'flame',
        Medal: 'medal',
        Repeat: 'repeat',
        Lightbulb: 'lightbulb',
        Settings: 'settings',
        Eye: 'eye',
        EyeOff: 'eye-off',
        Play: 'play-circle',
        Gift: 'gift',
        Sparkles: 'sparkles',
        Bot: 'bot',
        Mail: 'mail',
        Filter: 'filter',
        ArrowUp: 'arrow-up',
        ArrowDown: 'arrow-down',
        ChevronDown: 'chevron-down',
        ChevronUp: 'chevron-up',
        ChevronLeft: 'chevron-left',
        ChevronRight: 'chevron-right',
        Copy: 'copy',
        Send: 'send',
        Sliders: 'sliders',
        AlertOctagon: 'alert-octagon',
        Info: 'info',
        CloudFog: 'cloud-fog',
        MapPin: 'map-pin',
        ShieldAlert: 'shield-alert',
        TrendingUp: 'trending-up',
        TrendingDown: 'trending-down',
        List: 'list',
        Wifi: 'wifi',
        CloudLightning: 'cloud-lightning',
        Snowflake: 'snowflake',
        Target: 'target',
        AlertCircle: 'alert-circle',
        Pause: 'pause',
        Archive: 'archive',
        Package: 'package',
        Box: 'box',
        Inbox: 'inbox',
        Truck: 'truck',
        PackageCheck: 'package-check',
        Warehouse: 'warehouse',
        PauseCircle: 'pause-circle',
        StopCircle: 'stop-circle',
        CirclePause: 'circle-pause',
        Hand: 'hand',
        Columns: 'columns',
        Layout: 'layout',
        Edit3: 'edit-3',
        Plus: 'plus',
        Minimize2: 'minimize-2',
        Maximize2: 'maximize-2',
        Ghost: 'ghost',
        ClipboardList: 'clipboard-list',
        Star: 'star',
        Heart: 'heart',
        Zap: 'zap',
        Activity: 'activity',
        Users: 'users',
        User: 'user',
        DollarSign: 'dollar-sign',
        Percent: 'percent',
        PieChart: 'pie-chart',
        LineChart: 'line-chart',
        Briefcase: 'briefcase',
        Building: 'building-2',
        Home: 'home',
        Flag: 'flag',
        Bookmark: 'bookmark',
        Bell: 'bell',
        Coffee: 'coffee',
        Compass: 'compass',
        Crosshair: 'crosshair',
        Crown: 'crown',
        Database: 'database',
        FileCheck: 'file-check',
        Folder: 'folder',
        FolderOpen: 'folder-open',
        Globe: 'globe',
        Hash: 'hash',
        HelpCircle: 'help-circle',
        Image: 'image',
        Key: 'key',
        Link: 'link',
        Lock: 'lock',
        Unlock: 'unlock',
        MessageSquare: 'message-square',
        Monitor: 'monitor',
        Moon: 'moon',
        Music: 'music',
        Navigation: 'navigation',
        Paperclip: 'paperclip',
        Phone: 'phone',
        Printer: 'printer',
        Radio: 'radio',
        Shield: 'shield',
        ShoppingCart: 'shopping-cart',
        Smile: 'smile',
        Speaker: 'speaker',
        Square: 'square',
        Tag: 'tag',
        Terminal: 'terminal',
        ThumbsUp: 'thumbs-up',
        ThumbsDown: 'thumbs-down',
        Timer: 'timer',
        Tool: 'tool',
        Trash: 'trash-2',
        Trash2: 'trash-2',
        Umbrella: 'umbrella',
        Video: 'video',
        Volume: 'volume-2',
        Watch: 'watch',
        Wrench: 'wrench',
        Award: 'award',
        Battery: 'battery',
        BatteryCharging: 'battery-charging',
        Bluetooth: 'bluetooth',
        Camera: 'camera',
        Cast: 'cast',
        Circle: 'circle',
        Clipboard: 'clipboard',
        CloudOff: 'cloud-off',
        Code: 'code',
        Cpu: 'cpu',
        CreditCard: 'credit-card',
        Disc: 'disc',
        Dribbble: 'dribbble',
        Droplet: 'droplet',
        ExternalLink: 'external-link',
        Feather: 'feather',
        Film: 'film',
        Gitlab: 'gitlab',
        Grid: 'grid',
        Headphones: 'headphones',
        Map: 'map',
        Mic: 'mic',
        MinusCircle: 'minus-circle',
        MoreHorizontal: 'more-horizontal',
        Move: 'move',
        Octagon: 'octagon',
        PenTool: 'pen-tool',
        Power: 'power',
        Server: 'server',
        Sidebar: 'sidebar',
        Slash: 'slash',
        Stopwatch: 'stopwatch',
        Sunrise: 'sunrise',
        Sunset: 'sunset',
        Tablet: 'tablet',
        Thermometer: 'thermometer',
        ToggleLeft: 'toggle-left',
        ToggleRight: 'toggle-right',
        Trending: 'trending-up',
        Triangle: 'triangle',
        Type: 'type',
        Upload: 'upload',
        UserCheck: 'user-check',
        UserMinus: 'user-minus',
        UserPlus: 'user-plus',
        VolumeX: 'volume-x',
        WifiOff: 'wifi-off',
        ZoomIn: 'zoom-in',
        ZoomOut: 'zoom-out',
        LayoutTemplate: 'layout',
        BarChart3: 'bar-chart-3',
        Table: 'table',
        Table2: 'table-2',
        FileSpreadsheet: 'file-spreadsheet',
        Scan: 'scan',
        ScanLine: 'scan-line',
        FileSearch: 'file-search',
        Maximize: 'maximize',
        Loader: 'loader',
        ScanEye: 'scan-eye',
        Share2: 'share-2',
        RotateCcw: 'rotate-ccw',
        Check: 'check',
        LogOut: 'log-out'
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // Icon Component - Renders Lucide icons by name
    // ═══════════════════════════════════════════════════════════════════════════════
    const Icon = function(props) {
        var name = props.name;
        var size = props.size || 20;
        var className = props.className || '';

        var ref = useRef(null);

        useEffect(function() {
            if (!ref.current) return;
            ref.current.innerHTML = '';
            var iconName = ICON_MAP[name] || 'circle';
            var i = document.createElement('i');
            i.setAttribute('data-lucide', iconName);
            ref.current.appendChild(i);
            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons({
                    root: ref.current,
                    attrs: { width: size, height: size, class: className }
                });
            }
        }, [name, size, className]);

        return React.createElement('span', {
            ref: ref,
            style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // ProductionIcon Component - Clean outlined icons for production source
    // ═══════════════════════════════════════════════════════════════════════════════
    const ProductionIcon = function(props) {
        var type = props.type;
        var size = props.size || 14;
        var showLabel = props.showLabel || false;
        var compact = props.compact || false;

        var config = {
            'in-house': {
                icon: 'Home',
                color: 'text-purple-600',
                bg: 'bg-purple-100',
                border: 'border-purple-300',
                label: 'In-House'
            },
            'client': {
                icon: 'Upload',
                color: 'text-blue-600',
                bg: 'bg-blue-100',
                border: 'border-blue-300',
                label: 'Client'
            },
            'mixed': {
                icon: 'RefreshCw',
                color: 'text-amber-600',
                bg: 'bg-amber-100',
                border: 'border-amber-300',
                label: 'Mixed'
            },
            'unset': {
                icon: 'HelpCircle',
                color: 'text-gray-400',
                bg: 'bg-gray-100',
                border: 'border-gray-300',
                label: 'Not Set'
            }
        };

        var c = config[type] || config['unset'];

        if (compact) {
            return React.createElement('span', {
                className: c.color,
                title: c.label
            }, React.createElement(Icon, { name: c.icon, size: size }));
        }

        if (showLabel) {
            return React.createElement('span', {
                className: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' + c.bg + ' ' + c.color + ' border ' + c.border
            }, [
                React.createElement(Icon, { key: 'icon', name: c.icon, size: size }),
                c.label
            ]);
        }

        return React.createElement('span', {
            className: 'inline-flex items-center justify-center p-1 rounded ' + c.bg + ' ' + c.color,
            title: c.label
        }, React.createElement(Icon, { name: c.icon, size: size }));
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORTS - Available globally for all modules
    // ═══════════════════════════════════════════════════════════════════════════════
    window.STAP_Icon = Icon;
    window.STAP_ProductionIcon = ProductionIcon;
    window.STAP_ICON_MAP = ICON_MAP;

    console.log('✅ STAP Icon System loaded (' + Object.keys(ICON_MAP).length + ' icons)');

})(window);
