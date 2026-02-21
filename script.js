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
        // Visual indicator that sync is happening
        document.getElementById('targetPlace').textContent = "SYNCING NODE...";
        if (this.state.marker) this.state.map.removeLayer(this.state.marker);
        this.state.marker = L.circleMarker([lat, lon], { radius: 10, color: '#6366f1' }).addTo(this.state.map);
        
        try {
            // High-Precision API Sync - Fixes IST +5:30 offset
            const res = await fetch(`https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lon}&localityLanguage=en&key=free`);
            const data = await res.json();
            
            let name = label || (await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)).json()).address.city || "Remote Point";

            // CRITICAL FIX: The clock loop will now see this ID and start ticking
            this.state.targetTz = data.ianaTimeId; 
            
            document.getElementById('targetPlace').textContent = name;
            document.getElementById('tzLabel').textContent = this.state.targetTz;
            document.getElementById('targetCard').classList.add('active');
            
        } catch (e) { 
            document.getElementById('targetPlace').textContent = "SYNC_ERROR"; 
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

            // Local Time Node
            document.getElementById('localClock').textContent = now.toLocaleTimeString('en-US', opt(this.state.localTz));
            document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            // Target Time Node - Only displays if targetTz is valid
            if (this.state.targetTz) {
                try {
                    const timeStr = now.toLocaleTimeString('en-US', opt(this.state.targetTz));
                    document.getElementById('targetClock').textContent = timeStr;
                    
                    const hr = parseInt(new Intl.DateTimeFormat('en-GB', {timeZone: this.state.targetTz, hour: 'numeric', hour12: false}).format(now));
                    document.getElementById('solarLabel').textContent = (hr >= 6 && hr < 18) ? "☀️ DAYLIGHT" : "🌙 NIGHTFALL";
                } catch (e) { 
                    document.getElementById('targetClock').textContent = "--:--:--"; 
                }
            }
        }, 1000);
    }

    bind() {
        // PANEL SWITCHING
        document.getElementById('openMapBtn').onclick = () => {
            document.getElementById('dashboard').classList.remove('active');
            document.getElementById('mapView').classList.add('active');
            setTimeout(() => this.state.map.invalidateSize(), 200);
        };
        document.getElementById('closeMapBtn').onclick = () => {
            document.getElementById('mapView').classList.remove('active');
            document.getElementById('dashboard').classList.add('active');
        };

        document.getElementById('themeToggle').onclick = () => {
            const r = document.documentElement;
            const n = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            r.setAttribute('data-theme', n);
            this.tiles.setUrl(n === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
        };

        document.getElementById('formatToggle').onchange = (e) => this.state.is24Hour = e.target.checked;

        // SEARCH ENGINE
        const inp = document.getElementById('citySearch');
        inp.oninput = async (e) => {
            if(e.target.value.length < 3) return;
            const d = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${e.target.value}`)).json();
            document.getElementById('suggestions').innerHTML = d.slice(0,5).map(i => `
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
