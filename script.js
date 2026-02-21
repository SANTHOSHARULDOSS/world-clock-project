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
        // Reduced map overhead for better speed
        this.state.map = L.map('map', { zoomControl: false, attributionControl: false, fadeAnimation: true }).setView([20, 0], 2);
        this.tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.state.map);
        
        this.state.map.on('click', (e) => this.sync(e.latlng.lat, e.latlng.lng));
        this.bind();
        this.loop();
        this.detect();
    }

    async sync(lat, lon, label = null) {
        // Immediate Feedback
        const clockEl = document.getElementById('targetClock');
        const placeEl = document.getElementById('targetPlace');
        clockEl.textContent = "LOADING...";
        placeEl.textContent = label || "Fetching...";

        if (this.state.marker) this.state.map.removeLayer(this.state.marker);
        this.state.marker = L.circleMarker([lat, lon], { radius: 8, color: '#6366f1', weight: 2 }).addTo(this.state.map);

        try {
            // High-speed Timezone Fetching
            const response = await fetch(`https://api.teleport.org/api/locations/${lat},${lon}/`);
            const data = await response.json();
            
            // Extracting IANA ID (Essential for IST +5:30)
            const tzName = data._embedded['location:nearest-cities'][0]._embedded['location:nearest-city']._embedded['location:nearest-urban-area']._embedded['ua:timezone'].iana_name;
            
            this.state.targetTz = tzName;
            document.getElementById('targetPlace').textContent = label || data._embedded['location:nearest-cities'][0]._embedded['location:nearest-city'].name;
            document.getElementById('tzLabel').textContent = tzName;
            document.getElementById('targetCard').classList.add('active');

            // Automatic Mobile Switch
            if(window.innerWidth < 768) {
                setTimeout(() => {
                    document.getElementById('mapView').classList.remove('active');
                    document.getElementById('dashboard').classList.add('active');
                }, 1000);
            }
        } catch (e) {
            // FALLBACK: If Teleport fails, use the secondary high-precision API
            const res = await fetch(`https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lon}&localityLanguage=en&key=free`);
            const d = await res.json();
            this.state.targetTz = d.ianaTimeId;
            document.getElementById('targetPlace').textContent = label || "Selected Node";
        }
    }

    loop() {
        const update = () => {
            const now = new Date();
            const format = (tz) => ({ timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !this.state.is24Hour });

            document.getElementById('localClock').textContent = now.toLocaleTimeString('en-US', format(this.state.localTz));
            document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            if (this.state.targetTz) {
                document.getElementById('targetClock').textContent = now.toLocaleTimeString('en-US', format(this.state.targetTz));
                const hr = parseInt(new Intl.DateTimeFormat('en-GB', {timeZone: this.state.targetTz, hour: 'numeric', hour12: false}).format(now));
                document.getElementById('solarLabel').textContent = (hr >= 6 && hr < 18) ? "☀️ DAY" : "🌙 NIGHT";
            }
            requestAnimationFrame(() => {}); // Performance optimization
        };
        setInterval(update, 1000);
    }

    bind() {
        document.getElementById('openMapBtn').onclick = () => {
            document.getElementById('dashboard').classList.remove('active');
            document.getElementById('mapView').classList.add('active');
            setTimeout(() => this.state.map.invalidateSize(), 100);
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

        // Search Debouncing (Prevents Slowness)
        let timer;
        document.getElementById('citySearch').oninput = (e) => {
            clearTimeout(timer);
            const val = e.target.value;
            if(val.length < 3) return;
            timer = setTimeout(async () => {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${val}`);
                const data = await res.json();
                document.getElementById('suggestions').innerHTML = data.slice(0,5).map(i => `
                    <div class="item" onclick="engine.handleSelect(${i.lat}, ${i.lon}, '${i.display_name.split(',')[0]}')">${i.display_name}</div>
                `).join('');
            }, 400);
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
                this.state.map.setView([p.coords.latitude, p.coords.longitude], 4);
                document.getElementById('localPlace').textContent = "HOME NODE";
            }, () => { document.getElementById('localPlace').textContent = "DEFAULT NODE"; });
        }
    }
}
const engine = new AuraEngine();
