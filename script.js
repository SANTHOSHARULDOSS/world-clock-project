/** * AuraTime Elite - Precision Logic v4.0
 * Fixed: Time rendering for searched/selected locations
 */
class AuraEngine {
    constructor() {
        this.state = {
            localTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            targetTz: null,
            map: null,
            marker: null,
            is24Hour: false
        };
        this.init();
    }

    init() {
        this.state.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20, 0], 2);
        this.tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.state.map);
        
        this.state.map.on('click', (e) => this.sync(e.latlng.lat, e.latlng.lng));
        this.bind();
        this.loop();
        this.detect();
    }

    async sync(lat, lon, label = null) {
        // Step 1: Show loading state immediately
        document.getElementById('targetClock').textContent = "SYNCING...";
        document.getElementById('targetPlace').textContent = label || "Detecting Place...";
        
        if (this.state.marker) this.state.map.removeLayer(this.state.marker);
        this.state.marker = L.circleMarker([lat, lon], { radius: 10, color: '#6366f1', weight: 3 }).addTo(this.state.map);

        try {
            // Step 2: Fetch precise IANA Timezone ID
            const res = await fetch(`https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lon}&localityLanguage=en&key=free`);
            const data = await res.json();

            // Step 3: Get Place Name if not already provided by Search
            if(!label) {
                const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const gData = await geo.json();
                label = gData.address.city || gData.address.town || gData.address.country || "Remote Point";
            }

            // Step 4: COMMIT DATA TO STATE (This is the fix)
            this.state.targetTz = data.ianaTimeId; 
            
            document.getElementById('targetPlace').textContent = label;
            document.getElementById('tzLabel').textContent = this.state.targetTz;
            document.getElementById('targetCard').classList.add('active');

            // Mobile: Close map automatically after a short delay so user sees the clock
            if(window.innerWidth < 768) {
                setTimeout(() => document.getElementById('mapView').classList.remove('active'), 1200);
                setTimeout(() => document.getElementById('dashboard').classList.add('active'), 1200);
            }
            
        } catch (e) {
            document.getElementById('targetClock').textContent = "DATA ERROR";
        }
    }

    loop() {
        setInterval(() => {
            const now = new Date();
            const opt = (tz) => ({ 
                timeZone: tz, 
                hour: '2-digit', minute: '2-digit', second: '2-digit', 
                hour12: !this.state.is24Hour 
            });

            // Update Local
            document.getElementById('localClock').textContent = now.toLocaleTimeString('en-US', opt(this.state.localTz));
            document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            // Update Target (ONLY if state.targetTz exists)
            if (this.state.targetTz) {
                try {
                    const timeString = now.toLocaleTimeString('en-US', opt(this.state.targetTz));
                    document.getElementById('targetClock').textContent = timeString;
                    
                    const hr = parseInt(new Intl.DateTimeFormat('en-GB', {timeZone: this.state.targetTz, hour: 'numeric', hour12: false}).format(now));
                    document.getElementById('solarLabel').textContent = (hr >= 6 && hr < 18) ? "DAYLIGHT" : "NIGHTFALL";
                } catch (e) {
                    document.getElementById('targetClock').textContent = "ZONE ERROR";
                }
            }
        }, 1000);
    }

    bind() {
        // UI Switching
        document.getElementById('openMapBtn').onclick = () => {
            document.getElementById('dashboard').classList.remove('active');
            document.getElementById('mapView').classList.add('active');
            setTimeout(() => this.state.map.invalidateSize(), 200);
        };
        document.getElementById('closeMapBtn').onclick = () => {
            document.getElementById('mapView').classList.remove('active');
            document.getElementById('dashboard').classList.add('active');
        };

        // Theme
        document.getElementById('themeToggle').onclick = () => {
            const r = document.documentElement;
            const n = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            r.setAttribute('data-theme', n);
            this.tiles.setUrl(n === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
        };

        // Format
        document.getElementById('formatToggle').onchange = (e) => this.state.is24Hour = e.target.checked;

        // Universal Search
        const inp = document.getElementById('citySearch');
        inp.oninput = async (e) => {
            const val = e.target.value;
            if(val.length < 3) return;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${val}`);
            const data = await res.json();
            document.getElementById('suggestions').innerHTML = data.slice(0,5).map(i => `
                <div class="item" onclick="engine.handleSelect(${i.lat}, ${i.lon}, '${i.display_name.split(',')[0]}')">${i.display_name}</div>
            `).join('');
        };
    }

    handleSelect(lat, lon, name) {
        document.getElementById('suggestions').innerHTML = "";
        document.getElementById('citySearch').value = "";
        this.state.map.flyTo([lat, lon], 10);
        this.sync(parseFloat(lat), parseFloat(lon), name);
    }

    detect() {
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((p) => {
                document.getElementById('localPlace').textContent = "HOME NODE";
                this.state.map.setView([p.coords.latitude, p.coords.longitude], 4);
            });
        }
    }
}
const engine = new AuraEngine();
