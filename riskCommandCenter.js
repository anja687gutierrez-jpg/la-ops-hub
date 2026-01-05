// ═══════════════════════════════════════════════════════════════════════════
// INSTALLATION RISK COMMAND CENTER - External Component
// Weather forecast and schedule risk analysis for LA STAP Operations Portal
// ═══════════════════════════════════════════════════════════════════════════
(function() {
    'use strict';

    const { useState, useEffect, useMemo } = React;

    // Get dependencies from window exports
    const getIcon = () => window.STAP_Icon || window.lucide?.createElement || (() => null);
    const getMarketCoordinates = () => window.STAP_MARKET_COORDINATES || {};
    const getFetchLiveWeather = () => window.STAP_fetchLiveWeather || (async () => []);

    // ═══════════════════════════════════════════════════════════════════════════
    // INSTALLATION RISK COMMAND CENTER
    // ═══════════════════════════════════════════════════════════════════════════
    const InstallationRiskCommandCenter = ({ allData = [] }) => {
        const Icon = getIcon();
        const MARKET_COORDINATES = getMarketCoordinates();
        const fetchLiveWeather = getFetchLiveWeather();

        const formatDateDetails = (baseDate, offsetDays) => {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + offsetDays);
            return {
                day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date),
                dateStr: new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(date),
                fullDate: date
            };
        };

        const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
        const [selectedCity, setSelectedCity] = useState('Los Angeles, CA');
        const [weatherData, setWeatherData] = useState([]);
        const [isLoadingWeather, setIsLoadingWeather] = useState(true);
        const [weatherError, setWeatherError] = useState(null);
        const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' or 'historical'

        // Available cities from MARKET_COORDINATES
        const availableCities = Object.keys(MARKET_COORDINATES);

        // Fetch live weather on city change
        useEffect(() => {
            const loadWeather = async () => {
                setIsLoadingWeather(true);
                setWeatherError(null);
                try {
                    const data = await fetchLiveWeather(selectedCity);
                    setWeatherData(data);
                } catch (e) {
                    setWeatherError('Failed to load weather');
                    // Fallback to static data
                    setWeatherData([
                        { day: 'Today', temp: 72, rainChance: 10, condition: 'Clear', icon: 'Sun' },
                        { day: 'Tue', temp: 74, rainChance: 5, condition: 'Sunny', icon: 'Sun' },
                        { day: 'Wed', temp: 71, rainChance: 15, condition: 'Partly Cloudy', icon: 'Cloud' },
                        { day: 'Thu', temp: 68, rainChance: 30, condition: 'Cloudy', icon: 'Cloud' },
                        { day: 'Fri', temp: 70, rainChance: 20, condition: 'Partly Cloudy', icon: 'Cloud' }
                    ]);
                } finally {
                    setIsLoadingWeather(false);
                }
            };
            loadWeather();
        }, [selectedCity]);

        const handleCityChange = (newCity) => {
            setSelectedCity(newCity);
        };

        const forecast = useMemo(() => {
            if (!weatherData || weatherData.length === 0) return [];
            return weatherData.slice(0, 5); // First 5 days
        }, [weatherData]);

        // --- HISTORICAL ANALYSIS ---
        const historicalStats = useMemo(() => {
            if (!allData || allData.length === 0) {
                return {
                    totalCampaigns: 0,
                    delayedCampaigns: [],
                    avgDelayDays: 0,
                    byMonth: {},
                    byMarket: {},
                    holidayImpact: [],
                    weatherPatterns: []
                };
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Known holidays for analysis
            const knownHolidays = [
                { name: 'New Year', dates: ['12/31', '01/01', '01/02'] },
                { name: 'MLK Day', dates: ['01/15', '01/16', '01/17'] },
                { name: 'Presidents Day', dates: ['02/17', '02/18', '02/19'] },
                { name: 'Memorial Day', dates: ['05/26', '05/27', '05/28'] },
                { name: 'July 4th', dates: ['07/03', '07/04', '07/05'] },
                { name: 'Labor Day', dates: ['09/01', '09/02', '09/03'] },
                { name: 'Thanksgiving', dates: ['11/27', '11/28', '11/29'] },
                { name: 'Christmas', dates: ['12/24', '12/25', '12/26'] },
                { name: 'Hanukkah', dates: ['12/14', '12/15', '12/22'] }
            ];

            // Rainy season months by region
            const rainySeasons = {
                'Los Angeles': [1, 2, 3, 12], // Winter
                'Seattle': [10, 11, 12, 1, 2, 3, 4], // Fall-Spring
                'Miami': [6, 7, 8, 9], // Summer hurricane season
                'Chicago': [4, 5, 6], // Spring
                'Boston': [3, 4, 11], // Spring/Fall
                'New York': [4, 5, 9, 10] // Spring/Fall
            };

            const delayedCampaigns = [];
            const byMonth = {};
            const byMarket = {};
            const holidayDelays = {};
            const seasonalDelays = { rainy: 0, clear: 0, rainyTotal: 0, clearTotal: 0 };

            allData.forEach(item => {
                const startDate = item.dateObj || (item.date ? new Date(item.date) : null);
                const firstInstallDate = item.firstInstallDateObj || (item.firstInstall ? new Date(item.firstInstall) : null);
                const stage = (item.stage || '').toLowerCase();
                const market = item.market || 'Unknown';
                const marketCity = market.split(',')[0];

                if (!startDate || isNaN(startDate.getTime())) return;

                const month = startDate.getMonth() + 1;
                const monthName = startDate.toLocaleDateString('en-US', { month: 'short' });
                const dateStr = `${String(month).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;

                // Track by month
                if (!byMonth[monthName]) byMonth[monthName] = { total: 0, delayed: 0, onTime: 0 };
                byMonth[monthName].total++;

                // Track by market
                if (!byMarket[marketCity]) byMarket[marketCity] = { total: 0, delayed: 0, avgDelay: 0, totalDelayDays: 0 };
                byMarket[marketCity].total++;

                // Check if this was during rainy season for the market
                const isRainySeason = rainySeasons[marketCity]?.includes(month);
                if (isRainySeason) {
                    seasonalDelays.rainyTotal++;
                } else {
                    seasonalDelays.clearTotal++;
                }

                // Check holiday proximity
                const nearHoliday = knownHolidays.find(h => h.dates.includes(dateStr));

                // Calculate delay
                let delayDays = 0;
                let isDelayed = false;

                if (firstInstallDate && startDate < firstInstallDate) {
                    // Install happened after start date
                    delayDays = Math.floor((firstInstallDate - startDate) / (1000 * 60 * 60 * 24));
                    if (delayDays > 3) { // Consider >3 days as a meaningful delay
                        isDelayed = true;
                    }
                } else if (startDate < today && !['installed', 'photos taken', 'pop completed', 'canceled', 'lost opportunity'].includes(stage)) {
                    // Should have started but not installed yet
                    delayDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
                    if (delayDays > 0) {
                        isDelayed = true;
                    }
                }

                if (isDelayed) {
                    byMonth[monthName].delayed++;
                    byMarket[marketCity].delayed++;
                    byMarket[marketCity].totalDelayDays += delayDays;

                    if (isRainySeason) seasonalDelays.rainy++;
                    if (nearHoliday) {
                        if (!holidayDelays[nearHoliday.name]) holidayDelays[nearHoliday.name] = { count: 0, totalDays: 0 };
                        holidayDelays[nearHoliday.name].count++;
                        holidayDelays[nearHoliday.name].totalDays += delayDays;
                    }

                    delayedCampaigns.push({
                        ...item,
                        delayDays,
                        nearHoliday: nearHoliday?.name,
                        isRainySeason
                    });
                } else {
                    byMonth[monthName].onTime++;
                }
            });

            // Calculate averages
            Object.keys(byMarket).forEach(m => {
                if (byMarket[m].delayed > 0) {
                    byMarket[m].avgDelay = Math.round(byMarket[m].totalDelayDays / byMarket[m].delayed);
                }
            });

            const totalDelayed = delayedCampaigns.length;
            const avgDelayDays = totalDelayed > 0
                ? Math.round(delayedCampaigns.reduce((sum, c) => sum + c.delayDays, 0) / totalDelayed)
                : 0;

            // Calculate holiday impact stats
            const holidayImpact = Object.entries(holidayDelays)
                .map(([name, data]) => ({
                    name,
                    count: data.count,
                    avgDays: Math.round(data.totalDays / data.count)
                }))
                .sort((a, b) => b.count - a.count);

            // Weather pattern stats
            const rainyDelayRate = seasonalDelays.rainyTotal > 0
                ? Math.round((seasonalDelays.rainy / seasonalDelays.rainyTotal) * 100)
                : 0;
            const clearDelayRate = seasonalDelays.clearTotal > 0
                ? Math.round((seasonalDelays.clear / seasonalDelays.clearTotal) * 100)
                : 0;

            return {
                totalCampaigns: allData.length,
                delayedCampaigns: delayedCampaigns.sort((a, b) => b.delayDays - a.delayDays).slice(0, 20),
                totalDelayed,
                avgDelayDays,
                byMonth,
                byMarket: Object.entries(byMarket).sort((a, b) => b[1].delayed - a[1].delayed),
                holidayImpact,
                weatherPatterns: {
                    rainyDelayRate,
                    clearDelayRate,
                    rainyTotal: seasonalDelays.rainyTotal,
                    clearTotal: seasonalDelays.clearTotal
                }
            };
        }, [allData]);

        const holidays = [
            { name: 'Christmas Eve', date: 'Dec 24' }, { name: 'Christmas Day', date: 'Dec 25' },
            { name: 'New Year\'s Eve', date: 'Dec 31' }, { name: 'New Year\'s Day', date: 'Jan 01' },
        ];

        const getDelayRisk = (percentage) => {
            if (percentage > 85) return { level: 'CRITICAL', label: 'Heavy Delays Certain', color: 'bg-red-100 text-red-800 border-red-200' };
            if (percentage > 75) return { level: 'HIGH', label: 'Big Chance of Delays', color: 'bg-orange-100 text-orange-800 border-orange-200' };
            return { level: 'LOW', label: 'No Delays Expected', color: 'bg-green-100 text-green-800 border-green-200' };
        };

        const getUpcomingHolidays = () => {
            if (!forecast || forecast.length === 0) return [];
            const datesInForecast = forecast.map(f => f.date);
            return holidays.filter(h => datesInForecast.includes(h.date));
        };

        const smartSummary = useMemo(() => {
            // Guard against empty forecast array
            if (!forecast || forecast.length === 0) {
                return {
                    title: "Loading Weather Data...",
                    message: "Fetching live weather forecast for your market.",
                    subMessage: "Please wait a moment.",
                    alertType: "info"
                };
            }

            const worstDayIndex = forecast.reduce((maxIdx, current, idx, arr) =>
                current.rainChance > arr[maxIdx].rainChance ? idx : maxIdx, 0
            );
            const worstDay = forecast[worstDayIndex];
            const highestRainChance = worstDay?.rainChance || 0;
            const upcoming = getUpcomingHolidays();
            const hasHolidays = upcoming.length > 0;
            const holidayNames = upcoming.map(h => h.name).join(' and ');

            let title = "", message = "", subMessage = "", alertType = "success";

            if (highestRainChance > 85) {
                alertType = "error";
                title = "Installation Halted: Critical Weather Alert";
                message = `Heavy installation delays are inevitable due to severe precipitation levels on ${worstDay?.day || 'upcoming day'} (${highestRainChance}%).`;
                if (hasHolidays) subMessage = `COMPOUNDING FACTOR: These delays will be worsened by reduced workforce availability during ${holidayNames}.`;
            } else if (highestRainChance > 75) {
                alertType = "warning";
                title = "Schedule At Risk: Weather Warning";
                message = `There is a significant probability of schedule slippage due to rain on ${worstDay?.day || 'upcoming day'} (${highestRainChance}%).`;
                if (hasHolidays) subMessage = `LOGISTICS NOTE: Rescheduling options are limited due to upcoming ${holidayNames} observances.`;
            } else {
                if (hasHolidays) {
                    alertType = "info";
                    title = "Weather Clear / Logistics Alert";
                    message = `Weather conditions are favorable, but installation capacity is reduced due to ${holidayNames}.`;
                    subMessage = "Ensure crews are confirmed 48 hours in advance.";
                } else {
                    alertType = "success";
                    title = "Schedule On Track";
                    message = "Operations are green. Weather conditions remain favorable for all scheduled installations.";
                    subMessage = "No significant rain or holiday constraints detected in the 5-day window.";
                }
            }
            return { title, message, subMessage, alertType };
        }, [forecast]);

        const updateRainChance = (index, newValue) => {
            const newWeatherData = [...weatherData];
            newWeatherData[index].rainChance = parseInt(newValue);
            setWeatherData(newWeatherData);
        };

        return (
            <div className="bg-slate-50 p-6 rounded-xl min-h-full">
                <div className="max-w-5xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 pb-4 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Installation Command Center</h1>
                            <p className="text-slate-500 mt-1">Forecast & Schedule Risk Analysis</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex flex-col items-end gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Region</label>
                                <div className="relative">
                                    <select value={selectedCity} onChange={(e) => handleCityChange(e.target.value)}
                                        className="appearance-none bg-white border border-slate-300 text-slate-700 py-1 pl-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer">
                                        {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
                                    </select>
                                    <div className="absolute right-2 top-2 text-slate-400 pointer-events-none"><Icon name="MapPin" size={14} /></div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Forecast Start Date</label>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-300 shadow-sm">
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 text-slate-700 focus:outline-none font-medium" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
                        <button
                            onClick={() => setActiveTab('forecast')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'forecast' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <Icon name="Cloud" size={16} /> Live Forecast
                        </button>
                        <button
                            onClick={() => setActiveTab('historical')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'historical' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <Icon name="History" size={16} /> Historical Analysis
                        </button>
                    </div>

                    {activeTab === 'forecast' ? (
                        <>
                            {/* Smart Summary */}
                            <div className={`p-6 rounded-xl border-l-8 shadow-sm transition-all duration-300 ${
                                smartSummary.alertType === 'error' ? 'bg-white border-red-500 shadow-red-100' :
                                smartSummary.alertType === 'warning' ? 'bg-white border-orange-400 shadow-orange-100' :
                                smartSummary.alertType === 'info' ? 'bg-white border-purple-500 shadow-purple-100' :
                                'bg-white border-green-500 shadow-green-100'
                            }`}>
                                <div className="flex items-start gap-4">
                                    <div className={`mt-1 p-2 rounded-full ${
                                        smartSummary.alertType === 'error' ? 'bg-red-100 text-red-600' :
                                        smartSummary.alertType === 'warning' ? 'bg-orange-100 text-orange-600' :
                                        smartSummary.alertType === 'info' ? 'bg-purple-100 text-purple-600' :
                                        'bg-green-100 text-green-600'
                                    }`}>
                                        <Icon name={smartSummary.alertType === 'error' ? "AlertOctagon" : smartSummary.alertType === 'warning' ? "AlertTriangle" : smartSummary.alertType === 'info' ? "Calendar" : "CheckCircle"} size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className={`text-xl font-bold mb-1 ${
                                            smartSummary.alertType === 'error' ? 'text-red-700' :
                                            smartSummary.alertType === 'warning' ? 'text-orange-700' :
                                            smartSummary.alertType === 'info' ? 'text-purple-700' :
                                            'text-green-700'
                                        }`}>{smartSummary.title}</h2>
                                        <p className="text-lg font-medium leading-relaxed text-slate-700">{smartSummary.message}</p>
                                        {smartSummary.subMessage && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 flex items-start gap-2 text-sm font-semibold text-slate-600">
                                                <Icon name="Info" size={16} className="mt-0.5 shrink-0" />
                                                <span>{smartSummary.subMessage}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Dashboard Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-sm uppercase tracking-wide text-slate-400 font-bold">Live Forecast ({selectedCity.split(',')[0]})</h3>
                                        {isLoadingWeather ? (
                                            <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded font-bold flex items-center gap-1">
                                                <Icon name="RefreshCw" size={12} className="animate-spin" /> Loading...
                                            </span>
                                        ) : weatherError ? (
                                            <span className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded font-bold">Cached Data</span>
                                        ) : (
                                            <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded font-bold flex items-center gap-1">
                                                <Icon name="Wifi" size={12} /> Live Data
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-6">
                                        {isLoadingWeather ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                                <Icon name="Cloud" size={48} className="mb-3 animate-pulse" />
                                                <p className="text-sm">Fetching weather data...</p>
                                            </div>
                                        ) : forecast.map((day, idx) => {
                                            const risk = getDelayRisk(day.rainChance);
                                            const isHoliday = holidays.find(h => h.date === day.date);
                                            return (
                                                <div key={idx} className="relative group">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${risk.color}`}>
                                                                <Icon name={day.icon || (day.rainChance > 75 ? "CloudRain" : day.rainChance > 20 ? "Cloud" : "Sun")} size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold flex items-center gap-2">
                                                                    {day.day} <span className="text-slate-400 font-normal text-sm">({day.date || ''})</span>
                                                                    {isHoliday && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold animate-pulse">{isHoliday.name}</span>}
                                                                </div>
                                                                <div className="text-xs text-slate-500">{day.condition} • {day.temp}°F</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={`text-xl font-bold ${day.rainChance > 85 ? 'text-red-600' : day.rainChance > 75 ? 'text-orange-500' : 'text-slate-700'}`}>{day.rainChance}%</span>
                                                        </div>
                                                    </div>
                                                    <div className={`w-full h-2 rounded-lg ${day.rainChance > 85 ? 'bg-red-200' : day.rainChance > 75 ? 'bg-orange-200' : day.rainChance > 30 ? 'bg-yellow-200' : 'bg-green-200'}`}>
                                                        <div className={`h-full rounded-lg ${day.rainChance > 85 ? 'bg-red-500' : day.rainChance > 75 ? 'bg-orange-500' : day.rainChance > 30 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${day.rainChance}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                        <h3 className="text-sm uppercase tracking-wide text-slate-400 font-bold mb-4">Risk Criteria</h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                                                <div className="w-2 h-12 bg-green-500 rounded-full"></div>
                                                <div><div className="font-bold text-green-900">0% - 75% Rain</div><div className="text-sm text-green-700">Safe zone. Standard velocity.</div></div>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                                                <div className="w-2 h-12 bg-orange-500 rounded-full"></div>
                                                <div><div className="font-bold text-orange-900">76% - 85% Rain</div><div className="text-sm text-orange-700">Warning zone. Expect delays.</div></div>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                                <div className="w-2 h-12 bg-red-600 rounded-full"></div>
                                                <div><div className="font-bold text-red-900">86%+ Rain</div><div className="text-sm text-red-700">No-Go zone. Automatic rescheduling.</div></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                                        <div className="flex items-center gap-2 mb-2 text-purple-800 font-bold"><Icon name="Calendar" size={18} /><span>Known Constraints</span></div>
                                        <div className="flex flex-wrap gap-2">
                                            {holidays.map((h, i) => (
                                                <span key={i} className={`px-3 py-1 border rounded-full text-xs font-semibold shadow-sm transition-all ${forecast.some(f => f.date === h.date) ? "bg-purple-600 text-white border-purple-700" : "bg-white text-slate-400 border-slate-200"}`}>{h.date}: {h.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Historical Analysis Tab */
                        <div className="space-y-6">
                            {/* Stats Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                            <Icon name="FileText" size={20} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 uppercase">Total Campaigns</span>
                                    </div>
                                    <div className="text-3xl font-bold text-slate-800">{historicalStats.totalCampaigns}</div>
                                    <div className="text-xs text-slate-500 mt-1">In dataset</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                            <Icon name="AlertTriangle" size={20} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 uppercase">Delayed Installs</span>
                                    </div>
                                    <div className="text-3xl font-bold text-red-600">{historicalStats.totalDelayed}</div>
                                    <div className="text-xs text-slate-500 mt-1">Started late or pending</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-orange-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                            <Icon name="Clock" size={20} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 uppercase">Avg Delay</span>
                                    </div>
                                    <div className="text-3xl font-bold text-orange-600">{historicalStats.avgDelayDays}</div>
                                    <div className="text-xs text-slate-500 mt-1">Days behind schedule</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                                            <Icon name="CloudRain" size={20} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 uppercase">Weather Impact</span>
                                    </div>
                                    <div className="text-3xl font-bold text-purple-600">{historicalStats.weatherPatterns.rainyDelayRate}%</div>
                                    <div className="text-xs text-slate-500 mt-1">Delay rate in rainy season</div>
                                </div>
                            </div>

                            {/* Holiday Impact Analysis */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                                        <Icon name="Calendar" size={16} className="text-purple-500" /> Holiday Impact on Delays
                                    </h3>
                                    {historicalStats.holidayImpact.length > 0 ? (
                                        <div className="space-y-3">
                                            {historicalStats.holidayImpact.map((holiday, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">🗓️</span>
                                                        <div>
                                                            <div className="font-semibold text-slate-800">{holiday.name}</div>
                                                            <div className="text-xs text-slate-500">Avg {holiday.avgDays} days delayed</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xl font-bold text-purple-600">{holiday.count}</span>
                                                        <div className="text-xs text-slate-500">delays</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-400">
                                            <Icon name="CheckCircle" size={32} className="mx-auto mb-2 text-green-400" />
                                            <p>No holiday-related delays detected</p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                                        <Icon name="CloudRain" size={16} className="text-blue-500" /> Seasonal Weather Patterns
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-semibold text-blue-800 flex items-center gap-2">
                                                    <Icon name="CloudRain" size={16} /> Rainy Season
                                                </span>
                                                <span className="text-2xl font-bold text-blue-600">{historicalStats.weatherPatterns.rainyDelayRate}%</span>
                                            </div>
                                            <div className="text-xs text-blue-600">
                                                {historicalStats.weatherPatterns.rainyTotal} campaigns during wet months
                                            </div>
                                            <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${historicalStats.weatherPatterns.rainyDelayRate}%` }}></div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-semibold text-green-800 flex items-center gap-2">
                                                    <Icon name="Sun" size={16} /> Clear Season
                                                </span>
                                                <span className="text-2xl font-bold text-green-600">{historicalStats.weatherPatterns.clearDelayRate}%</span>
                                            </div>
                                            <div className="text-xs text-green-600">
                                                {historicalStats.weatherPatterns.clearTotal} campaigns during dry months
                                            </div>
                                            <div className="mt-2 h-2 bg-green-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${historicalStats.weatherPatterns.clearDelayRate}%` }}></div>
                                            </div>
                                        </div>
                                        {historicalStats.weatherPatterns.rainyDelayRate > historicalStats.weatherPatterns.clearDelayRate + 10 && (
                                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                                                <Icon name="AlertTriangle" size={16} className="mt-0.5 shrink-0" />
                                                <span><strong>Insight:</strong> Delay rate is {historicalStats.weatherPatterns.rainyDelayRate - historicalStats.weatherPatterns.clearDelayRate}% higher during rainy season. Consider buffer time for wet-month campaigns.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Market Performance */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <Icon name="MapPin" size={16} className="text-red-500" /> Delays by Market
                                </h3>
                                <div className="max-h-[300px] overflow-y-auto">
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {historicalStats.byMarket.map(([market, data], idx) => (
                                            <div key={idx} className={`p-3 rounded-lg border ${data.delayed > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                                <div className="font-semibold text-slate-800 text-sm truncate">{market}</div>
                                                <div className="flex items-baseline gap-1 mt-1">
                                                    <span className={`text-xl font-bold ${data.delayed > 0 ? 'text-red-600' : 'text-green-600'}`}>{data.delayed}</span>
                                                    <span className="text-xs text-slate-500">/ {data.total}</span>
                                                </div>
                                                {data.avgDelay > 0 && (
                                                    <div className="text-xs text-slate-500 mt-1">~{data.avgDelay}d avg</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Monthly Trends */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <Icon name="TrendingUp" size={16} className="text-blue-500" /> Monthly Delay Trends
                                </h3>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => {
                                        const data = historicalStats.byMonth[month] || { total: 0, delayed: 0 };
                                        const delayRate = data.total > 0 ? Math.round((data.delayed / data.total) * 100) : 0;
                                        return (
                                            <div key={month} className="flex flex-col items-center min-w-[60px]">
                                                <div className="h-24 w-8 bg-slate-100 rounded-t-lg relative flex items-end overflow-hidden">
                                                    <div
                                                        className={`w-full rounded-t transition-all ${delayRate > 30 ? 'bg-red-400' : delayRate > 15 ? 'bg-orange-400' : 'bg-blue-400'}`}
                                                        style={{ height: `${Math.max(delayRate, 5)}%` }}
                                                    ></div>
                                                </div>
                                                <div className="text-xs font-semibold text-slate-600 mt-1">{month}</div>
                                                <div className="text-xs text-slate-400">{data.total}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-4 mt-4 text-xs text-slate-500 justify-center">
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded"></span> {'<'}15% delay</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded"></span> 15-30% delay</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded"></span> {'>'}30% delay</span>
                                </div>
                            </div>

                            {/* Recent Delays Table */}
                            {historicalStats.delayedCampaigns.length > 0 && (
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                                        <Icon name="List" size={16} className="text-red-500" /> Most Delayed Campaigns ({historicalStats.delayedCampaigns.length})
                                    </h3>
                                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 bg-white z-10">
                                                <tr className="border-b border-slate-200">
                                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold">Campaign</th>
                                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold">Market</th>
                                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold">Start Date</th>
                                                    <th className="text-center py-2 px-3 text-slate-500 font-semibold">Delay</th>
                                                    <th className="text-left py-2 px-3 text-slate-500 font-semibold">Factors</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historicalStats.delayedCampaigns.map((c, idx) => (
                                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                        <td className="py-2 px-3">
                                                            <div className="font-medium text-slate-800">{c.advertiser}</div>
                                                            <div className="text-xs text-slate-500">{c.id}</div>
                                                        </td>
                                                        <td className="py-2 px-3 text-slate-600">{c.market?.split(',')[0]}</td>
                                                        <td className="py-2 px-3 text-slate-600">{c.date}</td>
                                                        <td className="py-2 px-3 text-center">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.delayDays > 14 ? 'bg-red-100 text-red-700' : c.delayDays > 7 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                {c.delayDays}d
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="flex gap-1 flex-wrap">
                                                                {c.nearHoliday && (
                                                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">🗓️ {c.nearHoliday}</span>
                                                                )}
                                                                {c.isRainySeason && (
                                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">🌧️ Rainy Season</span>
                                                                )}
                                                                {!c.nearHoliday && !c.isRainySeason && (
                                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">Unknown</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Export to window
    window.STAPRiskCommandCenter = {
        InstallationRiskCommandCenter
    };

    console.log('✅ InstallationRiskCommandCenter loaded from external file');
})();
