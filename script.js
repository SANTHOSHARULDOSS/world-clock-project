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
        if (this.state.marker) this.state.map.removeLayer(this.state.marker);
        this.state.marker = L.circleMarker([lat, lon], { radius: 10, color: '#6366f1' }).addTo(this.state.map);
        
        document.getElementById('targetName').textContent = "SYNCING...";

        try {
            // High-precision API used to ensure Indian Standard Time (IST) is exact
            const res = await fetch(`https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lon}&localityLanguage=en&key=free`);
            const data = await res.json();

            let name = label || (await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)).json()).address.city || "Global Point";

            // CRITICAL FIX: Explicitly using IANA IDs to solve the "Half-Hour Less" IST bug
            this.state.targetTz = data.ianaTimeId;
            
            document.getElementById('targetName').textContent = name;
            document.getElementById('tzLabel').textContent = this.state.targetTz;
            document.getElementById('targetCard').classList.add('active');
            
            // Auto-center on selection for Mobile
            if(window.innerWidth < 768) this.state.map.panTo([lat, lon]);

        } catch (e) { document.getElementById('targetName').textContent = "SYNC_ERROR"; }
    }

    loop() {
        setInterval(() => {
            const now = new Date();
            const opt = (tz) => ({ timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !this.state.is24Hour });

            document.getElementById('localClock').textContent = now.toLocaleTimeString('en-US', opt(this.state.localTz));
            document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

            if (this.state.targetTz) {
                try {
                    document.getElementById('targetClock').textContent = now.toLocaleTimeString('en-US', opt(this.state.targetTz));
                    const hr = parseInt(new Intl.DateTimeFormat('en-GB', {timeZone: this.state.targetTz, hour: 'numeric', hour12: false}).format(now));
                    document.getElementById('solarLabel').textContent = (hr >= 6 && hr < 18) ? "DAYLIGHT" : "NIGHTFALL";
                } catch (e) { document.getElementById('targetClock').textContent = "TZ_ERR"; }
            }
        }, 1000);
    }

    bind() {
        document.getElementById('syncBtn').onclick = () => {
            const q = document.getElementById('citySearch').value;
            if(q) this.search(q);
        };

        document.getElementById('themeToggle').onclick = () => {
            const r = document.documentElement;
            const n = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            r.setAttribute('data-theme', n);
            this.tiles.setUrl(n === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
        };

        document.getElementById('formatToggle').onchange = (e) => this.state.is24Hour = e.target.checked;

        document.getElementById('mapCenterBtn').onclick = () => this.state.map.setView([20, 0], 2);

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
