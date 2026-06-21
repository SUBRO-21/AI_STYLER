const { useState, useEffect } = React;

// Inline SVG icon components (replaces lucide CDN which doesn't ship React components)
const _Icon = ({size=24, className="", children}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className={className}>{children}</svg>
);
const Upload      = (p) => <_Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></_Icon>;
const RefreshCw   = (p) => <_Icon {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></_Icon>;
const Check       = (p) => <_Icon {...p}><polyline points="20 6 9 17 4 12"/></_Icon>;
const X           = (p) => <_Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></_Icon>;
const Thermometer = (p) => <_Icon {...p}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></_Icon>;
const Search      = (p) => <_Icon {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></_Icon>;

// --- API Helpers ---
const API_BASE = '/api';

const apiFetch = async (endpoint, options = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText);
    }
    return res.json();
};

// --- Components ---

function UploadWizard({ onUploadComplete }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [tags, setTags] = useState(null);
    const [imagePath, setImagePath] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const data = await apiFetch('/upload', {
                method: 'POST',
                body: formData
            });
            setTags(data.tags);
            setImagePath(data.image_path);
        } catch (err) {
            alert('Upload failed: ' + err.message);
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
                    color: tags.color,
                    formality: tags.formality,
                    description: tags.description
                })
            });
            alert('Item saved!');
            setFile(null);
            setPreviewUrl(null);
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-wada-ivory border-opacity-50">
            <h2 className="text-2xl font-semibold mb-4 text-wada-navy">Add to Wardrobe</h2>
            
            {!tags ? (
                <div className="flex flex-col items-center">
                    {previewUrl && (
                        <img src={previewUrl} alt="Preview" className="w-48 h-48 object-cover rounded-lg mb-4" />
                    )}
                    <label className="cursor-pointer bg-wada-navy text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-opacity-90 transition">
                        <Upload size={20} />
                        Select Image
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    {file && (
                        <button 
                            onClick={handleUpload} 
                            disabled={loading}
                            className="mt-4 bg-wada-carmine text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-opacity-90 disabled:opacity-50 transition"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Check size={20} />}
                            {loading ? 'Analyzing with AI...' : 'Auto-Tag Item'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <img src={previewUrl} alt="Preview" className="w-full h-auto object-cover rounded-lg" />
                    </div>
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium text-wada-charcoal mb-1">Category</label>
                            <select 
                                value={tags.category} 
                                onChange={e => setTags({...tags, category: e.target.value})}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-wada-mustard outline-none"
                            >
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                <option value="outerwear">Outerwear</option>
                                <option value="shoes">Shoes</option>
                                <option value="accessory">Accessory</option>
                                <option value="dress">Dress</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-wada-charcoal mb-1">Color (Wada Sanzo match)</label>
                            <input 
                                type="text" 
                                value={tags.color} 
                                onChange={e => setTags({...tags, color: e.target.value})}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-wada-mustard outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-wada-charcoal mb-1">Formality</label>
                            <select 
                                value={tags.formality} 
                                onChange={e => setTags({...tags, formality: e.target.value})}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-wada-mustard outline-none"
                            >
                                <option value="casual">Casual</option>
                                <option value="smart-casual">Smart-Casual</option>
                                <option value="formal">Formal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-wada-charcoal mb-1">Description</label>
                            <input 
                                type="text" 
                                value={tags.description} 
                                onChange={e => setTags({...tags, description: e.target.value})}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-wada-mustard outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="mt-4 bg-wada-celadon text-white px-6 py-2 rounded-lg font-medium hover:bg-opacity-90 disabled:opacity-50 transition"
                        >
                            {loading ? 'Saving...' : 'Confirm & Save'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function WardrobeGrid({ items, onToggleAvailability }) {
    const [filter, setFilter] = useState('all');

    const filteredItems = filter === 'all' ? items : items.filter(i => i.category === filter);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm mt-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-wada-navy">Your Wardrobe</h2>
                <select 
                    value={filter} 
                    onChange={e => setFilter(e.target.value)}
                    className="border p-2 rounded outline-none focus:ring-2 focus:ring-wada-mustard"
                >
                    <option value="all">All Categories</option>
                    <option value="top">Tops</option>
                    <option value="bottom">Bottoms</option>
                    <option value="outerwear">Outerwear</option>
                    <option value="shoes">Shoes</option>
                    <option value="accessory">Accessories</option>
                    <option value="dress">Dresses</option>
                </select>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {filteredItems.map(item => (
                    <div key={item.id} className={`border rounded-lg overflow-hidden relative ${!item.available ? 'opacity-60' : ''}`}>
                        <img src={`/${item.image_path}`} alt={item.description} className="w-full h-48 object-cover" />
                        <div className="p-3 bg-white">
                            <p className="font-medium text-sm truncate" title={item.description}>{item.description}</p>
                            <p className="text-xs text-gray-500">{item.color} • {item.formality}</p>
                        </div>
                        <button 
                            onClick={() => onToggleAvailability(item.id, !item.available)}
                            className={`absolute top-2 right-2 p-1 rounded-full text-white ${item.available ? 'bg-wada-celadon' : 'bg-wada-carmine'}`}
                            title={item.available ? "Mark as unavailable" : "Mark as available"}
                        >
                            {item.available ? <Check size={16} /> : <X size={16} />}
                        </button>
                    </div>
                ))}
            </div>
            {filteredItems.length === 0 && <p className="text-center text-gray-500 py-8">No items found.</p>}
        </div>
    );
}

function EventPlanner({ setOutfits }) {
    const [event, setEvent] = useState({ description: '', date: '', location: '' });
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFetchWeather = async () => {
        if (!event.location) return;
        setLoading(true);
        try {
            const data = await apiFetch('/weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            });
            setWeather(data);
        } catch (err) {
            alert('Could not fetch weather: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateOutfits = async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: event.description,
                    weather: weather
                })
            });
            setOutfits(data.outfits);
        } catch (err) {
            alert('Outfit generation failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm mb-8 border-t-4 border-wada-mustard">
            <h2 className="text-2xl font-semibold mb-4 text-wada-navy">Plan an Event</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input 
                    type="text" 
                    placeholder="Event (e.g. Rooftop dinner)" 
                    className="border p-2 rounded outline-none focus:ring-2 focus:ring-wada-mustard"
                    value={event.description}
                    onChange={e => setEvent({...event, description: e.target.value})}
                />
                <input 
                    type="date" 
                    className="border p-2 rounded outline-none focus:ring-2 focus:ring-wada-mustard"
                    value={event.date}
                    onChange={e => setEvent({...event, date: e.target.value})}
                />
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="City" 
                        className="border p-2 rounded flex-1 outline-none focus:ring-2 focus:ring-wada-mustard"
                        value={event.location}
                        onChange={e => setEvent({...event, location: e.target.value})}
                    />
                    <button 
                        onClick={handleFetchWeather}
                        className="bg-wada-navy text-white p-2 rounded hover:bg-opacity-90"
                        title="Fetch Weather"
                    >
                        <Search size={20} />
                    </button>
                </div>
            </div>

            {weather && (
                <div className="bg-wada-ivory p-4 rounded-lg flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <Thermometer className="text-wada-carmine" />
                        <div>
                            <p className="font-semibold text-wada-navy">Weather Forecast</p>
                            <p className="text-sm text-gray-600">Max: {weather.temp_max}°C | Min: {weather.temp_min}°C | Precip: {weather.precip_chance}%</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleGenerateOutfits}
                        disabled={loading || !event.description}
                        className="bg-wada-mustard text-white px-6 py-2 rounded-lg font-medium hover:bg-opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <RefreshCw className="animate-spin" size={16} />}
                        Style Me
                    </button>
                </div>
            )}
        </div>
    );
}

function OutfitCards({ outfits, items }) {
    if (!outfits || outfits.length === 0) return null;

    const handleFeedback = async (outfit, type, text = "") => {
        try {
            await apiFetch('/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    outfit_items: JSON.stringify(outfit.item_ids),
                    weather_fit: outfit.reasoning.weather_fit,
                    event_fit: outfit.reasoning.event_fit,
                    overall_note: outfit.reasoning.overall_note,
                    feedback_type: type,
                    feedback_text: text
                })
            });
            alert('Feedback saved!');
        } catch (err) {
            alert('Feedback failed: ' + err.message);
        }
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-semibold text-wada-navy">Suggested Outfits</h2>
            {outfits.map((outfit, idx) => {
                const outfitItems = outfit.item_ids.map(id => items.find(i => i.id === id)).filter(Boolean);
                
                return (
                    <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                            {outfitItems.map(item => (
                                <div key={item.id} className="min-w-[120px] max-w-[120px]">
                                    <img src={`/${item.image_path}`} className="w-full h-32 object-cover rounded border" />
                                    <p className="text-xs text-center mt-2 truncate">{item.description}</p>
                                </div>
                            ))}
                        </div>
                        
                        <div className="bg-wada-ivory p-4 rounded-lg mb-4 text-sm text-wada-charcoal">
                            <p className="mb-2"><strong className="text-wada-navy">Weather Fit:</strong> {outfit.reasoning.weather_fit}</p>
                            <p className="mb-2"><strong className="text-wada-navy">Event Fit:</strong> {outfit.reasoning.event_fit}</p>
                            <p><strong className="text-wada-carmine">Stylist Note (Wada Sanzo):</strong> {outfit.reasoning.overall_note}</p>
                        </div>

                        <div className="flex gap-4 items-center">
                            <button 
                                onClick={() => handleFeedback(outfit, 'wear')}
                                className="bg-wada-celadon text-white px-4 py-2 rounded font-medium hover:bg-opacity-90"
                            >
                                I'd wear this
                            </button>
                            <button 
                                onClick={() => {
                                    const reason = prompt("What's off about it? (Optional)");
                                    handleFeedback(outfit, 'not_for_me', reason || "");
                                }}
                                className="bg-gray-200 text-wada-charcoal px-4 py-2 rounded font-medium hover:bg-gray-300"
                            >
                                Not for me
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// --- Main App ---

function App() {
    const [items, setItems] = useState([]);
    const [outfits, setOutfits] = useState([]);
    const [activeTab, setActiveTab] = useState('wardrobe'); // 'wardrobe', 'plan'

    const fetchItems = async () => {
        try {
            const data = await apiFetch('/items');
            setItems(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleToggleAvailability = async (id, newStatus) => {
        try {
            await apiFetch(`/items/${id}/availability`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ available: newStatus })
            });
            fetchItems();
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    };

    return (
        <div className="min-h-screen font-sans max-w-5xl mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8 pb-4 border-b border-wada-mustard border-opacity-30">
                <h1 className="text-3xl font-bold text-wada-navy tracking-tight">AI Stylist</h1>
                <nav className="flex gap-4">
                    <button 
                        className={`font-medium pb-1 border-b-2 ${activeTab === 'wardrobe' ? 'border-wada-carmine text-wada-carmine' : 'border-transparent text-gray-500'}`}
                        onClick={() => setActiveTab('wardrobe')}
                    >
                        Wardrobe
                    </button>
                    <button 
                        className={`font-medium pb-1 border-b-2 ${activeTab === 'plan' ? 'border-wada-carmine text-wada-carmine' : 'border-transparent text-gray-500'}`}
                        onClick={() => setActiveTab('plan')}
                    >
                        Plan Outfit
                    </button>
                </nav>
            </header>

            <main>
                {activeTab === 'wardrobe' && (
                    <div className="animate-fade-in">
                        <UploadWizard onUploadComplete={fetchItems} />
                        <WardrobeGrid items={items} onToggleAvailability={handleToggleAvailability} />
                    </div>
                )}
                
                {activeTab === 'plan' && (
                    <div className="animate-fade-in">
                        <EventPlanner setOutfits={setOutfits} />
                        <OutfitCards outfits={outfits} items={items} />
                    </div>
                )}
            </main>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
