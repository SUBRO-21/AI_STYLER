const { useState, useEffect } = React;

// ── Icons ────────────────────────────────────────────────────────────────────
const _Icon = ({ size = 20, className = "", children }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={className}>{children}</svg>
);
const Upload      = p => <_Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></_Icon>;
const Spinner     = p => <_Icon {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></_Icon>;
const CheckCircle = p => <_Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></_Icon>;
const Droplets    = p => <_Icon {...p}><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></_Icon>;
const AlertTri    = p => <_Icon {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></_Icon>;
const Search      = p => <_Icon {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></_Icon>;
const Thermometer = p => <_Icon {...p}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></_Icon>;
const Clock       = p => <_Icon {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></_Icon>;
const Heart       = p => <_Icon {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></_Icon>;
const ImageIcon   = p => <_Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></_Icon>;
const UserIcon    = p => <_Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></_Icon>;
const Trash       = p => <_Icon {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></_Icon>;
const KeyIcon     = p => <_Icon {...p}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></_Icon>;
const Sparkles    = p => <_Icon {...p}><path d="M12 3l1.912 5.885L20 10.8l-4.788 3.915L16.8 21 12 17.1 7.2 21l1.588-6.285L4 10.8l6.088-1.915L12 3z"/></_Icon>;

// ── API Helpers ──────────────────────────────────────────────────────────────
const API_BASE = '/api';

const getHeaders = () => {
    const headers = {};
    const key = localStorage.getItem('gemini_api_key');
    if (key) headers['X-Gemini-Key'] = key;
    return headers;
};

const apiFetch = async (endpoint, options = {}) => {
    const headers = { ...options.headers, ...getHeaders() };
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
    }
    return res.json();
};

const imgSrc = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const clean = path.replace(/\\/g, '/');
    return clean.startsWith('/') ? clean : `/${clean}`;
};

// ── Availability Configurations ───────────────────────────────────────────────
const AVAIL = {
    available: { label: 'Available',   next: 'washing',   bg: 'bg-wada-celadon', text: 'text-wada-celadon', Icon: CheckCircle },
    washing:   { label: 'In the wash', next: 'damaged',   bg: 'bg-wada-mustard', text: 'text-wada-mustard', Icon: Droplets   },
    damaged:   { label: 'Damaged',     next: 'available', bg: 'bg-wada-carmine', text: 'text-wada-carmine', Icon: AlertTri   },
};
const getAvail = (item) => AVAIL[item.availability] || AVAIL.available;

// ── Upload Wizard ─────────────────────────────────────────────────────────────
function UploadWizard({ onUploadComplete }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tags, setTags] = useState(null);
    const [imagePath, setImagePath] = useState(null);

    const onFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setPreview(URL.createObjectURL(f));
        setTags(null);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const data = await apiFetch('/upload', { method: 'POST', body: fd });
            setTags(data.tags);
            setImagePath(data.image_path);
        } catch (err) {
            alert('Upload / Tagging failed: ' + err.message + '\nTip: Make sure your Gemini API key is configured in the Settings tab.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await apiFetch('/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_path: imagePath,
                    category: tags.category,
                    sub_type: tags.sub_type || null,
                    color: tags.color,
                    formality: tags.formality,
                    description: tags.description,
                }),
            });
            setFile(null);
            setPreview(null);
            setTags(null);
            setImagePath(null);
            onUploadComplete();
        } catch (err) {
            alert('Save failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-3 text-wada-navy flex items-center gap-2">
                <Upload size={22} className="text-wada-mustard" /> Add Clothes to Wardrobe
            </h2>
            <p className="text-xs text-gray-500 mb-5">
                Upload photos of your clothes. Gemini AI auto-tags categories, Wada Sanzo colors, and formality.
            </p>

            {!tags ? (
                <div className="border-2 border-dashed border-gray-200 hover:border-wada-mustard rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-colors bg-gray-50">
                    {preview ? (
                        <img src={preview} alt="preview" className="w-48 h-48 object-cover rounded-xl shadow-md border" />
                    ) : (
                        <div className="text-center">
                            <Upload size={36} className="mx-auto text-gray-400 mb-2" />
                            <p className="text-sm font-medium text-gray-700">Drag & drop or select clothing photo</p>
                            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP stored directly in local uploads/</p>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <label className="cursor-pointer bg-wada-navy text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 hover:opacity-90 shadow-sm">
                            <Upload size={16} /> Choose Photo
                            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                        </label>
                        {file && !loading && (
                            <button onClick={handleUpload}
                                className="bg-wada-mustard text-white text-sm px-6 py-2.5 rounded-lg hover:opacity-95 shadow-sm font-medium flex items-center gap-2">
                                <Sparkles size={16} /> Auto-Tag with AI
                            </button>
                        )}
                    </div>
                    {loading && (
                        <div className="flex items-center gap-2 text-wada-navy text-sm font-medium pt-2">
                            <Spinner size={18} className="animate-spin text-wada-mustard" />
                            Analyzing item with Gemini Vision…
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-wada-ivory bg-opacity-40 p-5 rounded-xl border border-gray-200">
                    <img src={preview} alt="preview" className="w-full h-64 object-cover rounded-xl shadow" />
                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-wada-navy uppercase tracking-wider">AI Tagged Details</h3>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Category</label>
                            <select value={tags.category}
                                onChange={e => setTags({ ...tags, category: e.target.value, sub_type: null })}
                                className="mt-1 w-full border bg-white p-2 rounded-lg text-sm focus:ring-2 focus:ring-wada-mustard outline-none">
                                {['top','bottom','outerwear','shoes','accessory','dress'].map(c =>
                                    <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                            </select>
                        </div>
                        {tags.category === 'accessory' && (
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Accessory Type</label>
                                <select value={tags.sub_type || ''}
                                    onChange={e => setTags({ ...tags, sub_type: e.target.value })}
                                    className="mt-1 w-full border bg-white p-2 rounded-lg text-sm focus:ring-2 focus:ring-wada-mustard outline-none">
                                    <option value="">— select type —</option>
                                    {['belt','watch','bag','hat','sunglasses','jewellery','scarf'].map(t =>
                                        <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Color (Wada Concept)</label>
                                <input type="text" value={tags.color}
                                    onChange={e => setTags({ ...tags, color: e.target.value })}
                                    className="mt-1 w-full border bg-white p-2 rounded-lg text-sm focus:ring-2 focus:ring-wada-mustard outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Formality</label>
                                <select value={tags.formality}
                                    onChange={e => setTags({ ...tags, formality: e.target.value })}
                                    className="mt-1 w-full border bg-white p-2 rounded-lg text-sm focus:ring-2 focus:ring-wada-mustard outline-none">
                                    <option value="casual">Casual</option>
                                    <option value="smart-casual">Smart-Casual</option>
                                    <option value="formal">Formal</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
                            <input type="text" value={tags.description}
                                onChange={e => setTags({ ...tags, description: e.target.value })}
                                className="mt-1 w-full border bg-white p-2 rounded-lg text-sm focus:ring-2 focus:ring-wada-mustard outline-none" />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button onClick={handleSave} disabled={loading}
                                className="flex-1 bg-wada-celadon text-white py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                                {loading ? <Spinner size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                Save to Local Wardrobe
                            </button>
                            <button onClick={() => { setTags(null); setFile(null); setPreview(null); }}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Wardrobe Grid ─────────────────────────────────────────────────────────────
function WardrobeGrid({ items, onToggleAvailability, onDeleteItem }) {
    const [filter, setFilter] = useState('all');
    const filtered    = filter === 'all' ? items : items.filter(i => i.category === filter);
    const clothing    = filtered.filter(i => i.category !== 'accessory');
    const accessories = filtered.filter(i => i.category === 'accessory');

    function ItemCard({ item }) {
        const av = getAvail(item);
        const AvIcon = av.Icon;
        return (
            <div className={`border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all relative group ${
                item.availability && item.availability !== 'available' ? 'opacity-60' : ''
            }`}>
                <img src={imgSrc(item.image_path)} alt={item.description} className="w-full h-44 object-cover" />
                
                {/* Availability status badge & toggle button */}
                <button title={`${av.label} — click to change`}
                    onClick={() => onToggleAvailability(item.id, item.availability || 'available')}
                    className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs text-white font-medium shadow flex items-center gap-1 ${av.bg}`}>
                    <AvIcon size={12} /> {av.label}
                </button>

                {/* Delete button */}
                <button title="Delete item"
                    onClick={() => onDeleteItem(item.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white bg-opacity-90 text-red-500 hover:bg-red-500 hover:text-white transition shadow opacity-80 group-hover:opacity-100">
                    <Trash size={14} />
                </button>

                <div className="p-3">
                    <p className="font-semibold text-sm truncate text-wada-charcoal" title={item.description}>{item.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium text-wada-navy">{item.color}</span> · {item.formality}
                        {item.sub_type ? ` · ${item.sub_type}` : ''}
                    </p>
                    {item.last_worn && (
                        <p className="text-xs text-wada-mustard mt-1.5 flex items-center gap-1 font-medium">
                            <Clock size={11} /> Last worn {new Date(item.last_worn).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 pb-3 border-b border-gray-100">
                <div>
                    <h2 className="text-xl font-bold text-wada-navy">Your Local Wardrobe</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{items.length} items stored in local SQLite database</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Filter:</span>
                    <select value={filter} onChange={e => setFilter(e.target.value)}
                        className="border border-gray-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-wada-mustard bg-white">
                        <option value="all">All Items ({items.length})</option>
                        {['top','bottom','outerwear','shoes','dress','accessory'].map(c =>
                            <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}s</option>)}
                    </select>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Upload size={40} className="mx-auto mb-2 opacity-30 text-wada-navy" />
                    <p className="font-medium text-gray-600">No clothes uploaded yet</p>
                    <p className="text-xs text-gray-400 mt-1">Add your clothes using the upload box above to start styling.</p>
                </div>
            ) : null}

            {clothing.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {clothing.map(item => <ItemCard key={item.id} item={item} />)}
                </div>
            )}

            {accessories.length > 0 && (
                <div className="mt-8 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Accessories ({accessories.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {accessories.map(item => <ItemCard key={item.id} item={item} />)}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Event Planner & Outfit Generator ──────────────────────────────────────────
function EventPlanner({ setOutfits, setCurrentEvent }) {
    const [event,   setEvent]   = useState({ description: '', date: '', location: '' });
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(false);
    const [genMsg,  setGenMsg]  = useState('');

    const fetchWeather = async () => {
        if (!event.location) return;
        setLoading(true);
        try {
            const data = await apiFetch('/weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
            setWeather(data);
        } catch (err) {
            alert('Could not fetch weather: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateOutfits = async () => {
        if (!event.description.trim()) {
            alert('Please specify the event or occasion description.');
            return;
        }
        setLoading(true);
        setGenMsg('Styling outfits with Wada Sanzo color harmonies & creating previews…');
        try {
            setCurrentEvent({ description: event.description, date: event.date });
            const data = await apiFetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: event.description, weather: weather || {} }),
            });
            setOutfits(data.outfits || []);
        } catch (err) {
            alert('Generation error: ' + err.message + '\nMake sure your Gemini API key is configured.');
        } finally {
            setLoading(false);
            setGenMsg('');
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-t-4 border-t-wada-mustard">
            <h2 className="text-xl font-bold mb-2 text-wada-navy flex items-center gap-2">
                <Sparkles size={22} className="text-wada-mustard" /> Plan Outfit for an Event
            </h2>
            <p className="text-xs text-gray-500 mb-5">
                Enter your event details and location. The AI checks real weather forecasts to select appropriate colors, layers, and formality.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Occasion / Event</label>
                    <input type="text" placeholder="e.g. Dinner date, Office meeting, Sunday brunch"
                        className="mt-1 w-full border border-gray-200 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-wada-mustard"
                        value={event.description}
                        onChange={e => setEvent({ ...event, description: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Date (Optional)</label>
                    <input type="date"
                        className="mt-1 w-full border border-gray-200 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-wada-mustard"
                        value={event.date}
                        onChange={e => setEvent({ ...event, date: e.target.value })} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">City / Location</label>
                    <div className="flex gap-2 mt-1">
                        <input type="text" placeholder="e.g. London, Mumbai, New York"
                            className="border border-gray-200 p-2.5 rounded-lg flex-1 text-sm outline-none focus:ring-2 focus:ring-wada-mustard"
                            value={event.location}
                            onChange={e => setEvent({ ...event, location: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && fetchWeather()} />
                        <button onClick={fetchWeather} disabled={loading || !event.location}
                            title="Get Weather"
                            className="bg-wada-navy text-white px-3.5 rounded-lg hover:opacity-90 disabled:opacity-50">
                            <Search size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {weather && (
                <div className="bg-wada-ivory bg-opacity-60 rounded-xl p-4 mb-4 flex items-center justify-between border border-amber-100">
                    <div className="flex items-center gap-3">
                        <Thermometer className="text-wada-carmine" size={24} />
                        <div>
                            <p className="font-semibold text-wada-navy text-sm">
                                Weather in {event.location} {event.date ? `on ${event.date}` : 'today'}
                            </p>
                            <p className="text-xs text-gray-600">
                                Temperature: {weather.temp_min}°C to {weather.temp_max}°C · Rain chance: {weather.precip_chance}%
                            </p>
                        </div>
                    </div>
                    <span className="text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-full text-wada-navy font-medium">
                        Weather integrated
                    </span>
                </div>
            )}

            <div className="flex justify-end pt-2">
                <button onClick={generateOutfits} disabled={loading || !event.description.trim()}
                    className="bg-wada-mustard text-white px-7 py-3 rounded-xl text-sm font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2 shadow-sm transition">
                    {loading ? <Spinner size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    Generate Outfit Recommendations
                </button>
            </div>

            {genMsg && (
                <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-xs text-center font-medium animate-pulse">
                    {genMsg}
                </div>
            )}
        </div>
    );
}

// ── Outfit Cards ──────────────────────────────────────────────────────────────
function OutfitCards({ outfits, items, currentEvent, onWore }) {
    if (!outfits || outfits.length === 0) return null;

    const postFeedback = (outfit, type, text = '') =>
        apiFetch('/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                outfit_items: JSON.stringify(outfit.item_ids),
                weather_fit: outfit.reasoning?.weather_fit || '',
                event_fit: outfit.reasoning?.event_fit || '',
                overall_note: outfit.reasoning?.overall_note || '',
                feedback_type: type,
                feedback_text: text,
            }),
        }).catch(console.error);

    const handleWore = async (outfit) => {
        try {
            await apiFetch('/outfit-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_ids: JSON.stringify(outfit.item_ids),
                    event_description: currentEvent?.description || 'Styled Outfit',
                    date: currentEvent?.date || new Date().toISOString().split('T')[0],
                }),
            });
            await postFeedback(outfit, 'wore');
            if (onWore) onWore();
            alert('Logged to your outfit history!');
        } catch (err) {
            alert('Could not save: ' + err.message);
        }
    };

    return (
        <div className="mt-8 space-y-6">
            <h2 className="text-xl font-bold text-wada-navy">Recommended Outfits</h2>
            {outfits.map((outfit, idx) => {
                const outfitItems = (outfit.item_ids || [])
                    .map(id => items.find(i => i.id === id)).filter(Boolean);
                return (
                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {outfit.outfit_image && (
                            <div className="bg-gray-50 border-b p-4">
                                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold flex items-center gap-1.5">
                                    <ImageIcon size={14} className="text-wada-navy" /> AI Visual Try-On / Flat-Lay
                                </p>
                                <img src={outfit.outfit_image} alt="AI generated try-on"
                                    className="w-full max-h-96 object-contain rounded-xl bg-white p-2 shadow-inner" />
                            </div>
                        )}
                        <div className="p-6">
                            <h3 className="text-sm font-bold text-wada-navy uppercase tracking-wider mb-3">
                                Items in this combination ({outfitItems.length})
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-3 mb-5">
                                {outfitItems.map(item => (
                                    <div key={item.id} className="min-w-[110px] w-[110px] border border-gray-100 rounded-xl p-2 bg-gray-50">
                                        <img src={imgSrc(item.image_path)} className="w-full h-28 object-cover rounded-lg" />
                                        <p className="text-xs font-semibold text-wada-charcoal mt-1.5 truncate">{item.description}</p>
                                        <p className="text-[11px] text-gray-400 capitalize">{item.category}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-wada-ivory bg-opacity-70 rounded-xl p-4 text-sm mb-5 space-y-2 border border-amber-100">
                                {outfit.reasoning?.weather_fit && (
                                    <p><span className="font-semibold text-wada-navy">Weather match: </span>{outfit.reasoning.weather_fit}</p>
                                )}
                                {outfit.reasoning?.event_fit && (
                                    <p><span className="font-semibold text-wada-navy">Occasion match: </span>{outfit.reasoning.event_fit}</p>
                                )}
                                {outfit.reasoning?.overall_note && (
                                    <p><span className="font-semibold text-wada-carmine">Stylist color harmony: </span>{outfit.reasoning.overall_note}</p>
                                )}
                            </div>

                            <div className="flex gap-3 flex-wrap">
                                <button onClick={() => handleWore(outfit)}
                                    className="bg-wada-navy text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex items-center gap-2 shadow-sm">
                                    <Heart size={16} /> I Wore This
                                </button>
                                <button onClick={() => postFeedback(outfit, 'like')}
                                    className="bg-wada-celadon text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90">
                                    Love This Style
                                </button>
                                <button onClick={() => {
                                        const note = prompt("What was off with this outfit? (optional)");
                                        postFeedback(outfit, 'not_for_me', note || '');
                                    }}
                                    className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200">
                                    Not For Me
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Outfit History ────────────────────────────────────────────────────────────
function OutfitHistory({ items }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadHistory = () => {
        setLoading(true);
        apiFetch('/outfit-history')
            .then(setHistory)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadHistory(); }, []);

    if (loading) return (
        <div className="flex justify-center py-16 text-wada-mustard">
            <Spinner size={36} className="animate-spin" />
        </div>
    );

    if (history.length === 0) return (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
            <Clock size={44} className="mx-auto mb-3 opacity-30 text-wada-navy" />
            <h3 className="font-bold text-gray-700 text-lg">No outfit history yet</h3>
            <p className="text-sm mt-1">Generate an outfit and click "I Wore This" to log it to your local history.</p>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold text-wada-navy">Outfit History ({history.length})</h2>
            </div>
            {history.map(entry => {
                const ids = (() => { try { return JSON.parse(entry.item_ids); } catch { return []; } })();
                const entryItems = ids.map(id => items.find(i => i.id === id)).filter(Boolean);
                return (
                    <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-wada-navy text-base">{entry.event_description || 'Outfit'}</h3>
                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                    <Clock size={12} /> Worn on: <span className="font-medium text-gray-600">{entry.date}</span> · Logged: {new Date(entry.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {entryItems.length > 0 ? (
                                entryItems.map(item => (
                                    <div key={item.id} className="min-w-[80px] w-[80px] bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                        <img src={imgSrc(item.image_path)} className="w-full h-24 object-cover rounded-md" />
                                        <p className="text-[11px] font-medium text-center mt-1 truncate">{item.description}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400 italic">Items were deleted from wardrobe.</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Try-On Profile & Stats ────────────────────────────────────────────────────
function ProfileSection() {
    const [photo,   setPhoto]   = useState(null);
    const [stats,   setStats]   = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiFetch('/profile-photo')
            .then(d => { if (d && d.profile_photo) setPhoto(d.profile_photo); })
            .catch(() => {});
        apiFetch('/profile-stats')
            .then(setStats)
            .catch(() => {});
    }, []);

    const handleUpload = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setLoading(true);
        const fd = new FormData();
        fd.append('file', f);
        try {
            const d = await apiFetch('/profile-photo', { method: 'POST', body: fd });
            setPhoto(d.profile_photo + '?t=' + Date.now());
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePhoto = async () => {
        if (!confirm('Remove try-on photo?')) return;
        try {
            await apiFetch('/profile-photo', { method: 'DELETE' });
            setPhoto(null);
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="shrink-0 relative">
                    {photo ? (
                        <div className="relative group">
                            <img src={imgSrc(photo)} alt="Try-on photo"
                                className="w-24 h-24 rounded-2xl object-cover border-2 border-wada-mustard shadow-md" />
                            <button onClick={handleDeletePhoto}
                                title="Remove photo"
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition">
                                <Trash size={12} />
                            </button>
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-2xl bg-wada-ivory flex items-center justify-center border-2 border-dashed border-wada-mustard text-wada-mustard">
                            <UserIcon size={36} className="opacity-70" />
                        </div>
                    )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                    <h3 className="font-bold text-wada-navy text-base">
                        {photo ? 'Your Virtual Try-On Photo' : 'Add Your Photo for Virtual Try-On'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 mb-3 max-w-lg">
                        {photo
                            ? 'Gemini models generate realistic previews of you wearing suggested outfits.'
                            : 'Upload a standing portrait photo, and the AI will visualize you wearing your clothes.'}
                    </p>
                    <label className="cursor-pointer bg-wada-navy text-white text-xs px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:opacity-90 transition shadow-sm">
                        {loading ? <Spinner size={14} className="animate-spin" /> : <Upload size={14} />}
                        {photo ? 'Change Try-On Photo' : 'Upload Try-On Photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                    </label>
                </div>
                {stats && (
                    <div className="flex gap-3 pt-2 sm:pt-0">
                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-center min-w-[90px]">
                            <p className="text-xl font-black text-wada-navy">{stats.item_count}</p>
                            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Clothes</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-center min-w-[90px]">
                            <p className="text-xl font-black text-wada-mustard">{stats.outfit_count}</p>
                            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Worn</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Settings Page ─────────────────────────────────────────────────────────────
function SettingsPage({ onClearAll }) {
    const [key, setKey] = useState(localStorage.getItem('gemini_api_key') || '');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        if (key.trim()) {
            localStorage.setItem('gemini_api_key', key.trim());
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const hasSavedKey = !!localStorage.getItem('gemini_api_key');

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-wada-navy">Settings & API Key</h2>

            {/* Gemini API Key Box */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-2">
                    <KeyIcon size={20} className="text-wada-mustard" />
                    <h3 className="font-bold text-wada-navy">Gemini API Key</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    Your key is stored safely on your machine. You can enter it here or set it in your local <code className="bg-gray-100 px-1 py-0.5 rounded text-wada-navy font-mono">.env</code> file.
                </p>

                <div className="flex gap-2">
                    <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={key}
                        onChange={e => { setKey(e.target.value); setSaved(false); }}
                        className="flex-1 border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-wada-mustard font-mono"
                    />
                    <button onClick={handleSave}
                        className="bg-wada-navy text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex items-center gap-2 shadow-sm">
                        {saved ? <><CheckCircle size={16} /> Saved!</> : 'Save Key'}
                    </button>
                </div>

                {hasSavedKey && (
                    <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-wada-celadon font-medium flex items-center gap-1.5">
                            <CheckCircle size={14} /> Key saved in local browser storage
                        </p>
                        <button onClick={() => { localStorage.removeItem('gemini_api_key'); setKey(''); }}
                            className="text-xs text-red-500 hover:underline">
                            Remove Key
                        </button>
                    </div>
                )}
            </div>

            {/* Help getting the key */}
            <div className="bg-wada-ivory bg-opacity-70 rounded-2xl p-5 text-xs text-gray-600 space-y-2 border border-amber-100">
                <p className="font-bold text-wada-navy text-sm">How to get a free Google Gemini API key:</p>
                <ol className="list-decimal pl-4 space-y-1">
                    <li>Visit <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-wada-navy font-semibold underline">Google AI Studio (aistudio.google.com/apikey)</a>.</li>
                    <li>Click <strong>Create API Key</strong>.</li>
                    <li>Paste your key above or in your local <code className="bg-white px-1.5 py-0.5 rounded border text-wada-charcoal font-mono">.env</code> file.</li>
                </ol>
            </div>

            {/* Local Storage Information */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                <h3 className="font-bold text-wada-navy text-sm">Local Storage & Privacy</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                    All your uploaded clothes images are saved in your local <code className="bg-gray-100 px-1 py-0.5 rounded text-wada-navy font-mono">uploads/</code> directory. All tags, availability, and outfit logs are saved in <code className="bg-gray-100 px-1 py-0.5 rounded text-wada-navy font-mono">wardrobe.db</code> (SQLite). Nothing is sent to third-party databases.
                </p>
                <div className="pt-2">
                    <button onClick={onClearAll}
                        className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition">
                        <Trash size={14} /> Reset & Clear All Local Wardrobe Data
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main App Component ────────────────────────────────────────────────────────
function App() {
    const [items, setItems] = useState([]);
    const [outfits, setOutfits] = useState([]);
    const [currentEvent, setCurrentEvent] = useState({ description: '', date: '' });
    const [tab, setTab] = useState('wardrobe'); // 'wardrobe' | 'plan' | 'history' | 'settings'

    const fetchItems = async () => {
        try {
            const data = await apiFetch('/items');
            setItems(data);
        } catch (err) {
            console.error('Failed to load items:', err);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleToggleAvailability = async (id, current) => {
        const next = AVAIL[current]?.next || 'available';
        try {
            await apiFetch(`/items/${id}/availability`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ availability: next }),
            });
            fetchItems();
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    };

    const handleDeleteItem = async (id) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            await apiFetch(`/items/${id}`, { method: 'DELETE' });
            fetchItems();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('WARNING: This will delete ALL clothing photos, wardrobe items, and outfit history from your local machine. Are you sure?')) return;
        try {
            await apiFetch('/clear-data', { method: 'DELETE' });
            fetchItems();
            setOutfits([]);
            alert('Local data reset successfully.');
        } catch (err) {
            alert('Clear failed: ' + err.message);
        }
    };

    const TABS = [
        { id: 'wardrobe', label: 'My Wardrobe',  icon: Upload },
        { id: 'plan',     label: 'Plan Outfits', icon: Sparkles },
        { id: 'history',  label: 'History',      icon: Clock },
        { id: 'settings', label: 'Settings',     icon: KeyIcon },
    ];

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-12">
            <div className="max-w-5xl mx-auto px-4 py-6">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-wada-mustard border-opacity-30">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-extrabold text-wada-navy tracking-tight">AI Stylist</h1>
                            <span className="bg-wada-celadon bg-opacity-20 text-wada-celadon text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Local
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Smart wardrobe stylist powered by Gemini & Wada Sanzo color principles</p>
                    </div>

                    {/* Navigation */}
                    <nav className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                        {TABS.map(({ id, label, icon: TabIcon }) => (
                            <button key={id} onClick={() => setTab(id)}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all ${
                                    tab === id
                                        ? 'bg-wada-navy text-white shadow-sm'
                                        : 'text-gray-600 hover:text-wada-navy hover:bg-gray-50'
                                }`}>
                                <TabIcon size={14} />
                                {label}
                            </button>
                        ))}
                    </nav>
                </header>

                {/* Tab: Wardrobe */}
                {tab === 'wardrobe' && (
                    <div className="space-y-6">
                        <ProfileSection />
                        <UploadWizard onUploadComplete={fetchItems} />
                        <WardrobeGrid
                            items={items}
                            onToggleAvailability={handleToggleAvailability}
                            onDeleteItem={handleDeleteItem}
                        />
                    </div>
                )}

                {/* Tab: Plan Outfits */}
                {tab === 'plan' && (
                    <div className="space-y-6">
                        <EventPlanner setOutfits={setOutfits} setCurrentEvent={setCurrentEvent} />
                        <OutfitCards
                            outfits={outfits}
                            items={items}
                            currentEvent={currentEvent}
                            onWore={fetchItems}
                        />
                    </div>
                )}

                {/* Tab: History */}
                {tab === 'history' && (
                    <OutfitHistory items={items} />
                )}

                {/* Tab: Settings */}
                {tab === 'settings' && (
                    <SettingsPage onClearAll={handleClearAll} />
                )}
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
